import { TrackingView } from '../api/orders'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTruckFast, faLocationDot } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'

/**
 * Timeline de seguimiento del envío (Cainiao): número de seguimiento + entrega estimada + los eventos
 * en orden cronológico inverso (lo más reciente arriba). Se muestra tanto al cliente como al admin.
 */
export function TrackingTimeline({ tracking }: { tracking?: TrackingView }) {
  const t = useT()
  if (!tracking) return null
  const events = [...(tracking.events ?? [])].reverse()
  if (!tracking.trackingNumber && events.length === 0) return null

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2"><FontAwesomeIcon icon={faTruckFast} className="text-primary" /> {t('tracking.title')}</h3>
        {tracking.trackingNumber && (
          <span className="text-[11px] font-mono bg-base-200 rounded px-2 py-1">
            {tracking.carrier ?? t('tracking.carrier_default')} · {tracking.trackingNumber}
          </span>
        )}
      </div>
      {tracking.estimatedDeliveryAt && (
        <div className="text-xs text-ink-500 mb-3">
          {t('tracking.eta')}: <strong>{new Date(tracking.estimatedDeliveryAt).toLocaleDateString()}</strong>
        </div>
      )}
      {events.length === 0 ? (
        <p className="text-sm text-ink-500">{t('tracking.empty')}</p>
      ) : (
        <ol className="relative border-s border-base-300 ms-2 space-y-4">
          {events.map((e, i) => (
            <li key={i} className="ms-4">
              <span className={`absolute -start-[7px] mt-1 w-3.5 h-3.5 rounded-full border-2 border-base-100 ${i === 0 ? 'bg-primary' : 'bg-base-300'}`} />
              <div className="text-sm font-medium">{e.description}</div>
              <div className="text-xs text-ink-500 flex flex-wrap gap-x-2">
                {e.location && <span><FontAwesomeIcon icon={faLocationDot} className="me-1" />{e.location}</span>}
                {e.occurredAt && <span>{new Date(e.occurredAt).toLocaleString()}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
