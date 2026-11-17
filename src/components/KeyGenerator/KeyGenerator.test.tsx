import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from '@/store'
import * as rsaKeyGenerator from '@/utils/rsa-key-generator'

import KeyGeneratorDefault, { KeyGenerator, KeyGeneratorOutputPanel } from './index'

describe('KeyGenerator', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    expect(KeyGeneratorDefault).toBe(KeyGenerator)
    expect(KeyGeneratorOutputPanel).toBeDefined()
    writeTextMock.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-keygen-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('renders ModuleHeader h1, sequential h2 sections, labeled form controls, and type="button" buttons', () => {
    const { container } = render(<KeyGenerator />)

    expect(
      screen.getByRole('heading', { level: 1, name: /Key Pair & CSR \/ Self-Signed Generator/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /Subject Details & Parameters/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /Generated Private Key/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Generated CSR/i })).toBeInTheDocument()

    expect(screen.getByLabelText(/Common Name \(CN\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Organization \(O\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Unit \(OU\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/City \(L\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/State \(ST\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Country \(C\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Key Size/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Output Type/i)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Generate Key Pair & CSR/i })).toBeDisabled()

    container.querySelectorAll('button').forEach((btn) => {
      expect(btn).toHaveAttribute('type', 'button')
    })
  })

  it('shows inline warnings for placeholder values, RFC 5280 length limits, and country code validation', () => {
    render(<KeyGenerator />)

    const cnInput = screen.getByLabelText(/Common Name \(CN\)/i)
    const orgInput = screen.getByLabelText(/Organization \(O\)/i)
    const ouInput = screen.getByLabelText(/Unit \(OU\)/i)
    const cityInput = screen.getByLabelText(/City \(L\)/i)
    const stateInput = screen.getByLabelText(/State \(ST\)/i)
    const countryInput = screen.getByLabelText(/Country \(C\)/i)

    fireEvent.change(cnInput, { target: { value: 'example.com' } })
    expect(
      screen.getByText(/Cannot create a setup using only placeholder values/i),
    ).toBeInTheDocument()

    fireEvent.change(orgInput, { target: { value: 'Organization' } })
    expect(screen.getByText(/Generic placeholder detected for Organization/i)).toBeInTheDocument()

    fireEvent.change(ouInput, { target: { value: 'IT Dept' } })
    expect(
      screen.getByText(/Generic placeholder detected for Organizational Unit/i),
    ).toBeInTheDocument()

    fireEvent.change(cityInput, { target: { value: 'City' } })
    expect(screen.getByText(/Generic placeholder detected for City/i)).toBeInTheDocument()

    fireEvent.change(stateInput, { target: { value: 'State' } })
    expect(screen.getByText(/Generic placeholder detected for State/i)).toBeInTheDocument()

    // Country 1-char error, unknown 2-char error, and valid country name
    fireEvent.change(countryInput, { target: { value: 'U' } })
    expect(screen.getByText(/must be a 2-letter ISO 3166-1/i)).toBeInTheDocument()

    fireEvent.change(countryInput, { target: { value: 'ZZ' } })
    expect(screen.getByText(/Unknown country code "ZZ"/i)).toBeInTheDocument()

    fireEvent.change(countryInput, { target: { value: 'us' } })
    expect(screen.getByText(/United States/i)).toBeInTheDocument()

    // 64-character RFC 5280 limit indicator
    fireEvent.change(cnInput, { target: { value: `${'a'.repeat(60)}.com` } })
    expect(screen.getByText(/Maximum limit of 64 characters reached/i)).toBeInTheDocument()
  })

  it('generates an RSA key pair + CSR and an RSA key pair + Self-Signed Certificate, with copy and download actions', async () => {
    render(<KeyGenerator />)

    fireEvent.change(screen.getByLabelText(/Common Name \(CN\)/i), {
      target: { value: 'vault.acme-corp.internal' },
    })
    fireEvent.change(screen.getByLabelText(/Organization \(O\)/i), {
      target: { value: 'Acme Security' },
    })
    fireEvent.change(screen.getByLabelText(/Unit \(OU\)/i), {
      target: { value: 'Platform PKI' },
    })
    fireEvent.change(screen.getByLabelText(/City \(L\)/i), {
      target: { value: 'Zurich' },
    })
    fireEvent.change(screen.getByLabelText(/State \(ST\)/i), {
      target: { value: 'Zurich' },
    })
    fireEvent.change(screen.getByLabelText(/Country \(C\)/i), {
      target: { value: 'CH' },
    })

    const generateCsrBtn = screen.getByRole('button', { name: /Generate Key Pair & CSR/i })
    expect(generateCsrBtn).toBeEnabled()
    fireEvent.click(generateCsrBtn)

    await waitFor(
      () => {
        const keyOutput = screen.getByLabelText(/Generated Private Key/i) as HTMLTextAreaElement
        expect(keyOutput.value).toContain('-----BEGIN RSA PRIVATE KEY-----')
      },
      { timeout: 10000 },
    )

    const csrOutput = screen.getByLabelText(/Generated CSR/i) as HTMLTextAreaElement
    expect(csrOutput.value).toContain('-----BEGIN CERTIFICATE REQUEST-----')

    // Download .key and .csr + Copy buttons
    fireEvent.click(screen.getByRole('button', { name: /\.key/i }))
    fireEvent.click(screen.getByRole('button', { name: /\.csr/i }))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)

    const copyBtns = screen.getAllByRole('button', { name: /^Copy$/i })
    fireEvent.click(copyBtns[0]!)
    fireEvent.click(copyBtns[1]!)
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(2)
    })

    // Switch to Self-Signed Certificate mode and generate
    fireEvent.change(screen.getByLabelText(/Output Type/i), { target: { value: 'self-signed' } })
    expect(
      screen.getByRole('heading', { level: 2, name: /Generated Certificate/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Generate Key Pair & Cert/i }))

    await waitFor(
      () => {
        const certOutput = screen.getByLabelText(/Generated Certificate/i) as HTMLTextAreaElement
        expect(certOutput.value).toContain('-----BEGIN CERTIFICATE-----')
      },
      { timeout: 10000 },
    )

    fireEvent.click(screen.getByRole('button', { name: /\.crt/i }))
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(true)
  })

  it('surfaces error banner and toast if async key generation fails, and clears error on input edit', async () => {
    const spy = vi
      .spyOn(rsaKeyGenerator, 'generateRsaKeyPairAsync')
      .mockRejectedValueOnce(new Error('WebCrypto entropy unavailable'))

    render(<KeyGenerator />)

    const cnInput = screen.getByLabelText(/Common Name \(CN\)/i)
    fireEvent.change(cnInput, { target: { value: 'node.acme.internal' } })
    fireEvent.click(screen.getByRole('button', { name: /Generate Key Pair & CSR/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/WebCrypto entropy unavailable/i)

    fireEvent.change(cnInput, { target: { value: 'node2.acme.internal' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    spy.mockRestore()
  })
})
