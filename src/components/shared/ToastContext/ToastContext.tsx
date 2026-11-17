import type React from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react'

import { useToastStore } from '@/store'
import type { ToastType } from '@/types'

import { ToastContext } from './useToast'

import styles from './ToastContext.module.css'

export interface ToastProviderProps {
  children: React.ReactNode
}

function renderToastIcon(type: ToastType): React.ReactNode {
  switch (type) {
    case 'success':
      return <CheckCircle size={17} aria-hidden="true" />
    case 'warning':
      return <AlertTriangle size={17} aria-hidden="true" />
    case 'error':
      return <XCircle size={17} aria-hidden="true" />
    case 'info':
      return <Info size={17} aria-hidden="true" />
  }
}

export function ToastProvider({ children }: ToastProviderProps) {
  const { t } = useTranslation()
  const toasts = useToastStore((state) => state.toasts)
  const showToast = useToastStore((state) => state.showToast)
  const removeToast = useToastStore((state) => state.removeToast)
  const clearToasts = useToastStore((state) => state.clearToasts)

  const contextValue = useMemo(
    () => ({ showToast, removeToast, clearToasts }),
    [showToast, removeToast, clearToasts],
  )

  const closeLabel = t('common.close', 'Close notification')

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={styles.container} aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            <span className={styles.iconWrap}>{renderToastIcon(toast.type)}</span>
            <span className={styles.message}>{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className={styles.closeBtn}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
