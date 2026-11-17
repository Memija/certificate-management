import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { APP_VERSION } from '@/config'

import { AppFooter as BarrelAppFooter } from '../index'
import AppFooterDefault, { AppFooter } from './index'

describe('AppFooter', () => {
  it('re-exports AppFooter consistently from component and layout barrels', () => {
    expect(AppFooterDefault).toBe(AppFooter)
    expect(BarrelAppFooter).toBe(AppFooter)
  })

  it('renders semantic footer displaying the application version without inline styles', () => {
    const { container } = render(<AppFooter />)

    const footer = screen.getByRole('contentinfo')
    expect(footer.tagName).toBe('FOOTER')

    const versionEl = screen.getByText(`v${APP_VERSION}`)
    expect(versionEl).toBeInTheDocument()
    expect(versionEl).toHaveClass('mono')
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })
})
