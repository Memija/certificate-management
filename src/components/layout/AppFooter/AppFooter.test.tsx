import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { APP_VERSION } from '@/config'
import i18n from '@/i18n'

import { AppFooter as BarrelAppFooter } from '../index'
import AppFooterDefault, { AppFooter } from './index'

describe('AppFooter', () => {
  it('re-exports AppFooter consistently from component and layout barrels', () => {
    expect(AppFooterDefault).toBe(AppFooter)
    expect(BarrelAppFooter).toBe(AppFooter)
  })

  it('renders semantic footer capsule displaying localized tagline and version without inline styles', () => {
    const { container } = render(<AppFooter />)

    const footer = screen.getByRole('contentinfo')
    expect(footer.tagName).toBe('FOOTER')

    expect(screen.getByText('In-Browser Cryptography · Privacy-First')).toBeInTheDocument()

    const versionEl = screen.getByText(`v${APP_VERSION}`)
    expect(versionEl).toBeInTheDocument()
    expect(versionEl).toHaveClass('mono')
    expect(container.querySelector('[data-category]')).toHaveAttribute(
      'data-category',
      'systemCheck',
    )
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })

  it('maps mode prop to data-category on the capsule dock and updates tagline on language switch', async () => {
    const { container, rerender } = render(<AppFooter mode="chain-validator" />)
    expect(container.querySelector('[data-category]')).toHaveAttribute(
      'data-category',
      'inspectionValidation',
    )

    rerender(<AppFooter mode="key-generator" />)
    expect(container.querySelector('[data-category]')).toHaveAttribute(
      'data-category',
      'keyManagement',
    )

    rerender(<AppFooter mode="tls-scanner" />)
    expect(container.querySelector('[data-category]')).toHaveAttribute(
      'data-category',
      'networkStatus',
    )

    rerender(<AppFooter mode="education-center" />)
    expect(container.querySelector('[data-category]')).toHaveAttribute('data-category', 'learning')

    await act(async () => {
      await i18n.changeLanguage('de')
    })

    expect(screen.getByText('Browser-Kryptografie · Datenschutzorientiert')).toBeInTheDocument()
  })
})
