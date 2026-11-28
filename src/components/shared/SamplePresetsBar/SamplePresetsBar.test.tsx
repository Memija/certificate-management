import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SamplePresetsBar } from './SamplePresetsBar'

describe('SamplePresetsBar', () => {
  it('renders standard, loaded, active, and special preset buttons as enabled with aria-pressed state', () => {
    const onSelectFirst = vi.fn()
    const onSelectLoaded = vi.fn()
    const onSelectSpecial = vi.fn()
    const onClear = vi.fn()

    const { container } = render(
      <SamplePresetsBar
        items={[
          {
            id: 'first',
            label: 'First Sample',
            badge: 'PEM',
            badgeTone: 'info',
            isActive: true,
            onSelect: onSelectFirst,
          },
          {
            id: 'second',
            label: 'Loaded Sample',
            badge: 'DER',
            badgeTone: 'warning',
            isLoaded: true,
            onSelect: onSelectLoaded,
          },
          {
            id: 'local',
            buttonId: 'preset-local',
            label: 'home-management.dev',
            isSpecial: true,
            isMonoLabel: true,
            isActive: false,
            onSelect: onSelectSpecial,
          },
        ]}
        showClear
        onClear={onClear}
      />,
    )

    expect(screen.getByText('Try Test Examples:')).toBeInTheDocument()

    const firstBtn = screen.getByRole('button', { name: /First Sample/i })
    const loadedBtn = screen.getByRole('button', { name: /Loaded Sample/i })
    const specialBtn = screen.getByRole('button', { name: /home-management\.dev/i })
    const clearBtn = screen.getByRole('button', { name: /^Clear$/i })

    expect(firstBtn).toBeEnabled()
    expect(firstBtn).toHaveAttribute('aria-pressed', 'true')
    expect(loadedBtn).toBeEnabled()
    expect(loadedBtn).toHaveAttribute('aria-pressed', 'false')
    expect(specialBtn).toBeEnabled()
    expect(specialBtn).toHaveAttribute('aria-pressed', 'false')
    expect(specialBtn).toHaveAttribute('id', 'preset-local')

    fireEvent.click(firstBtn)
    fireEvent.click(loadedBtn)
    fireEvent.click(specialBtn)
    fireEvent.click(clearBtn)

    expect(onSelectFirst).toHaveBeenCalledTimes(1)
    expect(onSelectLoaded).toHaveBeenCalledTimes(1)
    expect(onSelectSpecial).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)

    for (const button of container.querySelectorAll('button')) {
      expect(button).toHaveAttribute('type', 'button')
    }
    expect(container.querySelector('[style]')).toBeNull()
  })
})
