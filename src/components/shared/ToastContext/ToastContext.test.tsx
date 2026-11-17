import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from '@/store'

import { ToastProvider, useToast } from './index'

function ToastTriggerDemo() {
  const { showToast, clearToasts } = useToast()
  return (
    <div>
      <button type="button" onClick={() => showToast('Saved PEM', 'success', 2500)}>
        Trigger Success
      </button>
      <button type="button" onClick={() => showToast('Check CRL', 'warning', 0)}>
        Trigger Warning
      </button>
      <button type="button" onClick={() => showToast('Parse failed', 'error', 0)}>
        Trigger Error
      </button>
      <button type="button" onClick={() => showToast('Scanning TLS', 'info', 0)}>
        Trigger Info
      </button>
      <button type="button" onClick={clearToasts}>
        Clear All
      </button>
    </div>
  )
}

describe('ToastContext & ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders aria-live="polite" notifications via useToast() inside ToastProvider and closes via button', () => {
    vi.useFakeTimers()

    const { container } = render(
      <ToastProvider>
        <ToastTriggerDemo />
      </ToastProvider>,
    )

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trigger Warning' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trigger Error' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trigger Info' }))

    expect(screen.getByText('Saved PEM')).toBeInTheDocument()
    expect(screen.getByText('Check CRL')).toBeInTheDocument()
    expect(screen.getByText('Parse failed')).toBeInTheDocument()
    expect(screen.getByText('Scanning TLS')).toBeInTheDocument()

    const closeButtons = screen.getAllByRole('button', { name: 'Close notification' })
    expect(closeButtons).toHaveLength(4)
    expect(closeButtons[0]).toHaveAttribute('type', 'button')

    // Auto-dismiss first toast after 2500ms
    act(() => {
      vi.advanceTimersByTime(2600)
    })
    expect(screen.queryByText('Saved PEM')).not.toBeInTheDocument()

    // Manual close via close button
    fireEvent.click(screen.getAllByRole('button', { name: 'Close notification' })[0])
    expect(screen.queryByText('Check CRL')).not.toBeInTheDocument()

    // Clear remaining
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))
    expect(screen.queryByText('Parse failed')).not.toBeInTheDocument()
    expect(screen.queryByText('Scanning TLS')).not.toBeInTheDocument()
  })

  it('renders toasts triggered directly through Zustand useToastStore', () => {
    render(
      <ToastProvider>
        <div>App Child</div>
      </ToastProvider>,
    )

    act(() => {
      useToastStore.getState().showToast('Direct Zustand Toast', 'info', 0)
    })

    expect(screen.getByText('Direct Zustand Toast')).toBeInTheDocument()
  })

  it('works via useToast() even outside ToastProvider by delegating to useToastStore', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Standalone Hook Toast', 'success', 0)
    })

    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]?.message).toBe('Standalone Hook Toast')

    act(() => {
      result.current.removeToast(useToastStore.getState().toasts[0]!.id)
    })

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
