import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheckCircle, faCircleExclamation, faCircleInfo, faTriangleExclamation, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useToastStore, type Toast } from '../store/toast'

const ICONS = {
  success: faCheckCircle,
  error:   faCircleExclamation,
  info:    faCircleInfo,
  warning: faTriangleExclamation,
}
const ALERT_VARIANT: Record<Toast['kind'], string> = {
  success: 'alert-success',
  error:   'alert-error',
  info:    'alert-info',
  warning: 'alert-warning',
}

/**
 * DROP-297 — Toast queue using daisyUI's `toast toast-end` container with
 * `alert` items inside. Single global instance is mounted in App.tsx.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null
  return (
    <div role="region" aria-label="Notifications" aria-live="polite"
         className="toast toast-end z-[100]">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div role="status" className={`alert ${ALERT_VARIANT[toast.kind]} shadow-lg max-w-md`}>
      <FontAwesomeIcon icon={ICONS[toast.kind]} />
      <div className="flex-1 min-w-0">
        {toast.title && <div className="font-medium">{toast.title}</div>}
        <div className="text-[13px] leading-snug">{toast.message}</div>
      </div>
      {toast.action && (
        <button onClick={() => { toast.action?.onClick(); onDismiss() }} className="btn btn-sm btn-ghost">
          {toast.action.label}
        </button>
      )}
      <button onClick={onDismiss} className="btn btn-sm btn-ghost btn-square" aria-label="Dismiss">
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  )
}
