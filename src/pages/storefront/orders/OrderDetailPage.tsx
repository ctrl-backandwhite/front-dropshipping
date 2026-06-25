import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { orders } from '../../../api/orders'
import { api } from '../../../api/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck, faTruck, faBoxOpen, faMoneyBillTransfer, faHouseChimneyUser, faCircleCheck, faCircle,
} from '@fortawesome/free-solid-svg-icons'
import { useT, useLocaleStore } from '../../../store/locale'
import { useCurrencyStore } from '../../../store/currency'
import { TrackingTimeline } from '../../../components/TrackingTimeline'

const TIMELINE = [
  { code: 'placed',     labelKey: 'order.detail.timeline.placed',     icon: faMoneyBillTransfer },
  { code: 'paid',       labelKey: 'order.detail.timeline.paid',       icon: faCheck },
  { code: 'forwarded',  labelKey: 'order.detail.timeline.forwarded',  icon: faBoxOpen },
  { code: 'shipped',    labelKey: 'order.detail.timeline.shipped',    icon: faTruck },
  { code: 'delivered',  labelKey: 'order.detail.timeline.delivered',  icon: faHouseChimneyUser },
]

function activeIndex(status: string, o: { shippedAt?: string; deliveredAt?: string }) {
  if (status === 'CANCELLED' || status === 'REFUNDED') return -1
  if (o.deliveredAt || status === 'DELIVERED') return 4
  if (o.shippedAt || status === 'SHIPPED') return 3
  if (status === 'FORWARDED') return 2
  if (status === 'PAID') return 1
  return 0
}

export default function OrderDetailPage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const format = useCurrencyStore((s) => s.format)
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const placed = params.get('placed') === '1'

  const { data: o, isLoading } = useQuery({
    queryKey: ['order', id, lang],
    queryFn: () => orders.detail(id, lang),
    enabled: !!id,
  })

  // Seguimiento del envío (Cainiao): refresca cada 30s mientras la página está abierta.
  const { data: tracking } = useQuery({
    queryKey: ['order-tracking', id],
    queryFn: () => orders.tracking(id),
    enabled: !!id,
    refetchInterval: 30_000,
  })

  if (isLoading) return <p className="text-sm text-ink-500">{t('order.detail.loading')}</p>
  if (!o) return <p className="text-sm">{t('order.detail.not_found')}</p>

  const idx = activeIndex(o.status, o)
  const isCancelled = o.status === 'CANCELLED' || o.status === 'REFUNDED'

  // La factura es un endpoint protegido: abrirlo como enlace directo no envía el
  // token (va por header, no cookie) y devuelve 401. La descargamos vía el cliente
  // `api` (que añade el Authorization) como blob y disparamos la descarga.
  const orderId = o.id
  const orderNumber = o.orderNumber
  async function downloadInvoice() {
    const res = await api.get(`/me/orders/${orderId}/invoice.pdf`, { params: { lang }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${orderNumber || 'factura'}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {placed && (
        <div className="card p-4 bg-emerald-50 border-emerald-200 text-emerald-800 flex items-start gap-3">
          <FontAwesomeIcon icon={faCircleCheck} className="text-2xl mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">{t('order.detail.placed_ok')}</div>
            <div className="text-emerald-700">{t('order.detail.placed_desc')}</div>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-ink-500">{t('orders.col.order')}</div>
          <h1 className="font-mono">{o.orderNumber}</h1>
          {o.placedAt && <div className="text-xs text-ink-500">{t('order.detail.placed_on')} {new Date(o.placedAt).toLocaleString()}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!['PENDING', 'AWAITING_PAYMENT', 'CANCELLED'].includes(o.status) && (
            <button type="button" onClick={downloadInvoice}
               className="btn btn-outline text-sm">{t('order.detail.download_invoice')}</button>
          )}
          <Link to="/orders" className="btn btn-outline text-sm">← {t('order.detail.back')}</Link>
        </div>
      </header>

      <section className="card p-5">
        <h3 className="mb-4">{t('order.detail.shipping_status')}</h3>
        {isCancelled ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
            {o.status === 'REFUNDED' ? t('order.detail.refunded') : t('order.detail.cancelled')}
            {o.cancelledAt && <span className="block text-xs mt-1">{t('order.detail.on')} {new Date(o.cancelledAt).toLocaleString()}</span>}
          </div>
        ) : (
          <ol className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-0 relative">
            {TIMELINE.map((step, i) => {
              const active = i <= idx
              const current = i === idx
              return (
                <li key={step.code} className="flex md:flex-1 items-center gap-2 md:flex-col md:gap-1">
                  <div className={`w-10 h-10 rounded-full inline-flex items-center justify-center text-sm ${
                    active ? 'bg-emerald-500 text-white' : 'bg-ink-100 text-ink-400'
                  } ${current ? 'ring-4 ring-emerald-100' : ''}`}>
                    <FontAwesomeIcon icon={active ? step.icon : faCircle} />
                  </div>
                  <span className={`text-xs ${active ? 'text-ink-900 font-medium' : 'text-ink-400'}`}>{t(step.labelKey)}</span>
                  {i < TIMELINE.length - 1 && (
                    <div className={`hidden md:block flex-1 h-0.5 -mx-1 ${i < idx ? 'bg-emerald-400' : 'bg-ink-100'}`} />
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {o.trackingNumber && (
          <div className="mt-4 text-sm border-t border-ink-100 pt-3">
            {t('order.detail.tracking')}: <span className="font-mono">{o.trackingNumber}</span>
            {o.trackingCarrier && <> · {o.trackingCarrier}</>}
          </div>
        )}
      </section>

      <TrackingTimeline tracking={tracking} />

      <section className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3>{t('order.detail.address')}</h3>
          {o.shippingAddress ? (
            <div className="text-sm mt-2 space-y-0.5">
              <div className="font-medium">{o.shippingAddress.fullName}</div>
              <div className="text-ink-600">{o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''}</div>
              <div className="text-ink-600">{o.shippingAddress.city}{o.shippingAddress.state ? `, ${o.shippingAddress.state}` : ''} {o.shippingAddress.postalCode}</div>
              <div className="text-ink-600">{o.shippingAddress.country}</div>
              {o.shippingAddress.phone && <div className="text-ink-500 text-xs mt-1">{t('checkout.phone')}: {o.shippingAddress.phone}</div>}
            </div>
          ) : <div className="text-sm text-ink-500 mt-1">—</div>}
        </div>

        <div className="card p-5">
          <h3>{t('order.detail.payment_summary')}</h3>
          <dl className="text-sm mt-2 space-y-1">
            {/* DROP-637: importes ya convertidos línea a línea y FORMATEADOS por el backend (= lo
                cobrado). El front solo pinta el string; fallback a format() solo si faltara. */}
            <div className="flex justify-between"><dt className="text-ink-500">{t('order.detail.subtotal')}</dt><dd>{o.subtotalFormatted ?? format(Number(o.subtotal), o.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">{t('order.detail.shipping')}</dt><dd>{o.shippingFormatted ?? format(Number(o.shipping), o.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">{t('order.detail.tax')}</dt><dd>{o.taxFormatted ?? format(Number(o.tax), o.currency)}</dd></div>
            <div className="flex justify-between border-t border-ink-100 pt-1.5 mt-1.5 font-medium">
              <dt>{t('checkout.total')}</dt><dd>{o.totalFormatted ?? format(Number(o.total), o.currency)}</dd>
            </div>
          </dl>
          {o.notes && <div className="mt-3 text-xs text-ink-500"><strong>{t('checkout.notes')}:</strong> {o.notes}</div>}
        </div>
      </section>

      <section className="card p-5">
        <h3>{t('order.detail.products')}</h3>
        <ul className="divide-y divide-ink-100 mt-2">
          {o.items.map((it) => (
            <li key={it.id} className="py-3 flex items-center gap-3 text-sm">
              {it.imageUrl && !/via\.placeholder|placehold\.co|dummyimage|fakeimg|picsum/i.test(it.imageUrl)
                ? <img src={it.imageUrl} className="w-14 h-14 object-cover rounded" alt=""
                       onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                : <div className="w-14 h-14 rounded bg-ink-100 flex items-center justify-center text-ink-400 text-xs">—</div>}
              <div className="flex-1 min-w-0">
                <div className="font-medium line-clamp-1">{it.productTitle}</div>
                {it.variantName && <div className="text-xs text-ink-500">{it.variantName}</div>}
                <div className="text-xs text-ink-500">{it.quantity} × {it.unitPriceFormatted ?? format(Number(it.unitPrice), o.currency)}</div>
              </div>
              <div className="font-medium">{it.lineTotalFormatted ?? format(Number(it.lineTotal), o.currency)}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
