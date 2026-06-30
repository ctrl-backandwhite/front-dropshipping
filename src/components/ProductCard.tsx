import { Link, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar, faFire, faTruckFast, faShield, faBolt, faCartPlus, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import type { ProductSummary } from '../api/catalog'
import { getProduct } from '../api/catalog'
import { useCartStore } from '../store/cart'
import { useCurrencyStore } from '../store/currency'
import { useT, useLocaleStore } from '../store/locale'
import { SafeImage } from './Placeholder'
import { flyToCart } from '../lib/flyToCart'
import { useState } from 'react'

export function ProductCard({ product }: { product: ProductSummary }) {
  const t = useT()
  const location = useLocation()
  const format = useCurrencyStore((s) => s.format)
  const cartAdd = useCartStore((s) => s.add)
  const locale = useLocaleStore((s) => s.locale)
  // DROP-440: quick-add desde la tarjeta sin abrir el PDP.
  const [justAdded, setJustAdded] = useState(false)
  async function quickAdd(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    // DROP-637: efecto visual "volar al carrito" desde el botón con la imagen del producto.
    flyToCart(e.currentTarget as HTMLElement, product.mainImage)
    // El listado no trae variantes; traemos el detalle para añadir la PRIMERA variante por defecto
    // (color/talla) — igual que en la ficha — y que el carrito muestre la variante, no solo el producto.
    let variantId: string | undefined
    let variantLabel: string | undefined
    let sku: string | undefined
    let srcPrice = Number(product.basePrice ?? 0)
    try {
      const detail = await getProduct(product.slug, locale)
      const v = detail.variants?.[0]
      if (v) {
        variantId = v.id
        sku = v.sku ?? undefined
        variantLabel = v.options
          ? Object.values(v.options).filter(Boolean).join(' / ') || undefined
          : undefined
        if (v.price != null) srcPrice = Number(v.price)
      }
    } catch { /* si falla la cotización del detalle, añadimos sin variante (fallback) */ }
    cartAdd({
      productId: product.id,
      variantId,
      sku,
      variantLabel,
      slug: product.slug,
      title: product.title,
      image: product.mainImage,
      unitPriceSource: srcPrice,
      sourceCurrency: product.currency ?? 'USD',
      // Precio de display de la tarjeta (en moneda activa); el carrito lo re-cotiza en vivo por variante.
      unitPriceDisplay: product.displayPrice,
      displayCurrency: product.displayCurrency,
      quantity: 1,
    })
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1400)
  }
  // Preserve the admin context when browsing from inside the admin layout.
  const detailPath = location.pathname.startsWith('/admin/browse')
    ? `/admin/browse/${product.slug}`
    : `/catalog/${product.slug}`
  const monthly = Number(product.monthlySales ?? 0)
  const monthlyDisplay = monthly > 9999 ? `${(monthly / 1000).toFixed(1)}k` : String(monthly)
  // DROP-270: bestseller threshold raised — only the top tier earns the badge.
  // A product is "Bestseller" if monthly sales >= 5000 OR if the backend tagged it.
  const tags = ((product as any).tags ?? []) as string[]
  const isBestseller = (Array.isArray(tags) && tags.includes('bestseller')) || monthly >= 5000
  const isNew = (product as any).newArrival === true
  return (
    <Link
      to={detailPath}
      className="card overflow-hidden transition-all duration-1000 hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5 group focus-ring"
    >
      <div className="relative">
        <SafeImage src={product.mainImage} alt={product.title}
                   className="aspect-square w-full object-cover transition-transform duration-1000 group-hover:scale-[1.03]"
                   fallbackClassName="aspect-square w-full" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isBestseller && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500 text-white shadow-sm">
              <FontAwesomeIcon icon={faFire} className="text-[9px]" /> {t('product.badge.bestseller')}
            </span>
          )}
          {isNew && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-600 text-white shadow-sm">
              {t('product.badge.new')}
            </span>
          )}
          {(product as any).freeShipping && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-600 text-white shadow-sm">
              <FontAwesomeIcon icon={faTruckFast} className="text-[9px]" />
            </span>
          )}
          {(product as any).readyToShip && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/95 text-ink-700 border border-ink-200 shadow-sm">
              <FontAwesomeIcon icon={faBolt} className="text-[9px] text-amber-500" /> {t('product.badge.ready')}
            </span>
          )}
        </div>

        {(product as any).brandSelected && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/95 text-brand-700 border border-brand-200 shadow-sm">
            <FontAwesomeIcon icon={faShield} className="text-[9px]" /> {t('product.badge.brand')}
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm line-clamp-2 min-h-[2.5rem] group-hover:text-brand-700">{product.title}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="font-semibold text-brand-700">
            {/* DROP-637: precio FORMATEADO por el backend (margen + tasa de BD). El front solo pinta.
                Antes se pintaba product.basePrice (coste en CNY) convertido en cliente → sin margen. */}
            {product.displayFormatted
              ? product.displayFormatted
              : product.displayPrice != null
                ? format(product.displayPrice, product.displayCurrency)
                : product.basePrice != null ? format(Number(product.basePrice), product.currency ?? 'CNY') : '—'}
          </span>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            {product.rating != null && (
              <span className="flex items-center gap-0.5">
                <FontAwesomeIcon icon={faStar} className="text-amber-400" />
                {Number(product.rating).toFixed(1)}
              </span>
            )}
            {monthly > 0 && (
              <span className="flex items-center gap-0.5">
                <FontAwesomeIcon icon={faFire} className="text-amber-500" />
                {monthlyDisplay}
              </span>
            )}
          </div>
        </div>
        {/* DROP-440: Quick-add — visible al hover, oculto en mobile (long-press alternativo) */}
        <button type="button" onClick={quickAdd}
                className={`btn btn-xs w-full mt-2 ${justAdded ? 'btn-success' : 'btn-outline'} opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity`}>
          <FontAwesomeIcon icon={justAdded ? faCircleCheck : faCartPlus} className="text-[11px]" />
          {justAdded ? t('product.added') : t('product.add_to_cart')}
        </button>
      </div>
    </Link>
  )
}
