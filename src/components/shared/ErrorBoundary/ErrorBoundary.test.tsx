import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from './ErrorBoundary'

function ProblemChild({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message ?? 'ASN.1 parse explosion')
  }
  return <div>Healthy Module Content</div>
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>Healthy Module Content</div>
      </ErrorBoundary>,
    )

    expect(screen.getByText('Healthy Module Content')).toBeInTheDocument()
  })

  it('catches render errors, logs via console.error, and recovers via Retry button', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReset = vi.fn()

    function Harness() {
      const [broken, setBroken] = useState(true)
      return (
        <ErrorBoundary
          fallbackTitle="Module Crashed"
          onReset={() => {
            onReset()
            setBroken(false)
          }}
        >
          <ProblemChild shouldThrow={broken} />
        </ErrorBoundary>
      )
    }

    render(<Harness />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Module Crashed' })).toBeInTheDocument()
    expect(screen.getByText('ASN.1 parse explosion')).toBeInTheDocument()
    expect(errorSpy).toHaveBeenCalled()

    const retryBtn = screen.getByRole('button', { name: /try again/i })
    expect(retryBtn).toHaveAttribute('type', 'button')
    fireEvent.click(retryBtn)

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Healthy Module Content')).toBeInTheDocument()

    errorSpy.mockRestore()
  })

  it('resets automatically when resetKey changes and handles empty error message', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(
      <ErrorBoundary resetKey="mode-a">
        <ProblemChild shouldThrow message="" />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/unexpected error occurred/i)).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKey="mode-b">
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Healthy Module Content')).toBeInTheDocument()

    errorSpy.mockRestore()
  })
})
