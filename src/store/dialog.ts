import { create } from 'zustand'

/**
 * Sistema central de diálogos custom — reemplaza window.alert/confirm/prompt
 * con un modal daisyUI que respeta el theme pastel y el dark mode.
 *
 * Uso desde cualquier componente:
 *   import { dialog } from '../store/dialog'
 *   await dialog.alert({ message: 'Listo' })
 *   const ok = await dialog.confirm({ message: '¿Borrar?', variant: 'error' })
 *   const name = await dialog.prompt({ message: 'Tu nombre', defaultValue: '' })
 *
 * También exponemos un singleton sin hook (importable directo) que dispara el
 * diálogo, así no necesitamos cambiar firmas para que las arrow inline funcionen.
 */

export type DialogVariant = 'info' | 'success' | 'warning' | 'error'
export type DialogKind = 'alert' | 'confirm' | 'prompt'

export interface DialogSpec {
  id: number
  kind: DialogKind
  title?: string
  message: string
  variant?: DialogVariant
  confirmLabel?: string
  cancelLabel?: string
  // prompt only
  placeholder?: string
  defaultValue?: string
  inputType?: 'text' | 'email' | 'password' | 'number'
}

interface PromptResolver { resolve: (v: any) => void }

interface DialogState {
  current: DialogSpec | null
  resolver: PromptResolver | null
  push: (spec: Omit<DialogSpec, 'id'>, resolver: PromptResolver) => void
  close: (result: any) => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  current: null,
  resolver: null,
  push(spec, resolver) {
    set({
      current: { ...spec, id: Date.now() + Math.random() },
      resolver,
    })
  },
  close(result) {
    const r = get().resolver
    set({ current: null, resolver: null })
    if (r) r.resolve(result)
  },
}))

// ============================================================
// Singleton helpers (sin hooks — usables desde event handlers)
// ============================================================

export interface AlertOptions {
  title?: string
  message: string
  variant?: DialogVariant
  confirmLabel?: string
}

export interface ConfirmOptions {
  title?: string
  message: string
  variant?: DialogVariant
  confirmLabel?: string
  cancelLabel?: string
}

export interface PromptOptions {
  title?: string
  message: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  inputType?: 'text' | 'email' | 'password' | 'number'
}

function open<T>(spec: Omit<DialogSpec, 'id'>): Promise<T> {
  return new Promise<T>((resolve) => {
    useDialogStore.getState().push(spec, { resolve })
  })
}

export const dialog = {
  alert(opts: AlertOptions | string): Promise<true> {
    const o = typeof opts === 'string' ? { message: opts } : opts
    return open({
      kind: 'alert',
      title: o.title,
      message: o.message,
      variant: o.variant ?? 'info',
      confirmLabel: o.confirmLabel,
    })
  },
  confirm(opts: ConfirmOptions | string): Promise<boolean> {
    const o = typeof opts === 'string' ? { message: opts } : opts
    return open({
      kind: 'confirm',
      title: o.title,
      message: o.message,
      variant: o.variant ?? 'warning',
      confirmLabel: o.confirmLabel,
      cancelLabel: o.cancelLabel,
    })
  },
  prompt(opts: PromptOptions | string): Promise<string | null> {
    const o = typeof opts === 'string' ? { message: opts } : opts
    return open({
      kind: 'prompt',
      title: o.title,
      message: o.message,
      variant: 'info',
      confirmLabel: o.confirmLabel,
      cancelLabel: o.cancelLabel,
      placeholder: o.placeholder,
      defaultValue: o.defaultValue,
      inputType: o.inputType ?? 'text',
    })
  },
}

/**
 * Override global de window.alert / confirm / prompt — pone nuestro UI cuando
 * el provider esté montado y deja el comportamiento nativo como fallback.
 * Llamado una sola vez desde el Provider al montar.
 */
export function installNativeOverrides() {
  if (typeof window === 'undefined') return
  // Guard: no instalar dos veces.
  if ((window as any).__nxDialogInstalled) return
  ;(window as any).__nxDialogInstalled = true

  // alert() es fire-and-forget — perfecto: mostramos el modal y seguimos.
  window.alert = (msg?: any) => {
    dialog.alert({ message: String(msg ?? '') })
  }
  // confirm() / prompt() nativos son SÍNCRONOS. Nuestro modal es asíncrono y
  // no podemos suplantarlos al 100%. El código del repo se migró a
  // `await dialog.confirm/prompt(...)` que sí espera. Si una librería externa
  // sigue usando window.confirm, mostramos el modal y devolvemos true (optimistic).
  window.confirm = (msg?: string) => {
    dialog.confirm({ message: String(msg ?? '') })
    return true
  }
}
