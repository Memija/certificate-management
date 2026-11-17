import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LANGUAGE_META } from '@/config'
import i18n from '@/i18n'
import { useThemeStore } from '@/store'
import * as systemSettings from '@/utils/system-settings'

import AppHeaderDefault, { AppHeader } from './index'

describe('AppHeader', () => {
  it('re-exports AppHeader as both named and default export', () => {
    expect(AppHeaderDefault).toBe(AppHeader)
  })

  it('renders mobile menu trigger, language picker, and theme toggle with accessible attributes', () => {
    const onOpenSidebar = vi.fn()
    const { container } = render(<AppHeader mode="secure-boot" onOpenSidebar={onOpenSidebar} />)

    const banner = screen.getByRole('banner')
    expect(banner).toBeInTheDocument()

    const openBtn = screen.getByRole('button', { name: 'Open sidebar' })
    expect(openBtn).toHaveAttribute('type', 'button')
    expect(openBtn).toHaveAttribute('title', 'Open sidebar')
    fireEvent.click(openBtn)
    expect(onOpenSidebar).toHaveBeenCalledTimes(1)

    const langBtn = screen.getByRole('button', { name: 'English' })
    expect(langBtn).toHaveAttribute('type', 'button')
    expect(langBtn).toHaveAttribute('aria-haspopup', 'listbox')
    expect(langBtn).toHaveAttribute('aria-expanded', 'false')

    const triggerFlag = langBtn.querySelector('img')
    expect(triggerFlag).toHaveAttribute('src', '/flags/gb.png')
    expect(triggerFlag).toHaveAttribute('alt', '')
    expect(triggerFlag).toHaveAttribute('aria-hidden', 'true')
    expect(triggerFlag).toHaveAttribute('width', '18')
    expect(triggerFlag).toHaveAttribute('height', '13')

    const themeBtn = screen.getByRole('button', { name: 'Toggle theme' })
    expect(themeBtn).toHaveAttribute('type', 'button')
    expect(themeBtn).toHaveAttribute('title', 'Toggle theme')

    const dock = container.querySelector('[data-category]')
    expect(dock).toHaveAttribute('data-category', 'systemCheck')
  })

  it('maps mode prop to the corresponding data-category on the capsule dock', () => {
    const { container, rerender } = render(
      <AppHeader mode="chain-validator" onOpenSidebar={vi.fn()} />,
    )
    expect(container.querySelector('[data-category]')).toHaveAttribute(
      'data-category',
      'inspectionValidation',
    )

    rerender(<AppHeader mode="key-generator" onOpenSidebar={vi.fn()} />)
    expect(container.querySelector('[data-category]')).toHaveAttribute(
      'data-category',
      'keyManagement',
    )

    rerender(<AppHeader mode="tls-scanner" onOpenSidebar={vi.fn()} />)
    expect(container.querySelector('[data-category]')).toHaveAttribute(
      'data-category',
      'networkStatus',
    )

    rerender(<AppHeader mode="education-center" onOpenSidebar={vi.fn()} />)
    expect(container.querySelector('[data-category]')).toHaveAttribute('data-category', 'learning')
  })

  it('cycles theme preference across system, dark, and light via useThemeStore', () => {
    useThemeStore.setState({ theme: 'system', effectiveTheme: 'dark' })
    render(<AppHeader mode="secure-boot" onOpenSidebar={vi.fn()} />)

    const themeBtn = screen.getByRole('button', { name: 'Toggle theme' })

    fireEvent.click(themeBtn)
    expect(useThemeStore.getState().theme).toBe('dark')

    fireEvent.click(themeBtn)
    expect(useThemeStore.getState().theme).toBe('light')

    fireEvent.click(themeBtn)
    expect(useThemeStore.getState().theme).toBe('system')
  })

  it('opens language listbox, switches language with decorative flags, and persists preference', async () => {
    const prefSpy = vi.spyOn(systemSettings, 'setUserLanguagePreference')

    render(<AppHeader mode="secure-boot" onOpenSidebar={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'English' })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const listbox = screen.getByRole('listbox', { name: 'Switch Language' })
    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(LANGUAGE_META.length)

    for (const option of options) {
      const flagImg = option.querySelector('img')
      expect(flagImg).toHaveAttribute('alt', '')
      expect(flagImg).toHaveAttribute('aria-hidden', 'true')
      expect(flagImg).toHaveAttribute('width', '18')
      expect(flagImg).toHaveAttribute('height', '13')
    }

    const englishOpt = within(listbox).getByRole('option', { name: 'English' })
    expect(englishOpt).toHaveAttribute('aria-selected', 'true')

    const deutschOpt = within(listbox).getByRole('option', { name: 'Deutsch' })
    expect(deutschOpt).toHaveAttribute('aria-selected', 'false')

    await act(async () => {
      fireEvent.click(deutschOpt)
    })

    expect(prefSpy).toHaveBeenCalledWith('de')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    prefSpy.mockRestore()
  })

  it('closes the language listbox on outside mousedown and on Escape key while restoring focus', () => {
    render(<AppHeader mode="secure-boot" onOpenSidebar={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'English' })
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('logs an error gracefully if i18n.changeLanguage rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const changeLangSpy = vi
      .spyOn(i18n, 'changeLanguage')
      .mockRejectedValueOnce(new Error('load failure'))

    render(<AppHeader mode="secure-boot" onOpenSidebar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'English' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'Polski' }))
    })

    expect(errorSpy).toHaveBeenCalled()
    changeLangSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
