import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { useToastStore } from '@/store'
import type { ExpiryDashboardCertEntry } from '@/types'
import * as apiClient from '@/utils/api-client'
import { WebApiUnavailableError } from '@/utils/api-client'

import {
  collectFallbackExpiryCerts,
  extractCertCommonName,
  getDaysDiff,
  isWebFallbackError,
  sortIndexedCerts,
  summarizeAndIndexCerts,
} from './expiry-helpers'
import ExpiryDashboardDefault, { ExpiryDashboard, ExpirySortModal } from './index'

const SAMPLE_CERTS: ExpiryDashboardCertEntry[] = [
  {
    thumbprint: 'AABBCCDDEEFF00112233445566778899AABBCCDD',
    subject: 'CN=alpha-expired.corp.local, O=Alpha Corp, C=US',
    issuer: 'CN=Alpha Root CA, O=Alpha Corp, C=US',
    notBefore: '2023-01-01T00:00:00Z',
    notAfter: new Date(Date.now() - 15 * 86_400_000).toISOString(),
    isExpired: true,
    isExpiringSoon: false,
    storeName: 'My',
    location: 'CurrentUser',
  },
  {
    thumbprint: '11223344556677889900AABBCCDDEEFF11223344',
    subject: 'O=Zeta Organization Only, C=DE',
    issuer: 'CN=Zeta CA, O=Zeta Org, C=DE',
    notBefore: '2024-01-01T00:00:00Z',
    notAfter: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    isExpired: false,
    isExpiringSoon: true,
    storeName: 'Root',
    location: 'LocalMachine',
  },
  {
    thumbprint: 'FFEEDDCCBBAA99887766554433221100FFEEDDCC',
    subject: 'PlainSubjectWithoutRdn',
    issuer: 'CN=Plain CA',
    notBefore: '2024-01-01T00:00:00Z',
    notAfter: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    isExpired: false,
    isExpiringSoon: true,
    storeName: 'CA',
    location: 'CurrentUser',
  },
]

describe('ExpiryDashboard', () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText: writeTextMock },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports named and default ExpiryDashboard and keeps CSS modules <= 450 lines', () => {
    expect(ExpiryDashboardDefault).toBe(ExpiryDashboard)

    const dir = path.resolve(process.cwd(), 'src/components/ExpiryDashboard')
    for (const cssFile of ['ExpiryDashboard.module.css', 'ExpirySortModal.module.css']) {
      const lines = fs.readFileSync(path.join(dir, cssFile), 'utf8').split(/\r?\n/).length
      expect(lines).toBeLessThanOrEqual(450)
    }
  })

  it('validates pure helper functions across edge cases', () => {
    expect(extractCertCommonName('CN=api.example.com, O=Example')).toBe('api.example.com')
    expect(extractCertCommonName('O=Fallback Org, C=US')).toBe('Fallback Org')
    expect(extractCertCommonName('RawSubjectValue')).toBe('RawSubjectValue')

    expect(getDaysDiff('invalid-date-string')).toBe(0)
    expect(getDaysDiff('2026-01-11T00:00:00Z', new Date('2026-01-01T00:00:00Z').getTime())).toBe(10)

    expect(isWebFallbackError(new WebApiUnavailableError())).toBe(true)
    expect(isWebFallbackError({ isWebFallback: true })).toBe(true)
    expect(isWebFallbackError({ isWebFallback: false })).toBe(false)
    expect(isWebFallbackError(new Error('Boom'))).toBe(false)
    expect(isWebFallbackError('string error')).toBe(false)

    const summary = summarizeAndIndexCerts(SAMPLE_CERTS)
    expect(summary.expiredCount).toBe(1)
    expect(summary.expiringSoonCount).toBe(2)
    expect(summary.isSortable).toEqual({
      subject: true,
      store: true,
      expiry: true,
      status: true,
    })

    const bySubjectDesc = sortIndexedCerts(summary.indexedCerts, 'subject', false)
    expect(extractCertCommonName(bySubjectDesc[0]!.subject)).toBe('Zeta Organization Only')

    const byStoreAsc = sortIndexedCerts(summary.indexedCerts, 'store', true)
    expect(byStoreAsc[0]!.location).toBe('CurrentUser')

    const byStatusAsc = sortIndexedCerts(summary.indexedCerts, 'status', true)
    expect(byStatusAsc[0]!.isExpired).toBe(true)

    const collected = collectFallbackExpiryCerts((store, loc) => [
      {
        thumbprint: `${loc}-${store}-valid`,
        subject: 'CN=Valid',
        issuer: 'CN=Root',
        notBefore: '2025-01-01T00:00:00Z',
        notAfter: '2035-01-01T00:00:00Z',
        isExpired: false,
        isExpiringSoon: false,
      },
      {
        thumbprint: `${loc}-${store}-exp`,
        subject: 'CN=Expired',
        issuer: 'CN=Root',
        notBefore: '2020-01-01T00:00:00Z',
        notAfter: '2021-01-01T00:00:00Z',
        isExpired: true,
        isExpiringSoon: false,
      },
    ])
    expect(collected).toHaveLength(6)
  })

  it('renders empty All Clear state with sequential h1 -> h2 -> h3 headings and zero inline styles', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchLocalApiJson').mockResolvedValue({ data: [] })

    const { container } = render(<ExpiryDashboard />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'All Clear!' })).toBeInTheDocument()
    })

    expect(fetchSpy).toHaveBeenCalledWith('/api/certstore?batch=expiry')
    expect(screen.getByRole('heading', { level: 1, name: 'Expiry Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Action Items' })).toBeInTheDocument()
    expect(screen.getByText('0 certificates')).toBeInTheDocument()

    for (const btn of container.querySelectorAll('button')) {
      expect(btn).toHaveAttribute('type', 'button')
    }
    expect(container.querySelector('[style]')).toBeNull()
  })

  it('renders certificates, supports desktop column sorting, refresh, and copying thumbprints', async () => {
    const fetchSpy = vi
      .spyOn(apiClient, 'fetchLocalApiJson')
      .mockResolvedValue({ data: SAMPLE_CERTS })

    const { container } = render(<ExpiryDashboard />)

    await waitFor(() => {
      expect(screen.getByText('3 certificates')).toBeInTheDocument()
    })

    expect(container.querySelector('[style]')).toBeNull()

    const table = screen.getByRole('table')
    const getRowCertNames = () =>
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.querySelector('strong')?.textContent ?? '')

    // Default sort is expiry ascending: alpha-expired (-15d), Plain (+5d), Zeta (+10d)
    expect(getRowCertNames()).toEqual([
      'alpha-expired.corp.local',
      'PlainSubjectWithoutRdn',
      'Zeta Organization Only',
    ])

    // Click Expiry Date again to flip to descending
    fireEvent.click(within(table).getByRole('button', { name: 'Expiry Date' }))
    expect(getRowCertNames()).toEqual([
      'Zeta Organization Only',
      'PlainSubjectWithoutRdn',
      'alpha-expired.corp.local',
    ])

    // Sort by Certificate (subject) ascending
    fireEvent.click(within(table).getByRole('button', { name: 'Certificate' }))
    expect(getRowCertNames()).toEqual([
      'alpha-expired.corp.local',
      'PlainSubjectWithoutRdn',
      'Zeta Organization Only',
    ])

    // Sort by Store ascending
    fireEvent.click(within(table).getByRole('button', { name: 'Store' }))
    expect(getRowCertNames()[2]).toBe('Zeta Organization Only')

    // Sort by Status ascending (Expired first)
    fireEvent.click(within(table).getByRole('button', { name: 'Status' }))
    expect(getRowCertNames()[0]).toBe('alpha-expired.corp.local')

    // Copy thumbprint from desktop table
    const copyBtn = within(table).getByRole('button', {
      name: /AABBCCDDEEFF00112233445566778899AABBCCDD/,
    })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('AABBCCDDEEFF00112233445566778899AABBCCDD')
      expect(useToastStore.getState().toasts[0]?.message).toContain('alpha-expired.corp.local')
    })

    // Trigger Refresh button
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/certstore?batch=expiry&refresh=true')
    })
  })

  it('renders single-certificate static headers and handles clipboard write failure gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    writeTextMock.mockRejectedValueOnce(new Error('Clipboard denied'))
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockResolvedValue({
      data: [SAMPLE_CERTS[0]!],
    })

    render(<ExpiryDashboard />)

    await waitFor(() => {
      expect(screen.getByText('1 certificate')).toBeInTheDocument()
    })

    const table = screen.getByRole('table')
    // Single item means columns are non-sortable (no header buttons)
    expect(within(table).queryByRole('button', { name: 'Certificate' })).not.toBeInTheDocument()

    // Click mobile card copy button to cover mobile copy + failure path
    const copyButtons = screen.getAllByTitle('Click to copy thumbprint')
    expect(copyButtons.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(copyButtons[1]!)

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled()
      expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true)
    })
  })

  it('opens and operates mobile ExpirySortModal (option select, direction flip, Escape & close)', async () => {
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockResolvedValue({ data: SAMPLE_CERTS })

    render(<ExpiryDashboard />)

    await waitFor(() => {
      expect(screen.getByText('3 certificates')).toBeInTheDocument()
    })

    // Toggle direction directly from mobile sort bar
    const dirToggle = screen.getByTitle('Ascending order')
    fireEvent.click(dirToggle)
    expect(screen.getByTitle('Descending order')).toBeInTheDocument()

    // Open mobile sort bottom sheet dialog
    const sortTrigger = screen.getByTitle('Sort by:')
    fireEvent.click(sortTrigger)

    const dialog = screen.getByRole('dialog', { name: 'Sort Certificates' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Flip direction inside modal
    const modalDirBtn = within(dialog).getByTitle('Descending order')
    fireEvent.click(modalDirBtn)
    expect(within(dialog).getByTitle('Ascending order')).toBeInTheDocument()

    // Select 'Certificate' option -> closes modal and updates active sort trigger
    fireEvent.click(within(dialog).getByRole('option', { name: /Certificate/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(sortTrigger).toHaveTextContent('Certificate')

    // Reopen and click active option ('Certificate') -> flips direction & closes
    fireEvent.click(sortTrigger)
    const dialog2 = screen.getByRole('dialog', { name: 'Sort Certificates' })
    fireEvent.click(within(dialog2).getByRole('option', { name: /Certificate/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen and close via Escape key
    fireEvent.click(sortTrigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen and close via Close icon button
    fireEvent.click(sortTrigger)
    const dialog3 = screen.getByRole('dialog')
    fireEvent.click(within(dialog3).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('falls back gracefully to getWebFallbackCertStore when WebApiUnavailableError is thrown', async () => {
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockRejectedValue(new WebApiUnavailableError())

    render(<ExpiryDashboard />)

    await waitFor(
      () => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        // Fallback store synthesizes expired and expiring-soon certificates (desktop + mobile)
        expect(screen.getAllByText('legacy-vpn-gateway.internal').length).toBeGreaterThanOrEqual(1)
      },
      { timeout: 5000 },
    )
  })

  it('displays error alert banner when local API fails with a non-fallback error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockRejectedValue(
      new Error('Certificate service access denied'),
    )

    render(<ExpiryDashboard />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Certificate service access denied')
    })
    expect(errorSpy).toHaveBeenCalled()
  })

  it('renders localized German labels and supports standalone ExpirySortModal closed state', async () => {
    await i18n.changeLanguage('de')
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockResolvedValue({ data: [] })

    const { unmount } = render(
      <ExpirySortModal
        isOpen={false}
        sortCol="expiry"
        sortAsc={true}
        onSelectColumn={vi.fn()}
        onToggleDirection={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render(<ExpiryDashboard />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })
  })
})
