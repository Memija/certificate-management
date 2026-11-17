import { create } from 'zustand'

import type { ToastItem, ToastType } from '@/types'

export interface ToastState {
  toasts: ToastItem[]
  showToast: (message: string, type?: ToastType, duration?: number) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

let toastCounter = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (message: string, type: ToastType = 'success', duration = 3000) => {
    toastCounter += 1
    const id = `${Date.now()}-${toastCounter}-${Math.random().toString(36).slice(2, 9)}`
    const item: ToastItem = { id, message, type, duration }

    set((state) => ({ toasts: [...state.toasts, item] }))

    if (duration > 0) {
      const timer = setTimeout(() => {
        get().removeToast(id)
      }, duration)
      toastTimers.set(id, timer)
    }

    return id
  },
  removeToast: (id: string) => {
    const timer = toastTimers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      toastTimers.delete(id)
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
  clearToasts: () => {
    for (const timer of toastTimers.values()) {
      clearTimeout(timer)
    }
    toastTimers.clear()
    set({ toasts: [] })
  },
}))
