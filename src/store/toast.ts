import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  kind: ToastKind
  title?: string
  message: string
  /** auto-dismiss in ms, 0 = sticky */
  ttl: number
  /** optional action shown as a button */
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id' | 'ttl'> & { ttl?: number }) => string
  dismiss: (id: string) => void
  clear: () => void
}

const id = () => Math.random().toString(36).slice(2, 10)

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push(t) {
    const toast: Toast = { id: id(), ttl: 3500, ...t }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    if (toast.ttl > 0) {
      setTimeout(() => get().dismiss(toast.id), toast.ttl)
    }
    return toast.id
  },
  dismiss(id) { set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })) },
  clear() { set({ toasts: [] }) },
}))

/** Convenience helpers — most callers want a one-liner. */
export const toast = {
  success: (message: string, opts?: { title?: string; ttl?: number; action?: Toast['action'] }) =>
    useToastStore.getState().push({ kind: 'success', message, ...opts }),
  error:   (message: string, opts?: { title?: string; ttl?: number; action?: Toast['action'] }) =>
    useToastStore.getState().push({ kind: 'error',   message, ttl: 6000, ...opts }),
  info:    (message: string, opts?: { title?: string; ttl?: number; action?: Toast['action'] }) =>
    useToastStore.getState().push({ kind: 'info',    message, ...opts }),
  warning: (message: string, opts?: { title?: string; ttl?: number; action?: Toast['action'] }) =>
    useToastStore.getState().push({ kind: 'warning', message, ttl: 5000, ...opts }),
}
