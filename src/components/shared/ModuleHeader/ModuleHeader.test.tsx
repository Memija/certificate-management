import { render, screen } from '@testing-library/react'
import { RefreshCw, Shield, ShieldCheck } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import type { NavCategoryId } from '@/types'

import { ModuleHeader } from './index'

describe('ModuleHeader', () => {
  it('renders semantic header with h1 title, description, eyebrow, children, and actions', () => {
    render(
      <ModuleHeader
        category="systemCheck"
        eyebrowIcon={<ShieldCheck data-testid="eyebrow-icon" size={14} />}
        eyebrowText="System Check"
        title="UEFI Secure Boot Inspector"
        description="Inspect NVRAM signature databases and boot certificates."
        icon={<Shield data-testid="main-icon" size={24} />}
        actions={
          <button type="button" className="btn btn-secondary btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      >
        <div data-testid="header-children">db / dbx / KEK / PK</div>
      </ModuleHeader>,
    )

    const banner = screen.getByRole('banner')
    expect(banner).toHaveAttribute('data-category', 'systemCheck')

    const h1 = screen.getByRole('heading', { level: 1, name: 'UEFI Secure Boot Inspector' })
    expect(h1).toBeInTheDocument()

    expect(
      screen.getByText('Inspect NVRAM signature databases and boot certificates.'),
    ).toBeInTheDocument()
    expect(screen.getByText('System Check')).toBeInTheDocument()
    expect(screen.getByTestId('eyebrow-icon')).toBeInTheDocument()
    expect(screen.getByTestId('main-icon')).toBeInTheDocument()
    expect(screen.getByTestId('header-children')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('supports all 5 navigation categories and omits optional slots when undefined', () => {
    const categories: readonly NavCategoryId[] = [
      'systemCheck',
      'inspectionValidation',
      'keyManagement',
      'networkStatus',
      'learning',
    ]

    const { rerender } = render(
      <ModuleHeader
        category="systemCheck"
        eyebrowText="Category"
        title="Title"
        description="Desc"
        icon={<Shield size={20} />}
      />,
    )

    for (const category of categories) {
      rerender(
        <ModuleHeader
          category={category}
          eyebrowText={`Label ${category}`}
          title={`Heading ${category}`}
          description="Minimal header"
          icon={<Shield size={20} />}
        />,
      )
      expect(screen.getByRole('banner')).toHaveAttribute('data-category', category)
      expect(
        screen.getByRole('heading', { level: 1, name: `Heading ${category}` }),
      ).toBeInTheDocument()
    }
  })
})
