import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from '@/store'
import type { CtEntry } from '@/types'
import * as apiClient from '@/utils/api-client'
import * as webFallbacks from '@/utils/web-fallbacks'

import { deduplicateAndSortCtEntries, formatCtIssuer } from './ct-log-helpers'
import CtLogSearchDefault, { CtLogSearch } from './index'

function makeEntry(overrides: Partial<CtEntry> = {}): CtEntry {
  return {
    id: 1001,
    issuer_ca_id: 16418,
    issuer_name: "C=US, O=Let's Encrypt, CN=E5",
    common_name: 'app.example.com',
    name_value: 'app.example.com\n*.app.example.com',
    entry_timestamp: '2026-06-01T10:00:00',
    not_before: '2026-06-01T10:00:00',
    not_after: '2099-06-01T10:00:00',
    serial_number: '04aa11bb22cc33dd',
    ...overrides,
  }
}

describe('CtLogSearch', () => {
  const writeTextMock = vi.fn<(_text: string) => Promise<void>>()

  beforeEach(() => {
    writeTextMock.mockReset()
    writeTextMock.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('exports named and default CtLogSearch and enforces accessible headings, labels, and zero inline styles', () => {
    expect(CtLogSearchDefault).toBe(CtLogSearch)

    const { container } = render(<CtLogSearch />)

    const h1s = container.querySelectorAll('h1')
    const h2s = container.querySelectorAll('h2')
    const h3s = container.querySelectorAll('h3')
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Certificate Transparency (CT) Log Search')
    expect(h2s).toHaveLength(1)
    expect(h2s[0]).toHaveTextContent('Domain / Subdomain Query')
    expect(h3s).toHaveLength(0)

    for (const btn of container.querySelectorAll('button')) {
      expect(btn).toHaveAttribute('type', 'button')
    }
    expect(container.querySelector('[style]')).toBeNull()
    expect(screen.getByLabelText('Domain / Subdomain Query')).toBeInTheDocument()
  })

  it('validates empty domain input and supports inline domain clear button', () => {
    render(<CtLogSearch />)

    fireEvent.click(screen.getByRole('button', { name: /Search CT Logs/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter a valid domain name/i)

    const input = screen.getByLabelText('Domain / Subdomain Query') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'example.com' } })
    expect(input.value).toBe('example.com')

    // Inline icon-only clear button inside input box
    const clearButtons = screen.getAllByRole('button', { name: 'Clear' })
    fireEvent.click(clearButtons[clearButtons.length - 1]!)
    expect(input.value).toBe('')
  })

  it('queries live API, filters active/expired/search query, copies CN & serial, and paginates >60 results', async () => {
    const entries: CtEntry[] = [
      makeEntry({
        id: 5001,
        common_name: 'valid.example.com',
        not_after: '2099-12-31T00:00:00',
        serial_number: 'aaaa1111',
      }),
      makeEntry({
        id: 5002,
        common_name: 'expired.example.com',
        issuer_name: 'CN=Legacy CA',
        not_after: '2020-01-01T00:00:00',
        serial_number: 'bbbb2222',
      }),
      ...Array.from({ length: 62 }, (_, idx) =>
        makeEntry({
          id: 6000 + idx,
          common_name: `sub-${idx}.example.com`,
          not_before: `2026-01-01T00:00:${String(idx % 60).padStart(2, '0')}`,
          not_after: '2099-01-01T00:00:00',
          serial_number: `serial-${idx}`,
        }),
      ),
    ]

    const fetchSpy = vi.spyOn(apiClient, 'fetchLocalApiJson').mockResolvedValueOnce({
      data: entries,
      provider: 'crt.sh',
      rateLimited: false,
    })

    const { container } = render(<CtLogSearch />)
    const input = screen.getByLabelText('Domain / Subdomain Query')
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/ctsearch?domain=example.com')
      expect(container.querySelector('#ct-live-status-pill')).toBeInTheDocument()
    })

    // Check zero inline styles even with rendered result cards
    expect(container.querySelector('[style]')).toBeNull()

    // Pagination button (60 / 64)
    const showMoreBtn = screen.getByRole('button', { name: /Show More \(60 \/ 64\)/i })
    fireEvent.click(showMoreBtn)
    expect(screen.queryByRole('button', { name: /Show More/i })).not.toBeInTheDocument()

    // Filter by Expired
    fireEvent.click(screen.getByRole('button', { name: /Expired/i }))
    expect(screen.getByText('expired.example.com')).toBeInTheDocument()
    expect(screen.queryByText('valid.example.com')).not.toBeInTheDocument()

    // Filter by Active / Valid
    fireEvent.click(screen.getByRole('button', { name: /Active \/ Valid/i }))
    expect(screen.getByText('valid.example.com')).toBeInTheDocument()
    expect(screen.queryByText('expired.example.com')).not.toBeInTheDocument()

    // Filter by text search query
    const filterInput = screen.getByLabelText(/Filter results/i)
    fireEvent.change(filterInput, { target: { value: 'valid.example.com' } })
    await waitFor(() => {
      expect(screen.getByText('valid.example.com')).toBeInTheDocument()
    })

    // Copy Common Name & Serial Number
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Common Name' }))
    })
    expect(writeTextMock).toHaveBeenCalledWith('valid.example.com')
    expect(screen.getByRole('button', { name: /Copied!/i })).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Serial Number' }))
    })
    expect(writeTextMock).toHaveBeenCalledWith('aaaa1111')

    // Non-matching filter query shows empty filter state
    fireEvent.change(filterInput, { target: { value: 'nonexistent-host-xyz' } })
    await waitFor(() => {
      expect(screen.getByText('No certificates match your search filter.')).toBeInTheDocument()
    })
  }, 30_000)

  it('handles WebApiUnavailableError fallback, CertSpotter rate-limit notice, and preset sample fallback', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // 1. WebApiUnavailableError -> searchCtLogsClientSide returning sample snapshot
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockRejectedValueOnce(
      new apiClient.WebApiUnavailableError(),
    )
    const fallbackSpy = vi.spyOn(webFallbacks, 'searchCtLogsClientSide').mockResolvedValueOnce({
      data: [makeEntry({ id: 777, common_name: 'home-management.dev' })],
      provider: 'sample',
      rateLimited: true,
    })

    const { container } = render(<CtLogSearch />)

    // Click special preset home-management.dev
    fireEvent.click(container.querySelector('#ct-preset-home-management-dev')!)

    await waitFor(() => {
      expect(fallbackSpy).toHaveBeenCalled()
      expect(container.querySelector('#ct-rate-limit-banner')).toBeInTheDocument()
    })

    // 2. CertSpotter rate-limit fallback notice
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockResolvedValueOnce({
      data: [],
      provider: 'certspotter',
      rateLimited: true,
    })
    const input = screen.getByLabelText('Domain / Subdomain Query')
    fireEvent.change(input, { target: { value: 'empty-domain.org' } })
    fireEvent.click(screen.getByRole('button', { name: /Search CT Logs/i }))

    await waitFor(() => {
      expect(container.querySelector('#ct-rate-limit-notice')).toBeInTheDocument()
      expect(screen.getByText('No transparency logs recorded for this domain.')).toBeInTheDocument()
    })

    // 3. Hard API failure on preset falls back to bundled sampleData
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockRejectedValueOnce(new Error('502 Bad Gateway'))
    fireEvent.click(container.querySelector('#ct-preset-github-com')!)

    await waitFor(() => {
      expect(container.querySelector('#ct-rate-limit-banner')).toBeInTheDocument()
      expect(screen.getAllByText('github.com').length).toBeGreaterThan(0)
    })

    // Clipboard error triggers toast
    writeTextMock.mockRejectedValueOnce(new Error('Denied'))
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Copy Serial Number' })[0]!)
    })
    expect(useToastStore.getState().toasts.some((item) => item.type === 'error')).toBe(true)

    // 4. Hard API failure on custom non-preset domain shows error banner
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockRejectedValueOnce(new Error('Service overloaded'))
    fireEvent.change(input, { target: { value: 'custom-failing.example' } })
    fireEvent.click(screen.getByRole('button', { name: /Search CT Logs/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Service overloaded')
    })

    // Clear resets everything
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]!)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('deduplicates entries by serial/ID and formats issuer DN variants', () => {
    const a = makeEntry({ id: 1, serial_number: 'AB12', not_before: '2025-01-01T00:00:00' })
    const dupSerial = makeEntry({
      id: 2,
      serial_number: 'ab12',
      not_before: '2026-01-01T00:00:00',
    })
    const dupId = makeEntry({ id: 1, serial_number: 'CD34', not_before: '2026-02-01T00:00:00' })
    const newer = makeEntry({ id: 3, serial_number: 'EF56', not_before: '2026-05-01T00:00:00' })

    const merged = deduplicateAndSortCtEntries([a, dupSerial], [dupId, newer])
    expect(merged.map((item) => item.id)).toEqual([3, 1])

    expect(formatCtIssuer('C=US, O=DigiCert Inc, CN=DigiCert G2')).toBe(
      'DigiCert Inc - DigiCert G2',
    )
    expect(formatCtIssuer('CN=Standalone CA')).toBe('Standalone CA')
    expect(formatCtIssuer('O=Standalone Org')).toBe('Standalone Org')
    expect(formatCtIssuer('Custom Plain Issuer')).toBe('Custom Plain Issuer')
  })
})
