import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ALL_APP_MODES, NAV_CATEGORIES } from '@/config'
import i18n from '@/i18n'

import AppSidebarDefault, { AppSidebar } from './index'

describe('AppSidebar', () => {
  it('re-exports AppSidebar as both named and default export', () => {
    expect(AppSidebarDefault).toBe(AppSidebar)
  })

  it('renders brand identity, decorative logo, and zero heading elements inside aside', () => {
    const { container } = render(
      <AppSidebar mode="secure-boot" onModeChange={vi.fn()} isOpen={false} onClose={vi.fn()} />,
    )

    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    expect(aside?.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0)

    expect(screen.getByText('Certificate')).toBeInTheDocument()
    expect(screen.getByText('Management')).toBeInTheDocument()

    const logo = container.querySelector('img[src="/logo.svg"]')
    expect(logo).toHaveAttribute('alt', '')
    expect(logo).toHaveAttribute('aria-hidden', 'true')
    expect(logo).toHaveAttribute('width', '36')
    expect(logo).toHaveAttribute('height', '36')
  })

  it('renders all categories with aria-labelledby lists and all navigation buttons', () => {
    render(
      <AppSidebar mode="chain-validator" onModeChange={vi.fn()} isOpen={false} onClose={vi.fn()} />,
    )

    const nav = screen.getByRole('navigation', { name: 'Certificate Management' })
    expect(nav).toBeInTheDocument()

    for (const category of NAV_CATEGORIES) {
      const categoryLabel = i18n.t(`app.categories.${category.id}`)
      const list = within(nav).getByRole('list', { name: categoryLabel })
      expect(list).toBeInTheDocument()
    }

    const navButtons = within(nav).getAllByRole('button')
    expect(navButtons).toHaveLength(ALL_APP_MODES.length)
    for (const btn of navButtons) {
      expect(btn).toHaveAttribute('type', 'button')
    }

    const activeBtn = within(nav).getByRole('button', { name: 'Chain Validator' })
    expect(activeBtn).toHaveAttribute('aria-current', 'page')

    const inactiveBtn = within(nav).getByRole('button', { name: 'Secure Boot NVRAM' })
    expect(inactiveBtn).not.toHaveAttribute('aria-current')
  })

  it('scrolls the active navigation button into view when mode changes', () => {
    const scrollIntoViewMock = vi.fn()
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    try {
      const { rerender } = render(
        <AppSidebar mode="secure-boot" onModeChange={vi.fn()} isOpen={false} onClose={vi.fn()} />,
      )

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
      scrollIntoViewMock.mockClear()

      rerender(
        <AppSidebar
          mode="education-center"
          onModeChange={vi.fn()}
          isOpen={false}
          onClose={vi.fn()}
        />,
      )

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('invokes onModeChange and optional onPreloadMode handlers', () => {
    const onModeChange = vi.fn()
    const onPreloadMode = vi.fn()

    render(
      <AppSidebar
        mode="secure-boot"
        onModeChange={onModeChange}
        onPreloadMode={onPreloadMode}
        isOpen={false}
        onClose={vi.fn()}
      />,
    )

    const targetBtn = screen.getByRole('button', { name: 'Remote TLS Scanner' })
    fireEvent.mouseEnter(targetBtn)
    expect(onPreloadMode).toHaveBeenCalledWith('tls-scanner')

    fireEvent.focus(targetBtn)
    expect(onPreloadMode).toHaveBeenCalledTimes(2)

    fireEvent.click(targetBtn)
    expect(onModeChange).toHaveBeenCalledWith('tls-scanner')
  })

  it('closes via close button, backdrop click, and Escape key when open', () => {
    const onClose = vi.fn()
    const { container, rerender } = render(
      <AppSidebar mode="secure-boot" onModeChange={vi.fn()} isOpen={false} onClose={onClose} />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()

    rerender(
      <AppSidebar mode="secure-boot" onModeChange={vi.fn()} isOpen={true} onClose={onClose} />,
    )

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    const closeBtn = screen.getByRole('button', { name: 'Close sidebar' })
    expect(closeBtn).toHaveAttribute('type', 'button')
    expect(closeBtn).toHaveAttribute('title', 'Close sidebar')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(2)

    const overlay = container.querySelector('[role="presentation"]')
    expect(overlay).not.toBeNull()
    if (overlay) {
      fireEvent.click(overlay)
    }
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('updates category and navigation labels when language switches', async () => {
    render(
      <AppSidebar mode="secure-boot" onModeChange={vi.fn()} isOpen={false} onClose={vi.fn()} />,
    )

    await act(async () => {
      await i18n.changeLanguage('de')
    })

    expect(screen.getByText('Zertifikatsverwaltung')).toBeInTheDocument()
    expect(screen.getByText('Systemprüfung')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bildungszentrum' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seitenleiste schließen' })).toBeInTheDocument()
  })
})
