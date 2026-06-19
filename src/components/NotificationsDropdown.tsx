import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faCheckDouble, faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { api } from '../api/client'
import { useT } from '../store/locale'

/**
 * DROP-435: dropdown de notificaciones del admin.
 *
 * Lee de /api/admin/notifications. Si el endpoint no existe (instalación
 * antigua), cae a un mock vacío sin romper la UI. Mientras hay notifs sin
 * leer, muestra un badge indicator.
 */
interface Notif {
  id: string
  level: 'info' | 'warning' | 'success' | 'error'
  title: string
  body?: string
  href?: string
  read: boolean
  createdAt: string
}

export function NotificationsDropdown() {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  // DROP-513: la campana antes consumía /admin/notifications mientras la
  // página /notifications usaba /me/notifications. Resultado: badge "2" en la
  // campana y la página decía "Sin notificaciones". Unificamos al endpoint
  // /me/notifications (mismo que la página).
  // DROP-545: unificar queryKey con NotificationsPage (['notif']) para que
  // mark-as-read en la página invalide automáticamente el badge del topbar.
  const { data, refetch } = useQuery({
    queryKey: ['notif'],
    queryFn: async (): Promise<Notif[]> => {
      try {
        const r = await api.get<Notif[]>('/me/notifications')
        return Array.isArray(r.data) ? r.data : []
      } catch {
        return [] // endpoint optional; degrade gracefully
      }
    },
    refetchInterval: 60_000,
  })
  const notifs = data ?? []
  const unread = notifs.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function markAllRead() {
    try {
      // DROP-513: alineado con la página /notifications.
      await api.post('/me/notifications/read-all')
      refetch()
    } catch { /* endpoint optional */ }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
              className="btn btn-ghost btn-sm btn-square indicator"
              aria-label={t('admin.notifications.title')}
              title={t('admin.notifications.title')}>
        {unread > 0 && (
          <span className="indicator-item badge badge-error badge-xs">{unread > 9 ? '9+' : unread}</span>
        )}
        <FontAwesomeIcon icon={faBell} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[95vw] max-w-sm max-h-[70vh] overflow-y-auto card bg-base-100 shadow-pastel-lg border border-base-200 z-50">
          <div className="card-body p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{t('admin.notifications.title')}</h3>
              {unread > 0 && (
                <button onClick={markAllRead} className="btn btn-xs btn-ghost gap-1">
                  <FontAwesomeIcon icon={faCheckDouble} className="text-[11px]" />
                  {t('admin.notifications.mark_all_read')}
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto scrollbar-thin -mx-3 mt-2 divide-y divide-base-200">
              {notifs.length === 0 ? (
                <div className="text-center opacity-60 text-[12px] py-6 px-3">
                  {t('admin.notifications.empty')}
                </div>
              ) : notifs.map((n) => {
                const cfg = LEVEL[n.level] ?? LEVEL.info
                const body = (
                  <div className={`px-3 py-2 hover:bg-base-200/50 ${n.read ? 'opacity-70' : ''}`}>
                    <div className="flex items-start gap-2">
                      <FontAwesomeIcon icon={cfg.icon} className={`mt-0.5 text-[12px] ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{n.title}</div>
                        {n.body && <div className="text-[11px] opacity-70 line-clamp-2">{n.body}</div>}
                        <div className="text-[10px] opacity-50 mt-0.5">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" aria-label="unread" />}
                    </div>
                  </div>
                )
                return n.href
                  ? <Link key={n.id} to={n.href} onClick={() => setOpen(false)}>{body}</Link>
                  : <div key={n.id}>{body}</div>
              })}
            </div>
            <Link to="/admin/notifications" onClick={() => setOpen(false)}
                  className="btn btn-ghost btn-xs w-full mt-2">
              {t('admin.notifications.see_all')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

const LEVEL = {
  info:    { icon: faCircleInfo,        color: 'text-info' },
  warning: { icon: faTriangleExclamation,color: 'text-warning' },
  success: { icon: faCheckDouble,       color: 'text-success' },
  error:   { icon: faTriangleExclamation,color: 'text-error' },
} as const
