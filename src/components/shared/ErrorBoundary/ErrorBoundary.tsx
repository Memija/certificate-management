import type React from 'react'
import { Component } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import styles from './ErrorBoundary.module.css'

export interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
  onReset?: () => void
  resetKey?: string | number
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorFallbackCardProps {
  error: Error | null
  fallbackTitle?: string
  onRetry: () => void
}

function ErrorFallbackCard({ error, fallbackTitle, onRetry }: ErrorFallbackCardProps) {
  const { t } = useTranslation()
  const title = fallbackTitle ?? t('common.error', 'Something went wrong')
  const description =
    error?.message ||
    t('app.errorBoundary.description', 'An unexpected error occurred while rendering this module.')

  return (
    <div className={styles.fallbackCard} role="alert">
      <div className={styles.iconWrap} aria-hidden="true">
        <AlertTriangle size={26} />
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{description}</p>
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden="true" />
          <span>{t('app.errorBoundary.retry', 'Try Again')}</span>
        </button>
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught a render error:', error, errorInfo)
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null })
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorFallbackCard
          error={this.state.error}
          fallbackTitle={this.props.fallbackTitle}
          onRetry={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}
