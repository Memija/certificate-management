import { createContext, useContext, useMemo } from 'react'

import { useToastStore } from '@/store'
import type { ToastType } from '@/types'

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  const showToast = useToastStore((state) => state.showToast)
  const removeToast = useToastStore((state) => state.removeToast)
  const clearToasts = useToastStore((state) => state.clearToasts)

  return useMemo(
    () =>
      context ?? {
        showToast,
        removeToast,
        clearToasts,
      },
    [context, showToast, removeToast, clearToasts],
  )
}
