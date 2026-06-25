import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faTrash, faCartShopping, faArrowRight, faBoxOpen } from '@fortawesome/free-solid-svg-icons'
import { useCartStore } from '../store/cart'
import { useCartQuote } from '../hooks/useCartQuote'
import { useT } from '../store/locale'
import { SafeImage } from './Placeholder'

/**
 * Cart drawer. State lives in the global cart store so any layout (storefront
 * or admin) can open it without prop-drilling.
 */
export function CartDrawer() {
  const t = useT()
  const lines = useCartStore((s) => s.lines)
  const open = useCartStore((s) => s.drawerOpen)
  const onClose = useCartStore((s) => s.closeDrawer)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  // DROP-637: precio EN VIVO re-cotizado y FORMATEADO por el backend (margen + tasa del día), idéntico al
  // checkout y a lo que se cobra. El front solo pinta el string del backend; no convierte ni formatea.
  const { lineTotalText, subtotalText } = useCartQuote(lines)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t('cart.title')}>
      <div className="absolute inset-0 bg-black/40 animate-[fade-in_500ms_ease-out]" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md bg-base-100 shadow-xl flex flex-col animate-[slide-in-right_500ms_ease-out]"
      >
        <header className="navbar bg-base-100 border-b border-base-200 min-h-14 px-5">
          <h2 className="flex-1 font-medium flex items-center gap-2">
            <FontAwesomeIcon icon={faCartShopping} className="text-primary" />
            {t('cart.title')}
            {lines.length > 0 && (
              <span className="text-[12px] opacity-60 font-normal">({lines.reduce((n, l) => n + l.quantity, 0)})</span>
            )}
          </h2>
          <button onClick={onClose} aria-label={t('cart.close')} className="btn btn-ghost btn-sm btn-square">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
          {lines.length === 0 ? (
            <div className="hero py-16">
              <div className="hero-content text-center flex-col">
                <FontAwesomeIcon icon={faBoxOpen} className="text-4xl opacity-30 mb-3" />
                <p className="font-medium">{t('cart.empty.title')}</p>
                <p className="text-[12px] opacity-70 mt-1">{t('cart.empty.body')}</p>
                <Link to="/catalog" onClick={onClose} className="btn btn-outline btn-sm mt-2">
                  {t('cart.empty.cta')}
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={`${l.productId}:${l.variantId ?? ''}`} className="flex gap-3 border-b border-base-200 pb-3 last:border-b-0">
                  <Link to={`/catalog/${l.slug}`} onClick={onClose} className="shrink-0">
                    <SafeImage src={l.image} alt={l.title}
                               className="w-16 h-16 rounded-md object-cover"
                               fallbackClassName="w-16 h-16 rounded-md" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/catalog/${l.slug}`} onClick={onClose}
                          className="text-[13px] font-medium line-clamp-2 hover:text-primary">{l.title}</Link>
                    {/* Variante seleccionada (color / talla) + SKU, visible en el carrito. */}
                    {(l.variantLabel || l.sku) && (
                      <div className="text-[11px] opacity-60 mt-0.5 truncate">
                        {l.variantLabel}
                        {l.variantLabel && l.sku ? ' · ' : ''}
                        {l.sku ? `SKU ${l.sku}` : ''}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="join">
                        <button onClick={() => setQty(l.productId, l.variantId, l.quantity - 1)}
                                aria-label="Decrease" className="btn btn-xs join-item">−</button>
                        <span className="btn btn-xs join-item no-animation pointer-events-none">{l.quantity}</span>
                        <button onClick={() => setQty(l.productId, l.variantId, l.quantity + 1)}
                                aria-label="Increase" className="btn btn-xs join-item">+</button>
                      </div>
                      <span className="text-[13px] font-medium">
                        {lineTotalText(l)}
                      </span>
                    </div>
                    <button onClick={() => remove(l.productId, l.variantId)}
                            className="text-[11px] text-red-500 hover:text-red-600 hover:underline mt-1 inline-flex items-center gap-1">
                      <FontAwesomeIcon icon={faTrash} /> {t('cart.remove')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <footer className="border-t border-base-200 px-5 py-4 space-y-3">
            <div className="stat px-0 py-1">
              <div className="stat-title text-[11px]">{t('cart.subtotal')}</div>
              <div className="stat-value text-2xl">{subtotalText}</div>
            </div>
            <Link to="/checkout" onClick={onClose} className="btn btn-primary w-full">
              {t('cart.checkout')} <FontAwesomeIcon icon={faArrowRight} />
            </Link>
            <Link to="/cart" onClick={onClose} className="btn btn-outline btn-sm w-full text-[12px]">
              {t('cart.view_full')}
            </Link>
          </footer>
        )}
      </aside>
    </div>
  )
}
