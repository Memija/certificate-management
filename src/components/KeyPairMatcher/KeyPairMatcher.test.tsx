import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SAMPLE_MATCHING_CERT_PEM, SAMPLE_MATCHING_KEY_PEM } from '@/data'

import KeyPairMatcherDefault, { KeyPairMatcher } from './index'

describe('KeyPairMatcher', () => {
  it('renders ModuleHeader h1, sequential h2 input panels, labeled textareas, and type="button" controls', () => {
    expect(KeyPairMatcherDefault).toBe(KeyPairMatcher)
    const { container } = render(<KeyPairMatcher />)

    expect(
      screen.getByRole('heading', { level: 1, name: /Key Pair Modulus Matcher/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /Certificate or CSR \(PEM\)/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /Private Key \(PEM\)/i }),
    ).toBeInTheDocument()

    expect(screen.getByLabelText(/Certificate or CSR \(PEM\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Private Key \(PEM\)/i)).toBeInTheDocument()

    const verifyBtn = screen.getByRole('button', { name: /Verify Modulus Match/i })
    expect(verifyBtn).toBeDisabled()

    container.querySelectorAll('button').forEach((btn) => {
      expect(btn).toHaveAttribute('type', 'button')
    })
  })

  it('loads matching Certificate + Key and CSR + Key presets and renders matching verdict and modulus hashes', () => {
    render(<KeyPairMatcher />)

    fireEvent.click(screen.getByRole('button', { name: /Matching Cert \+ Key/i }))

    expect(screen.getByText(/Valid Certificate parsed \(RSA 2048 bits\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Valid RSA Private Key parsed \(2048 bits\)/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /The Private Key matches the Certificate\/CSR!/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: /Cryptographic Modulus Comparison/i }),
    ).toBeInTheDocument()

    // Switch to Matching CSR + Key preset
    fireEvent.click(screen.getByRole('button', { name: /Matching CSR \+ Key/i }))
    expect(screen.getByText(/Valid CSR parsed \(RSA 2048 bits\)/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /The Private Key matches the Certificate\/CSR!/i,
      }),
    ).toBeInTheDocument()
  })

  it('detects mismatched key pairs and clears both inputs cleanly', () => {
    render(<KeyPairMatcher />)

    fireEvent.click(screen.getByRole('button', { name: /Mismatched Pair/i }))

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /The Private Key does not match the Certificate\/CSR/i,
      }),
    ).toBeInTheDocument()

    const clearBtns = screen.getAllByRole('button', { name: /^Clear$/i })
    fireEvent.click(clearBtns[0]!)

    expect(screen.getByLabelText(/Certificate or CSR \(PEM\)/i)).toHaveValue('')
    expect(screen.getByLabelText(/Private Key \(PEM\)/i)).toHaveValue('')
    expect(
      screen.queryByText(/The Private Key does not match the Certificate\/CSR/i),
    ).not.toBeInTheDocument()
  })

  it('validates manually pasted PEM inputs and displays localized error messages for invalid Cert or Key', () => {
    render(<KeyPairMatcher />)

    const certTextarea = screen.getByLabelText(/Certificate or CSR \(PEM\)/i)
    const keyTextarea = screen.getByLabelText(/Private Key \(PEM\)/i)
    const verifyBtn = screen.getByRole('button', { name: /Verify Modulus Match/i })

    // Invalid cert PEM
    fireEvent.change(certTextarea, { target: { value: 'invalid-cert-pem' } })
    fireEvent.change(keyTextarea, { target: { value: SAMPLE_MATCHING_KEY_PEM } })
    fireEvent.click(verifyBtn)

    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid PEM formatted message/i)

    // Valid cert PEM + invalid private key PEM
    fireEvent.change(certTextarea, { target: { value: SAMPLE_MATCHING_CERT_PEM } })
    fireEvent.change(keyTextarea, { target: { value: 'invalid-key-pem' } })
    fireEvent.click(verifyBtn)

    expect(screen.getByText(/Valid Certificate parsed/i)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid PEM formatted message/i)

    // Fix private key -> manual match succeeds
    fireEvent.change(keyTextarea, { target: { value: SAMPLE_MATCHING_KEY_PEM } })
    fireEvent.click(verifyBtn)

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /The Private Key matches the Certificate\/CSR!/i,
      }),
    ).toBeInTheDocument()
  })
})
