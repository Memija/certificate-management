import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { useAppStore } from '@/store'

import {
  extractTermCardContent,
  getEducationCategoryMeta,
  parseCardTokens,
  parseLeadSentence,
  parseModalInlineTokens,
  splitKeyPointHeading,
  splitOverviewSentences,
} from './education-helpers'
import EducationCenterDefault, { EducationCenter, EducationTopicModal } from './index'

describe('EducationCenter & EducationTopicModal', () => {
  it('exports named and default EducationCenter and keeps CSS modules <= 450 lines', () => {
    expect(EducationCenterDefault).toBe(EducationCenter)
    expect(EducationTopicModal).toBeDefined()

    const dir = path.resolve(process.cwd(), 'src/components/EducationCenter')
    for (const cssFile of ['EducationCenter.module.css', 'EducationTopicModal.module.css']) {
      const lines = fs.readFileSync(path.join(dir, cssFile), 'utf8').split(/\r?\n/).length
      expect(lines).toBeLessThanOrEqual(450)
    }
  })

  it('validates pure tokenization, sentence splitting, and term helper functions', () => {
    expect(parseCardTokens('')).toEqual([])
    const cardSegs = parseCardTokens(
      'Framed between \'---BEGIN...\' and "---END..." in Base64 X.509.',
    )
    expect(cardSegs.some((s) => s.kind === 'code' && s.value === '---BEGIN...')).toBe(true)
    expect(cardSegs.some((s) => s.kind === 'code' && s.value === '---END...')).toBe(true)
    expect(cardSegs.some((s) => s.kind === 'token' && s.value === 'Base64')).toBe(true)
    expect(cardSegs.some((s) => s.kind === 'token' && s.value === 'X.509')).toBe(true)

    const modalSegs = parseModalInlineTokens(
      "Header '-----BEGIN CERTIFICATE-----' with RFC 5280 and CVE-2022-21894.",
    )
    expect(
      modalSegs.some((s) => s.kind === 'code' && s.value === '-----BEGIN CERTIFICATE-----'),
    ).toBe(true)
    expect(modalSegs.some((s) => s.kind === 'token' && s.value === 'RFC 5280')).toBe(true)
    expect(modalSegs.some((s) => s.kind === 'token' && s.value === 'CVE-2022-21894')).toBe(true)

    expect(parseLeadSentence('Privacy Enhanced Mail (PEM) is a text format.')).toEqual({
      termName: 'Privacy Enhanced Mail',
      acronym: 'PEM',
      rest: ' is a text format.',
    })
    expect(parseLeadSentence('Plain sentence without acronym.')).toBeNull()

    expect(splitOverviewSentences('')).toEqual([])
    expect(splitOverviewSentences('   ')).toEqual([])
    const sentences = splitOverviewSentences(
      'First sentence e.g. ASN.1 vs. BER. Second sentence z. B. RFC 5280.',
    )
    expect(sentences).toHaveLength(2)

    expect(splitKeyPointHeading('Self-signed: Subject matches Issuer.')).toEqual({
      head: 'Self-signed:',
      body: ' Subject matches Issuer.',
    })
    expect(splitKeyPointHeading('No colon in this point at all.')).toBeNull()

    expect(extractTermCardContent('x509', 'X.509 is a standard.', 'X.509 Standard')).toEqual({
      title: 'X.509 Standard',
      definition: 'X.509 is a standard.',
    })
    expect(
      extractTermCardContent('pem', 'Privacy Enhanced Mail (PEM). Base64 text.', 'X.509'),
    ).toEqual({
      title: 'Privacy Enhanced Mail (PEM)',
      definition: 'Base64 text.',
    })
    expect(
      extractTermCardContent(
        'der',
        'A very long sentence without any period before sixty characters at all in its entire length so fallback triggers',
        'X.509',
      ),
    ).toEqual({
      title: 'DER',
      definition:
        'A very long sentence without any period before sixty characters at all in its entire length so fallback triggers',
    })

    expect(getEducationCategoryMeta('secure-boot').translationKey).toBe('secureBoot')
  })

  it('renders sequential h1 -> h2 -> h3 headings, accessible controls, and zero inline styles', () => {
    const { container } = render(<EducationCenter />)

    const h1s = container.querySelectorAll('h1')
    const h2s = container.querySelectorAll('h2')
    const h3s = container.querySelectorAll('h3')

    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Education Center')
    expect(h2s).toHaveLength(4)
    expect(h3s).toHaveLength(18)
    expect(container.querySelectorAll('h4')).toHaveLength(0)

    expect(
      screen.getByRole('textbox', { name: 'Search topics, acronyms, or concepts...' }),
    ).toBeInTheDocument()

    for (const btn of container.querySelectorAll('button')) {
      expect(btn).toHaveAttribute('type', 'button')
    }
    expect(container.querySelector('[style]')).toBeNull()
  })

  it('filters topics by category pills and search query, and clears search cleanly', async () => {
    render(<EducationCenter />)

    const protocolsPill = screen.getByRole('button', { name: 'Protocols & Infrastructure' })
    expect(protocolsPill).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(protocolsPill)
    expect(protocolsPill).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Protocols & Infrastructure' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Secure Boot & Firmware' }),
    ).not.toBeInTheDocument()

    // Return to All Topics
    fireEvent.click(screen.getByRole('button', { name: 'All Topics' }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Secure Boot & Firmware' }),
    ).toBeInTheDocument()

    // Search for specific topic
    const searchInput = screen.getByRole('textbox', {
      name: 'Search topics, acronyms, or concepts...',
    })
    fireEvent.change(searchInput, { target: { value: 'OCSP Stapling' } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: /OCSP Stapling/i })).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { level: 3, name: /Platform Key/i }),
      ).not.toBeInTheDocument()
    })

    // Non-matching search displays empty state
    fireEvent.change(searchInput, { target: { value: 'zzzz-no-such-term-xyz' } })
    await waitFor(() => {
      expect(
        screen.getByText('No terms found matching "zzzz-no-such-term-xyz"'),
      ).toBeInTheDocument()
    })

    // Clear search button resets input and restores categories
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => {
      expect(searchInput).toHaveValue('')
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4)
    })
  })

  it('opens EducationTopicModal for PEM & CSR topics, enforces dialog a11y, and closes via button, Escape, and backdrop', () => {
    const { container } = render(<EducationCenter />)

    // Open PEM modal via card title button
    fireEvent.click(screen.getByRole('button', { name: 'Privacy Enhanced Mail (PEM)' }))

    const dialog = screen.getByRole('dialog', { name: 'PEM (Privacy Enhanced Mail)' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(container.querySelector('[style]')).toBeNull()

    // Inline code chip + PEM structure preview rendered
    expect(
      within(dialog).getAllByText('-----BEGIN CERTIFICATE-----').length,
    ).toBeGreaterThanOrEqual(2)
    expect(within(dialog).getByText('-----END CERTIFICATE-----')).toBeInTheDocument()

    // Clicking inside the dialog does NOT close it
    fireEvent.click(within(dialog).getByText('Technical Overview'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close via Escape key
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Open CSR modal via its card title button to test CSR anatomy & spec link
    fireEvent.click(screen.getByRole('button', { name: 'Certificate Signing Request (CSR)' }))
    const csrDialog = screen.getByRole('dialog', { name: 'CSR (Certificate Signing Request)' })
    expect(
      within(csrDialog).getAllByText('-----BEGIN CERTIFICATE REQUEST-----').length,
    ).toBeGreaterThanOrEqual(2)

    // Close via Close icon button
    fireEvent.click(within(csrDialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Open via "Learn more & deep dive" button and close via backdrop click
    const learnMoreButtons = screen.getAllByRole('button', { name: 'Learn more & deep dive' })
    fireEvent.click(learnMoreButtons[0]!)
    const nvramDialog = screen.getByRole('dialog')
    const backdrop = nvramDialog.parentElement!
    fireEvent.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('navigates via onNavigate prop when provided and falls back to useAppStore.setMode when omitted', () => {
    const onNavigateSpy = vi.fn()
    const { unmount } = render(<EducationCenter onNavigate={onNavigateSpy} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Online Certificate Status Protocol (OCSP)' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'OCSP (Online Certificate Status Protocol)',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Online Revocation Checker/i }))

    expect(onNavigateSpy).toHaveBeenCalledWith('ocsp-checker')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    // Render without onNavigate -> falls back to useAppStore.setMode
    useAppStore.setState({ mode: 'education-center' })
    render(<EducationCenter />)

    fireEvent.click(screen.getByRole('button', { name: 'Certificate Revocation List (CRL)' }))
    const crlDialog = screen.getByRole('dialog', { name: 'CRL (Certificate Revocation List)' })
    fireEvent.click(within(crlDialog).getByRole('button', { name: /CRL Inspector/i }))

    expect(useAppStore.getState().mode).toBe('crl-inspector')
  })

  it('supports German localization and standalone EducationTopicModal null topicId', async () => {
    await i18n.changeLanguage('de')

    const { unmount } = render(<EducationTopicModal topicId={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render(<EducationCenter />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
