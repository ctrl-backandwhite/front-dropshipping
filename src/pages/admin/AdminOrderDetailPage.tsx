import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { admin } from '../../api/admin'
import { useT, useLocaleStore } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { StatusBadge } from './AdminDashboardPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faPaperPlane, faTruck, faCircleCheck, faBan, faRotateLeft, faRotate, faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'
import { TrackingTimeline } from '../../components/TrackingTimeline'

/** i18n laxo: fallback si la clave no está traducida aún. */
function tt(t: (k: string) => string, key: string, fb: string): string {
  const v = t(key); return v === key ? fb : v
}

const TRANSITIONS: Record<string, ('forward'|'ship'|'deliver'|'cancel'|'refund')[]> = {
  PENDING:          ['forward', 'cancel'],
  AWAITING_PAYMENT: ['cancel'],
  PAID:             ['forward', 'cancel'],
  FORWARDED:        ['ship', 'cancel'],
  SHIPPED:          ['deliver'],
  DELIVERED:        ['refund'],
  CANCELLED:        [],
  REFUNDED:         [],
}

export default function AdminOrderDetailPage() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const format = useCurrencyStore((s) => s.format)
  const lang = useLocaleStore((s) => s.locale)
  const { data: o, isLoading } = useQuery({
    queryKey: ['admin-order', id, lang],
    // DROP-632: pass the admin's language so line titles come back localised, not raw Chinese.
    queryFn: () => admin.orderById(id!, lang),
    enabled: !!id,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-order', id] })
  const forward = useMutation({ mutationFn: () => admin.forwardOrder(id!), onSuccess: () => { invalidate(); toast(t('admin.orders.toast.forwarded')) } })
  const ship    = useMutation({ mutationFn: () => admin.shipOrder(id!),    onSuccess: () => { invalidate(); toast(t('admin.orders.toast.shipped')) } })
  const deliver = useMutation({ mutationFn: () => admin.deliverOrder(id!), onSuccess: () => { invalidate(); toast(t('admin.orders.toast.delivered')) } })
  const cancelM = useMutation({ mutationFn: () => admin.cancelOrder(id!),  onSuccess: () => { invalidate(); toast(t('admin.orders.toast.cancelled')) } })
  // DROP-584: refund real — antes era un dialog "soon".
  const refundM = useMutation({
    mutationFn: () => admin.refundOrder(id!),
    onSuccess: () => { invalidate(); toast(t('admin.orders.toast.refunded') ?? 'Order refunded') },
    onError: (e: any) => dialog.alert(e?.response?.data?.message ?? 'Refund failed'),
  })
  // Cainiao: seguimiento del envío + sincronización forzada.
  const { data: tracking } = useQuery({
    queryKey: ['admin-order-tracking', id],
    queryFn: () => admin.orderTracking(id!),
    enabled: !!id,
  })
  const syncM = useMutation({
    mutationFn: () => admin.syncTracking(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order-tracking', id] }); invalidate()
      toast(t('tracking.synced') ?? 'Tracking sincronizado')
    },
    onError: (e: any) => dialog.alert(e?.response?.data?.message ?? 'Sync failed'),
  })

  if (isLoading) return <div className="text-ink-500 text-sm">{t('common.loading')}</div>
  if (!o) {
    return (
      <div className="space-y-3">
        <Link to="/admin/orders" className="text-brand-700 text-[12px]"><FontAwesomeIcon icon={faArrowLeft} /> {t('admin.orders.back')}</Link>
        <div className="card p-6 text-ink-500">{t('admin.orders.detail.not_found')}</div>
      </div>
    )
  }

  const allowed = TRANSITIONS[o.status] ?? []
  const items = o.items ?? []
  const subtotal = items.reduce((s: number, it: any) => s + (it.lineTotalCents ?? it.unitPriceCents * it.qty), 0) / 100

  async function confirmThen(message: string, action: () => void) {
    if (await dialog.confirm(message)) action()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/admin/orders" className="text-brand-700 text-[12px]">
          <FontAwesomeIcon icon={faArrowLeft} /> {t('admin.orders.back')}
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={o.status} />
          {!['PENDING', 'AWAITING_PAYMENT', 'CANCELLED'].includes(o.status) && (
            <a href={`/api/admin/orders/${o.id}/invoice.pdf`} target="_blank" rel="noopener noreferrer"
               className="btn btn-outline text-[12px]">{t('order.detail.download_invoice')}</a>
          )}
          {['FORWARDED', 'SHIPPED', 'DELIVERED'].includes(o.status) && (
            <button onClick={() => syncM.mutate()} disabled={syncM.isPending} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faRotate} className={syncM.isPending ? 'fa-spin' : ''} /> {t('tracking.sync')}
            </button>
          )}
          {allowed.includes('forward') && (
            <button onClick={() => confirmThen(t('admin.orders.confirm.forward'), () => forward.mutate())} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faPaperPlane} /> {t('admin.orders.actions.forward')}
            </button>
          )}
          {allowed.includes('ship') && (
            <button onClick={() => confirmThen(t('admin.orders.confirm.ship'), () => ship.mutate())} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faTruck} /> {t('admin.orders.actions.ship')}
            </button>
          )}
          {allowed.includes('deliver') && (
            <button onClick={() => confirmThen(t('admin.orders.confirm.deliver'), () => deliver.mutate())} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.orders.actions.deliver')}
            </button>
          )}
          {allowed.includes('refund') && (
            <button onClick={() => confirmThen(t('admin.orders.confirm.refund') ?? '¿Reembolsar esta orden al wallet del comprador?', () => refundM.mutate())} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faRotateLeft} /> {t('admin.orders.actions.refund')}
            </button>
          )}
          {allowed.includes('cancel') && (
            <button onClick={() => confirmThen(t('admin.orders.cancel_confirm'), () => cancelM.mutate())} className="btn btn-outline text-[12px] hover:border-red-300 hover:text-red-700">
              <FontAwesomeIcon icon={faBan} /> {t('admin.orders.actions.cancel')}
            </button>
          )}
        </div>
      </div>

      <TrackingTimeline tracking={tracking} />

      <header>
        <div className="text-[12px] text-ink-500">{t('admin.orders.detail.number')}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-mono">{o.orderNumber || '—'}</h1>
          {/* Origen de la orden: tienda propia vs tienda integrada (Shopify/WooCommerce). */}
          {(o as any).source && (
            <span className={`badge ${(o as any).source === 'INTEGRATION' ? 'badge-warning' : 'badge-info'} badge-sm`}>
              {(o as any).source === 'INTEGRATION'
                ? tt(t, 'admin.orders.source.integration', 'Tienda integrada')
                : tt(t, 'admin.orders.source.platform', 'Plataforma propia')}
            </span>
          )}
        </div>
        <div className="text-[12px] text-ink-500 mt-1">
          {o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}
          {o.customerEmail && ` · ${o.customerEmail}`}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DROP-632: full money breakdown — Subtotal + Shipping + Taxes = Total. */}
        <div className="card p-4 md:col-span-2">
          <div className="text-[11px] uppercase tracking-wider text-ink-600 mb-2">{t('admin.orders.detail.breakdown')}</div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-700">{t('admin.orders.detail.subtotal')}</span>
              <span className="font-medium">{format(subtotal, o.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-700">{t('admin.orders.detail.shipping')}</span>
              <span className={(o.shippingCents ?? 0) > 0 ? 'font-medium' : 'text-ink-400 italic'}>
                {(o.shippingCents ?? 0) > 0 ? format(o.shippingCents / 100, o.currency) : t('admin.orders.detail.tbd')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-700">{t('admin.orders.detail.taxes')}</span>
              <span className={(o.taxCents ?? 0) > 0 ? 'font-medium' : 'text-ink-400 italic'}>
                {(o.taxCents ?? 0) > 0 ? format(o.taxCents / 100, o.currency) : t('admin.orders.detail.tbd')}
              </span>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-1.5 mt-1.5">
              <span className="font-medium">{t('admin.orders.detail.total')}</span>
              <span className="text-xl font-semibold">{format((o.totalCents ?? 0) / 100, o.currency)}</span>
            </div>
          </div>
          <div className="text-[11px] text-ink-400 mt-2">{t('admin.orders.detail.tax_note')}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-600">{t('admin.orders.col.supplier')}</div>
          <div className="font-medium mt-1">{o.supplierName ?? '—'}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-medium text-sm mb-3">{t('admin.orders.detail.customer')}</h3>
          <div className="space-y-1 text-sm">
            <Row label={t('admin.orders.detail.email')} value={o.customerEmail} mono />
            <Row label={t('admin.orders.col.shop')}   value={o.shopName ?? o.shopHandle} />
            <Row label={t('admin.orders.detail.notes')} value={o.notes ?? '—'} />
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-medium text-sm mb-3">{t('admin.orders.detail.shipping_address')}</h3>
          {o.shippingAddress ? (
            <div className="text-sm leading-relaxed">
              <div className="font-medium">{o.shippingAddress.fullName}</div>
              <div className="text-ink-700">{o.shippingAddress.line1}</div>
              {o.shippingAddress.line2 && <div className="text-ink-700">{o.shippingAddress.line2}</div>}
              <div className="text-ink-700">
                {o.shippingAddress.postalCode} {o.shippingAddress.city}
                {o.shippingAddress.region && `, ${o.shippingAddress.region}`}
              </div>
              <div className="text-ink-700">{o.shippingAddress.country}</div>
              {o.shippingAddress.phone && <div className="text-ink-500 text-[12px] mt-1">{o.shippingAddress.phone}</div>}
            </div>
          ) : <div className="text-ink-500 text-[12px]">{t('admin.orders.detail.no_address')}</div>}
        </div>
      </section>

      {o.trackingNumber && (
        <section className="card p-4 flex items-center gap-3 text-sm">
          <FontAwesomeIcon icon={faTruck} className="text-brand-600" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-600">{t('admin.orders.detail.tracking')}</div>
            <div className="font-mono">{o.trackingNumber}</div>
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="card-header"><span>{t('admin.orders.detail.items')}</span></div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.orders.detail.product')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.orders.detail.sku')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.orders.detail.qty')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.orders.detail.unit_price')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.orders.detail.line_total')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? items.map((it: any) => (
              <tr key={it.id} className="border-t border-ink-100">
                <td className="px-4 py-2">
                  <span>{it.title ?? it.sku ?? '—'}</span>
                  {/* DROP: URL de la ficha original del producto, para que el operador la abra al procesar. */}
                  {it.productSourceUrl && (
                    <a href={it.productSourceUrl} target="_blank" rel="noopener noreferrer"
                       className="ml-2 text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> {tt(t, 'admin.orders.detail.view_product', 'Ver producto')}
                    </a>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-ink-500">{it.sku || '—'}</td>
                <td className="px-4 py-2 text-right">{it.qty}</td>
                <td className="px-4 py-2 text-right">{format(it.unitPriceCents / 100, o.currency)}</td>
                <td className="px-4 py-2 text-right font-medium">{format((it.lineTotalCents ?? it.unitPriceCents * it.qty) / 100, o.currency)}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-500">{t('admin.orders.detail.no_items')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  // DROP-566: text-ink-500 sobre fondo claro daba contraste ~3.7:1 → labels
  // se veían "lavados". Subimos a ink-700 para WCAG AA y mejor legibilidad.
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-ink-700">{label}</span>
      <span className={`font-medium text-right ${mono ? 'font-mono text-[12px]' : ''}`}>{value || '—'}</span>
    </div>
  )
}

function toast(message: string) {
  // Lightweight feedback — replace with a real toast lib when we add one.
  const node = document.createElement('div')
  node.textContent = message
  node.className = 'fixed bottom-4 right-4 z-[100] px-4 py-2 rounded-md bg-ink-900 text-white text-[13px] shadow-lg'
  document.body.appendChild(node)
  setTimeout(() => node.remove(), 2200)
}
