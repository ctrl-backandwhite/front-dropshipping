import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleInfo, faTriangleExclamation, faCircleCheck, faCircleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useDialogStore, type DialogVariant } from '../store/dialog'
import { useT } from '../store/locale'

/**
 * Renderiza el modal custom (alert/confirm/prompt). Montado UNA sola vez en
 * App.tsx; escucha el store global y muestra el diálogo actual con animación
 * scale+fade del tema pastel.
 *
 * Cierre:
 *   - alert  → confirm = true
 *   - confirm → confirm = true, cancel/Escape/backdrop = false
 *   - prompt → confirm devuelve el valor, cancel = null
 */
export function DialogHost() {
  const t = useT()
  const current = useDialogStore((s) => s.current)
  const close = useDialogStore((s) => s.close)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset del valor al cambiar de spec
  useEffect(() => {
    setValue(current?.defaultValue ?? '')
    if (current?.kind === 'prompt') {
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [current?.id, current?.defaultValue, current?.kind])

  // ESC cierra (cancel)
  useEffect(() => {
    if (!current) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      } else if (e.key === 'Enter' && current?.kind !== 'prompt') {
        e.preventDefault()
        confirmAction()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, value])

  if (!current) return null

  function confirmAction() {
    if (!current) return
    if (current.kind === 'alert') close(true)
    else if (current.kind === 'confirm') close(true)
    else if (current.kind === 'prompt') close(value)
  }
  function cancel() {
    if (!current) return
    if (current.kind === 'alert') close(true)
    else if (current.kind === 'confirm') close(false)
    else if (current.kind === 'prompt') close(null)
  }

  const variant: DialogVariant = current.variant ?? (current.kind === 'confirm' ? 'warning' : 'info')
  const iconCfg: Record<DialogVariant, { icon: any; color: string; bg: string }> = {
    info:    { icon: faCircleInfo,        color: 'text-info',    bg: 'bg-info/15' },
    success: { icon: faCircleCheck,       color: 'text-success', bg: 'bg-success/15' },
    warning: { icon: faTriangleExclamation,color: 'text-warning', bg: 'bg-warning/15' },
    error:   { icon: faCircleExclamation, color: 'text-error',   bg: 'bg-error/15' },
  }
  const cfg = iconCfg[variant]

  const titleFallback = current.title
    || (current.kind === 'confirm' ? t('dialog.confirm.title')
      : current.kind === 'prompt'  ? t('dialog.prompt.title')
      : t('dialog.alert.title'))

  const confirmLabel = current.confirmLabel
    || (current.kind === 'confirm' ? t('dialog.confirm.ok')
      : current.kind === 'prompt'  ? t('dialog.prompt.ok')
      : t('dialog.alert.ok'))

  const cancelLabel = current.cancelLabel || t('dialog.cancel')

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="nx-dialog-title">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={cancel} aria-hidden="true" />
      <div className="card relative bg-base-100 shadow-pastel-lg max-w-md w-full animate-scale-in">
        <button type="button" onClick={cancel} aria-label={t('dialog.close')}
                className="absolute top-2 right-2 btn btn-ghost btn-xs btn-square opacity-60 hover:opacity-100">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <div className="card-body">
          <div className="flex items-start gap-3">
            <span className={`shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-full ${cfg.bg} ${cfg.color}`}>
              <FontAwesomeIcon icon={cfg.icon} className="text-lg" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 id="nx-dialog-title" className="font-medium text-base mt-0.5">{titleFallback}</h3>
              <p className="text-sm opacity-80 mt-1 whitespace-pre-line break-words">{current.message}</p>
              {current.kind === 'prompt' && (
                <input
                  ref={inputRef}
                  type={current.inputType ?? 'text'}
                  className="input input-bordered w-full mt-3"
                  placeholder={current.placeholder ?? ''}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAction() } }}
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="card-actions justify-end gap-2 mt-3">
            {current.kind !== 'alert' && (
              <button type="button" onClick={cancel} className="btn btn-ghost btn-sm">
                {cancelLabel}
              </button>
            )}
            <button type="button" onClick={confirmAction}
                    className={`btn btn-sm ${variant === 'error' ? 'btn-error' : variant === 'warning' ? 'btn-warning' : 'btn-primary'}`}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
