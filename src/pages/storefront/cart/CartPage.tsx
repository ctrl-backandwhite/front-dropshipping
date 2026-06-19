import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '../../../store/cart'
import { useCartQuote } from '../../../hooks/useCartQuote'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan, faMinus, faPlus, faCartShopping } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../../store/locale'

/** i18n estricto: devuelve el fallback si la clave no está traducida aún. */
function tt(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key)
  return v === key ? fallback : v
}

// DROP-636: SKU SIEMPRE — el resuelto de la línea; si no, el variantId (base
// del producto/variante) recortado como último recurso para no dejar la fila
// sin identificador.
function lineSku(l: any): string {
  if (l.sku && String(l.sku).trim() !== '') return String(l.sku)
  if (l.variantId) return String(l.variantId).slice(0, 8)
  return String(l.productId).slice(0, 8)
}

export default function CartPage() {
  const t = useT()
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const navigate = useNavigate()
  // DROP-637: precio EN VIVO re-cotizado y FORMATEADO por el backend (margen + tasa del día), idéntico
  // al checkout y al drawer. El front solo pinta el string del backend; no convierte ni formatea.
  const { unitText, lineTotalText, subtotalText, activeCurrency } = useCartQuote(lines)

  if (lines.length === 0) {
    return (
      <div className="hero max-w-2xl mx-auto py-10">
        <div className="hero-content text-center flex-col">
          <FontAwesomeIcon icon={faCartShopping} className="text-4xl opacity-30 mb-2" />
          <h1>{t('cart.empty')}</h1>
          <p className="text-sm opacity-70">{t('cart.empty.desc')}</p>
          <Link to="/catalog" className="btn btn-primary mt-2">{t('cart.see_catalog')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1>{t('cart.title')}</h1>
      <div className="card overflow-hidden bg-base-100">
        <table className="table table-zebra table-sm">
          <thead className="bg-base-200 text-base-content/70 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('cart.col.product')}</th>
              <th className="px-4 py-2 font-medium hidden sm:table-cell">{t('cart.col.price')}</th>
              <th className="px-4 py-2 font-medium">{t('cart.col.qty')}</th>
              <th className="px-4 py-2 font-medium">{t('cart.col.subtotal')}</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.productId + (l.variantId ?? '')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {l.image && (
                      <div className="avatar">
                        <div className="w-12 h-12 rounded">
                          <img src={l.image} alt="" />
                        </div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link to={`/catalog/${l.slug}`} className="text-sm font-medium hover:text-primary line-clamp-2">{l.title}</Link>
                      {(l as any).variantLabel && (
                        <div className="text-[11px] opacity-70">{(l as any).variantLabel}</div>
                      )}
                      <div className="text-[11px] opacity-60">SKU: <code className="font-mono">{lineSku(l)}</code></div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">{unitText(l)}</td>
                <td className="px-4 py-3">
                  <div className="join">
                    <button onClick={() => setQty(l.productId, l.variantId, l.quantity - 1)} className="btn btn-xs join-item"><FontAwesomeIcon icon={faMinus} /></button>
                    <span className="btn btn-xs join-item no-animation pointer-events-none">{l.quantity}</span>
                    <button onClick={() => setQty(l.productId, l.variantId, l.quantity + 1)} className="btn btn-xs join-item"><FontAwesomeIcon icon={faPlus} /></button>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{lineTotalText(l)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => remove(l.productId, l.variantId)} className="btn btn-ghost btn-xs btn-square text-error" aria-label={t('cart.remove')}><FontAwesomeIcon icon={faTrashCan} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DROP-636: desglose claro. Envío e impuestos aún NO los calcula el
          backend → los mostramos como "por calcular" en vez de inventar importes.
          El total estimado = subtotal mientras envío/impuestos estén sin calcular. */}
      <div className="card bg-base-100 shadow">
        <div className="card-body gap-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="opacity-70">{t('cart.subtotal')}</dt>
              <dd className="font-medium">{subtotalText}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="opacity-70">{tt(t, 'cart.shipping_estimated', 'Estimated shipping')}</dt>
              <dd className="opacity-60 italic">{tt(t, 'cart.to_be_calculated', 'To be calculated')}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="opacity-70">{tt(t, 'cart.taxes_estimated', 'Estimated taxes')}</dt>
              <dd className="opacity-60 italic">{tt(t, 'cart.to_be_calculated', 'To be calculated')}</dd>
            </div>
            <div className="divider my-1" />
            <div className="flex items-baseline justify-between">
              <dt className="font-medium">{tt(t, 'cart.estimated_total', 'Estimated total')} ({activeCurrency})</dt>
              <dd className="text-2xl font-medium">{subtotalText}</dd>
            </div>
            <p className="text-[11px] opacity-60 pt-1">
              {tt(t, 'cart.taxes_note', 'Shipping and taxes are calculated at checkout based on destination.')}
            </p>
          </dl>
          <div className="card-actions justify-end">
            <Link to="/catalog" className="btn btn-outline">{t('cart.keep_shopping')}</Link>
            <button onClick={() => navigate('/checkout')} className="btn btn-primary">{t('cart.go_checkout')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
