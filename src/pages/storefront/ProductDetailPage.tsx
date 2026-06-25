import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { getProduct, getProductAttributes, getProductSpecifications, listStorefrontProducts, listReviews, createReview } from '../../api/catalog'
import { useLocaleStore } from '../../store/locale'
import { translateVariantCN, colorToCss } from '../../i18n/colorTerms'
import { useCartStore } from '../../store/cart'
import { useCurrencyStore } from '../../store/currency'
import { useAuthStore } from '../../store/auth'
import { flyToCart } from '../../lib/flyToCart'
import { sanitizeHtml } from '../../lib/sanitize'
import { useT } from '../../store/locale'
import { toast } from '../../store/toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCartPlus, faBolt, faCircleCheck, faTruck, faRotateLeft, faGlobe, faCircleInfo,
  faIndustry, faStar, faShieldHalved, faMinus, faPlus, faShop, faChevronLeft, faChevronRight,
  faPlay, faCircleExclamation, faArrowLeft,
} from '@fortawesome/free-solid-svg-icons'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Reveal } from '../../components/Motion'
import { SectionBoundary } from '../../components/ErrorBoundary'

// DROP-363: cargar charts/margin sólo cuando el usuario abre la sección Details.
// Resiliencia ante "chunk obsoleto" tras un despliegue: si el import dinámico falla porque el
// hash del bundle cambió (la pestaña conserva un index.html viejo), se recarga la página una sola
// vez para tomar el manifiesto nuevo, evitando el error "Failed to fetch dynamically imported module".
function lazyWithReload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy<T>(() => factory().catch((err) => {
    const key = 'chunk-reload-' + String(err?.message || '').slice(0, 40)
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      window.location.reload()
    }
    throw err
  }))
}
const PriceHistoryChart = lazyWithReload(() => import('../../components/PriceHistoryChart').then((m) => ({ default: m.PriceHistoryChart })))
const MarginEstimate    = lazyWithReload(() => import('../../components/MarginEstimate').then((m) => ({ default: m.MarginEstimate })))

type Tab = 'reviews' | 'attributes' | 'packing' | 'details' | 'recommend'

/** DROP-358: helper de i18n estricto — devuelve el fallback en idioma del usuario y nunca expone keys crudas. */
function tt(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key)
  return v === key ? fallback : v
}

export default function ProductDetailPage() {
  const t = useT()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const locale = useLocaleStore((s) => s.locale)
  const { data: p, isLoading, isError, error } = useQuery({
    queryKey: ['product', slug, locale],
    queryFn: () => getProduct(slug, locale),
    enabled: !!slug,
    retry: false,
  })
  // DROP-410/443: cargar especificaciones del idioma activo. El backend tiene
  // 6-9 por producto en es/en — caemos al ES cuando la respuesta venga vacía
  // (p.ej. para fr/de/it/nl que aún no están poblados).
  const { data: specsLive } = useQuery({
    queryKey: ['product-specs', p?.id, locale],
    queryFn: async () => {
      const primary = await getProductSpecifications(p!.id, locale)
      if (primary.length > 0) return primary
      // Fallback a ES si el idioma activo no tiene specs todavía.
      return getProductSpecifications(p!.id, 'es')
    },
    enabled: !!p?.id,
    staleTime: 5 * 60_000,
  })
  const { data: attrsLive } = useQuery({
    queryKey: ['product-attrs', p?.id, locale],
    queryFn: () => getProductAttributes(p!.id, locale),
    enabled: !!p?.id,
    staleTime: 5 * 60_000,
  })
  const [activeImage, setActiveImage] = useState(0)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [qtyBySize, setQtyBySize] = useState<Record<string, number>>({})
  const [singleQty, setSingleQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('reviews')

  // DROP-409: scroll-spy real — observa qué sección #tab-* está en viewport
  // y sincroniza activeTab para resaltar la pestaña correcta al hacer scroll.
  useEffect(() => {
    const ids: Tab[] = ['reviews', 'attributes', 'packing', 'details', 'recommend']
    const targets = ids
      .map((id) => ({ id, el: document.getElementById('tab-' + id) }))
      .filter((x) => x.el)
    if (targets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio - a.intersectionRatio))
        if (visible[0]) {
          const id = visible[0].target.id.replace('tab-', '') as Tab
          setActiveTab(id)
        }
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    targets.forEach((t) => observer.observe(t.el!))
    return () => observer.disconnect()
  }, [])
  // DROP-635: la cantidad inicial debe respetar el MOQ (pedido mínimo). Si el
  // producto tiene "Pedido mín. 5", arrancamos en 5 — no en 1.
  useEffect(() => {
    if (p?.moq && p.moq > 1) setSingleQty((q) => (q < p.moq ? p.moq : q))
  }, [p?.id, p?.moq])

  const cartAdd = useCartStore((s) => s.add)
  const openCartDrawer = useCartStore((s) => s.openDrawer)
  // Solo ADMIN ve el estimado de margen/ganancia. OPERATOR (soporte) y USER no.
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')
  const isAuthed = useAuthStore((s) => !!s.user)
  const currencies = useCurrencyStore((s) => s.currencies)
  const currencyCode = useCurrencyStore((s) => s.current)
  const format = useCurrencyStore((s) => s.format)
  const convert = useCurrencyStore((s) => s.convert)

  // DROP-363: prefetch del listado recommend en background.
  const { data: recommend } = useQuery({
    queryKey: ['storefront-products', 'recommend'],
    queryFn: () => listStorefrontProducts(0, 8),
    enabled: !!p,
    staleTime: 60_000,
  })

  // DROP-344: precio efectivo según tier por cantidad total.
  // IMPORTANTE: este useMemo va ANTES de los early returns para no violar
  // las Rules of Hooks (el orden de hooks debe ser estable entre renders).
  const totalQtyForTier = p ? Object.values(qtyBySize).reduce((s, n) => s + (n || 0), 0) || singleQty : 0
  const activeTier = useMemo(() => {
    if (!p) return null
    const tiers = p.priceTiers ?? []
    if (tiers.length === 0) return null
    const match = [...tiers]
      .sort((a, b) => a.minQty - b.minQty)
      .filter((tier) => totalQtyForTier >= tier.minQty)
      .pop()
    return match ?? null
  }, [p, totalQtyForTier])

  // DROP-679: meta tags dinámicos por idioma a partir del SEO real generado al publicar.
  // Se actualizan <title>, meta description y las etiquetas Open Graph; se restauran al desmontar.
  useEffect(() => {
    if (!p) return
    const setMeta = (sel: string, attr: string, val: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel)
      if (!el) {
        el = document.createElement('meta')
        const [k, v] = attr.split('=')
        el.setAttribute(k, v.replace(/"/g, ''))
        document.head.appendChild(el)
      }
      el.setAttribute('content', val)
    }
    const title = (p as any).metaTitle || p.title || 'NX036'
    const desc = (p as any).metaDescription || (p as any).shortDescription || p.description || ''
    const image = (p.images ?? []).find((i: any) => i.role === 'MAIN')?.cdnUrl || (p.images ?? [])[0]?.cdnUrl || ''
    const prevTitle = document.title
    document.title = title
    setMeta('meta[name="description"]', 'name="description"', desc)
    setMeta('meta[property="og:title"]', 'property="og:title"', title)
    setMeta('meta[property="og:description"]', 'property="og:description"', desc)
    setMeta('meta[property="og:type"]', 'property="og:type"', 'product')
    if (image) setMeta('meta[property="og:image"]', 'property="og:image"', image)
    setMeta('meta[property="og:url"]', 'property="og:url"', window.location.href)
    return () => { document.title = prevTitle }
  }, [p])

  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-[1fr_22rem] gap-8" aria-busy="true">
        <div className="space-y-3">
          <div className="aspect-square w-full skeleton" />
          <div className="grid grid-cols-6 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square skeleton" />)}</div>
        </div>
        <div className="space-y-3">
          <div className="h-8 w-3/4 skeleton" />
          <div className="h-12 w-1/2 skeleton" />
          <div className="h-24 w-full skeleton" />
        </div>
      </div>
    )
  }
  if (isError || !p) {
    const msg = (error as any)?.response?.status === 404
      ? tt(t, 'product.not_found', 'Product not found')
      : tt(t, 'product.load_error', 'Could not load this product')
    return (
      <div className="card max-w-xl mx-auto">
        <div className="card-body items-center text-center">
          <FontAwesomeIcon icon={faCircleExclamation} className="text-3xl text-warning" />
          <h2 className="card-title mt-2">{msg}</h2>
          <p className="text-sm opacity-70">
            <code className="font-mono text-[12px]">{slug}</code>
          </p>
          <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm mt-2">
            {tt(t, 'common.back', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  const product = p
  const imgs = product.images ?? []
  const videoImg = imgs.find((i) => i.role === 'video')

  // DROP-346/347: descomponer variantOptions en color/size cuando exista.
  const colorOption = product.variantOptions?.find((o) => /color|colour|颜色/i.test(o.name ?? o.nameZh ?? ''))
  const sizeOption  = product.variantOptions?.find((o) => /size|talla|尺码|尺寸/i.test(o.name ?? o.nameZh ?? ''))

  // La galería = imágenes del producto + las imágenes propias de cada color que no estén ya,
  // así cada color real tiene su foto y seleccionarlo cambia la imagen principal.
  const galleryImgs = (() => {
    const base = imgs.filter((i) => i.role !== 'video')
    const have = new Set<string>()
    base.forEach((i) => { if (i.cdnUrl) have.add(i.cdnUrl); if (i.sourceUrl) have.add(i.sourceUrl) })
    const extra: any[] = []
    ;(colorOption?.values ?? []).forEach((v: any, k: number) => {
      const u = v.imageUrl
      if (u && !have.has(u)) { have.add(u); extra.push({ id: `color-${k}`, role: 'gallery', sourceUrl: u, cdnUrl: u, position: 900 + k }) }
    })
    return [...base, ...extra]
  })()
  const mainImg = galleryImgs[activeImage]?.cdnUrl || galleryImgs[activeImage]?.sourceUrl

  // Al elegir un color, cambia la imagen principal a la de ese color (si tiene imagen propia).
  const handlePickColor = (label: string, imageUrl?: string) => {
    setActiveColor(label)
    if (imageUrl) {
      const idx = galleryImgs.findIndex((g) => g.cdnUrl === imageUrl || g.sourceUrl === imageUrl)
      if (idx >= 0) setActiveImage(idx)
    }
  }

  // DROP-408/414: priorizar displayPrice (convertido a la divisa del usuario)
  // sobre basePrice (que viene en CNY del proveedor). El tier activo manda si lo hay.
  const displayCurrency = (product as any).displayCurrency ?? product.currency ?? 'CNY'
  // DROP-637: keep the base amount paired with the RIGHT currency. displayPrice/retailUsd are
  // already in displayCurrency; only the basePrice fallback is in the product's SOURCE currency
  // (CNY). Labelling the source amount with displayCurrency was the root of the 117,26 € mismatch.
  const hasDisplayPrice = (product as any).displayPrice != null || (product as any).retailUsd != null
  const displayBase = Number((product as any).displayPrice
                          ?? (product as any).retailUsd
                          ?? product.basePrice
                          ?? 0)
  const productCcy = hasDisplayPrice ? displayCurrency : (product.currency ?? 'CNY')

  const totalQty = sizeOption
    ? Object.values(qtyBySize).reduce((s, n) => s + (n || 0), 0)
    : singleQty
  // DROP-635: precio destacado COHERENTE. Una única fuente de verdad:
  //  - Si hay tramos (priceTiers), el destacado debe ser el tramo APLICABLE a la
  //    cantidad (que arranca en el MOQ). Cada tramo trae SU PROPIA moneda, así que
  //    el precio y la moneda van siempre emparejados (antes el destacado podía salir
  //    en CNY etiquetado como EUR → "0,63 EUR" incoherente).
  //  - Si no hay tramos, usamos displayPrice (precio publicado ya corregido por el
  //    backend de pricing) en su displayCurrency.
  // DROP-637: the headline/cart price must equal what the order charges = the SELECTED
  // variant's price. Tiers are a quantity-break hint, not the per-unit charge. Fall back to the
  // tier/displayPrice only while no variant is chosen (or there are no variants).
  const selectedVariant = activeColor ? variantFor(activeColor) : (product.variants?.length === 1 ? product.variants[0] : undefined)
  const featuredPrice    = selectedVariant?.price != null ? Number(selectedVariant.price) : (activeTier?.unitPrice ?? displayBase)
  const featuredCurrency = selectedVariant?.price != null ? displayCurrency : (activeTier?.currency ?? productCcy)

  function variantFor(color: string | null, sizeValue?: string) {
    return product.variants?.find((v) => {
      const opts = v.options ?? {}
      const okColor = !color || Object.values(opts).includes(color)
      const okSize  = !sizeValue || Object.values(opts).includes(sizeValue)
      return v.active && okColor && okSize
    })
  }

  function sizeStock(sizeValue: string) {
    return variantFor(activeColor, sizeValue)?.stock ?? 0
  }

  function setSizeQty(sizeValue: string, n: number) {
    const stock = sizeStock(sizeValue)
    const clamped = Math.max(0, Math.min(stock, n))
    setQtyBySize((s) => ({ ...s, [sizeValue]: clamped }))
  }

  // DROP-348/635: 3 CTAs con MOQ + variante. La confirmación usa el toast store.
  function pushLine(qty: number, variant?: { id?: string; sku?: string; options?: Record<string, string> }) {
    // DROP-636: resolvemos el SKU SIEMPRE — el de la variante si existe; si no,
    // el SKU base del producto. Así el carrito nunca queda sin SKU visible.
    const resolvedSku = variant?.sku || (product as any).sku || undefined
    const variantLabel = variant?.options
      ? Object.values(variant.options).filter(Boolean).join(' / ') || undefined
      : (activeColor ?? undefined)
    // DROP-637: freeze THIS variant's price (what the order will charge), not the tier headline.
    const fullVariant = variant?.id ? product.variants?.find((v) => v.id === variant.id) : undefined
    const linePrice = fullVariant?.price != null ? Number(fullVariant.price) : Number(featuredPrice)
    const lineCurrency = fullVariant?.price != null ? displayCurrency : featuredCurrency
    cartAdd({
      productId: product.id,
      variantId: variant?.id,
      sku: resolvedSku,
      variantLabel,
      slug: product.slug,
      title: product.title,
      image: mainImg || undefined,
      // Precio+moneda de la variante comprada (coherente con el destacado y con el checkout).
      unitPriceSource: linePrice,
      sourceCurrency: lineCurrency,
      // DROP-637: freeze the EXACT display price in the active currency, so the drawer, cart and
      // checkout all show this same number (no per-view re-conversion drift).
      unitPriceDisplay: Number(convert(linePrice, lineCurrency).toFixed(2)),
      displayCurrency: currencyCode,
      moq: product.moq && product.moq > 1 ? product.moq : undefined,
      quantity: qty,
    })
  }

  // DROP-635: ¿el producto exige elegir variante (color) antes de añadir?
  const hasColorVariants = !!colorOption && (colorOption.values?.length ?? 0) > 0
  const needsColor = hasColorVariants && !activeColor

  function addAll(): boolean {
    // DROP-635: variante obligatoria. Si hay colores y no se ha elegido, avisar.
    if (needsColor) {
      toast.warning(tt(t, 'product.select_variant', 'Please select a variant before adding to cart.'))
      return false
    }
    // DROP-635: MOQ. Nunca permitir añadir por debajo del pedido mínimo.
    if (product.moq && totalQty < product.moq) {
      toast.warning(
        tt(t, 'product.moq_required', 'Minimum order is {moq} units.').replace('{moq}', String(product.moq)),
      )
      return false
    }
    if (sizeOption) {
      const lines = Object.entries(qtyBySize).filter(([, q]) => q > 0)
      if (lines.length === 0) {
        toast.warning(tt(t, 'product.pick_size', 'Pick at least one size'))
        return false
      }
      lines.forEach(([sizeValue, qty]) => {
        const v = variantFor(activeColor, sizeValue)
        pushLine(qty, v)
      })
    } else {
      pushLine(singleQty, variantFor(activeColor))
    }
    // Tras añadir, reseteamos las cantidades para que la SIGUIENTE variante
    // (p. ej. otro color del mismo producto) empiece en 0 y no arrastre lo ya añadido.
    setQtyBySize({})
    setSingleQty(product.moq && product.moq > 1 ? product.moq : 1)
    setAdded(true)
    // DROP-637: efecto "volar al carrito" desde la imagen principal; el drawer se abre tras el vuelo
    // (~650ms) para que la animación sea visible antes de que el panel cubra la barra.
    flyToCart(document.getElementById('nx-pdp-main-img'), mainImg || undefined)
    // DROP-635: confirmación real (toast) + abrir el carrito para feedback visible
    // y que el contador del header se actualice.
    toast.success(
      tt(t, 'cart.added', 'Added {qty}× {title} to cart.')
        .replace('{qty}', String(totalQty))
        .replace('{title}', product.title),
      { action: { label: tt(t, 'cart.view', 'View cart'), onClick: () => navigate('/cart') } },
    )
    setTimeout(() => openCartDrawer(), 650)
    setTimeout(() => setAdded(false), 2000)
    return true
  }

  // "Comprar ahora": si hay sesión, va directo al checkout. Si NO la hay, NO forzamos
  // el login aquí (eso desconcierta a quien solo está llenando el carrito): lo llevamos
  // al carrito y el login solo aparecerá cuando pulse checkout desde ahí.
  function orderNow() { if (addAll()) navigate(isAuthed ? '/checkout' : '/cart') }
  function dropship() {
    // DROP-349: dropship = añadir al carrito + redirigir al wizard de import en /admin.
    if (addAll()) navigate(`/admin/catalog?focus=${product.id}`)
  }

  const inStock = (product.variants?.reduce((s, v) => s + (v.active ? v.stock : 0), 0) ?? 0) > 0
  const symbol = currencies.find((c) => c.code === productCcy)?.symbol ?? ''
  void symbol

  return (
    <>
      {/* DROP: en MÓVIL los breadcrumbs quedan poco visibles; mostramos un control "Volver
          al catálogo" claro y táctil. En sm+ se ocultan y mandan los breadcrumbs de siempre. */}
      <Link to="/catalog"
            className="sm:hidden inline-flex items-center gap-2 mb-3 text-sm font-medium text-primary hover:underline">
        <FontAwesomeIcon icon={faArrowLeft} className="text-[12px]" />
        {tt(t, 'common.back_to_catalog', 'Back to catalog')}
      </Link>

      <div className="hidden sm:block">
        <Breadcrumbs items={[
          // DROP-364: breadcrumb del PDP incluye categoría + título.
          { label: tt(t, 'breadcrumb.catalog', 'Catalog'), to: '/catalog' },
          { label: product.title },
        ]} />
      </div>

      {/* =================== HEADER PDP (1688 layout) =================== */}
      {/* Móvil: flex-col con `order` para el orden pedido (título → imagen → variantes →
          precio → resto). Desktop (lg): grid de 2 columnas idéntico al de siempre; el
          <aside> usa `display:contents` en móvil para que sus hijos sean items del flex
          y `order` los recoloque, y vuelve a ser una columna normal en lg (order-none). */}
      <section className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 lg:items-start animate-fade-up">

        {/* Galería: DROP-342 carousel + thumbs + video. */}
        <div className="order-2 lg:order-none">
          <Gallery
            imgs={galleryImgs}
            videoUrl={videoImg?.sourceUrl}
            active={activeImage}
            onActive={setActiveImage}
            title={product.title}
            t={t}
          />
        </div>

        {/* Panel derecho (info + CTAs) */}
        <aside className="contents lg:flex lg:flex-col lg:gap-4">
          <header className="order-1 lg:order-none">
            <div className="flex items-center gap-2 flex-wrap">
              {product.brand && <span className="badge badge-ghost">{product.brand}</span>}
              {product.rating != null && (
                <span className="inline-flex items-center gap-1 text-warning text-[13px]">
                  <FontAwesomeIcon icon={faStar} /> {Number(product.rating).toFixed(1)}
                  <span className="opacity-60 text-[12px]">({product.reviewCount ?? 0})</span>
                </span>
              )}
              {(product as any).sku && (
                <span className="text-[12px] opacity-60">SKU <code className="font-mono">{(product as any).sku}</code></span>
              )}
              {/* El código EXT y el ORIGEN (1688/Taobao/…) NO se muestran al cliente: van en el bloque admin de abajo. */}
            </div>
            <h1 className="text-lg sm:text-2xl font-medium mt-1.5 leading-snug">{product.title}</h1>
          </header>

          {/* === Solo ADMIN: origen del producto + compra en la plataforma de origen === */}
          {isAdmin && (
            <div className="order-1 lg:order-none rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-[12px]">
                <span className="badge badge-warning badge-sm gap-1">
                  <FontAwesomeIcon icon={faShop} /> {tt(t, 'admin.product.origin', 'Origen')}: <strong className="capitalize">{product.source}</strong>
                </span>
                <span className="opacity-70">EXT <code className="font-mono">{product.externalId}</code></span>
              </div>
              {product.sourceUrl && (
                <a href={product.sourceUrl} target="_blank" rel="noreferrer"
                   className="btn btn-sm btn-warning btn-outline gap-2 w-full sm:w-auto">
                  <FontAwesomeIcon icon={faShop} />
                  {tt(t, 'admin.product.buy_at_origin', 'Comprar en origen')} ({product.source})
                </a>
              )}
              <p className="text-[11px] opacity-60 leading-snug">
                {tt(t, 'admin.product.origin_hint',
                  'Visible solo para admin. Para comprar al proveedor: abre el enlace, añade al carrito y procesa el pago en la plataforma de origen.')}
              </p>
            </div>
          )}

          {/* DROP-346/347: variantes (color + talla) — en móvil van justo debajo de la imagen (order-3). */}
          <div className="order-3 lg:order-none flex flex-col gap-4">
            {/* DROP-346: color swatches */}
            {colorOption && (
              <ColorSwatches
                option={colorOption}
                active={activeColor}
                onPick={handlePickColor}
                t={t}
              />
            )}

            {/* DROP-347: size inventory table */}
            {sizeOption ? (
              <SizeInventoryTable
                option={sizeOption}
                qtyBySize={qtyBySize}
                setSizeQty={setSizeQty}
                stockFor={sizeStock}
                t={t}
              />
            ) : (
              <SingleQtyRow qty={singleQty} setQty={setSingleQty} min={product.moq && product.moq > 1 ? product.moq : 1} t={t} />
            )}
          </div>

          {/* DROP-344/635: price block — un único precio destacado coherente
              (tramo aplicable al MOQ o displayPrice), con su moneda emparejada. */}
          <div className="order-4 lg:order-none">
            <PriceBlock
              displayPrice={Number(featuredPrice)}
              currency={featuredCurrency}
              tiers={product.priceTiers ?? []}
              moq={product.moq}
              activeTierMin={activeTier?.minQty}
              t={t}
            />
          </div>

          {/* DROP-345: shipping/returns/origin */}
          <div className="order-5 lg:order-none">
            <ShippingBlock t={t} />
          </div>

          {/* DROP-348/635: CTAs principales. Add-to-cart deshabilitado si falta
              elegir variante o no hay stock; el handler revalida MOQ. */}
          <div className="order-6 lg:order-none flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" disabled={!inStock || needsColor} onClick={() => addAll()}
                      title={needsColor ? tt(t, 'product.select_variant', 'Please select a variant before adding to cart.') : undefined}
                      className="btn btn-outline">
                <FontAwesomeIcon icon={added ? faCircleCheck : faCartPlus} />
                {added ? t('product.added') : t('product.add_to_cart')}
              </button>
              <button type="button" disabled={!inStock || needsColor} onClick={orderNow} className="btn btn-primary">
                <FontAwesomeIcon icon={faBolt} /> {tt(t, 'product.order_now', 'Order now')}
              </button>
            </div>
            {needsColor && (
              <p className="text-[12px] text-warning flex items-center gap-1.5">
                <FontAwesomeIcon icon={faCircleInfo} />
                {tt(t, 'product.select_variant', 'Please select a variant before adding to cart.')}
              </p>
            )}
          </div>

          {/* DROP-349: bloque Dropship by NX036 */}
          <div className="order-7 lg:order-none alert bg-base-200 border border-base-300 text-base-content text-[13px]">
            <FontAwesomeIcon icon={faShop} className="text-primary" />
            <div className="flex-1">
              <div className="font-medium">{tt(t, 'product.dropship.title', 'Dropship by NX036')}</div>
              <div className="opacity-70 text-[12px]">
                {tt(t, 'product.dropship.body', 'Auto-sync stock, branded packaging and tracked delivery — no inventory required.')}
              </div>
            </div>
            <button type="button" onClick={dropship} className="btn btn-sm btn-primary">
              {tt(t, 'product.dropship.cta', 'Enable dropship')}
            </button>
          </div>

          {/* DROP-356: price disclosure */}
          <p className="order-8 lg:order-none text-[11px] opacity-60 leading-relaxed">
            {tt(t, 'product.price_disclosure',
              'Prices shown exclude duties, VAT and last-mile shipping. Final landed cost is computed at checkout based on destination and selected logistics.')}
          </p>
        </aside>
      </section>

      {/* DROP-343: factory / supplier card */}
      <Reveal><FactoryCard t={t} supplierName={(product as any).supplier?.name ?? (product as any).supplierName} /></Reveal>

      {/* DROP-350: tabs sticky */}
      <StickyTabs active={activeTab} onChange={setActiveTab} t={t} />

      <div className="space-y-10 mt-6">
        {/* DROP-351: reviews */}
        <Reveal>
          <section id="tab-reviews">
            <ReviewsSection productId={product.id} rating={product.rating} reviewCount={product.reviewCount} t={t} />
          </section>
        </Reveal>

        {/* DROP-352/410/443: attributes table — recibe specs y attrs cargados
            del backend para mostrar la lista completa (antes sólo se veían 3). */}
        <Reveal>
          <section id="tab-attributes">
            <AttributesSection product={product} t={t}
                               specsLive={specsLive ?? []}
                               attrsLive={attrsLive ?? []} />
          </section>
        </Reveal>

        {/* DROP-353: packing */}
        <Reveal>
          <section id="tab-packing">
            <PackingSection t={t} />
          </section>
        </Reveal>

        {/* DROP-354: details */}
        <Reveal>
          <section id="tab-details" className="card card-border bg-base-100">
            <div className="card-body">
              <h2 className="card-title">{tt(t, 'pdp.section.details', 'Product details')}</h2>
              {product.description ? (
                <div className="prose prose-sm max-w-none mt-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
              ) : (
                <p className="opacity-70 text-sm mt-2">{tt(t, 'pdp.details.empty', 'No additional description provided by the supplier.')}</p>
              )}
              <div className="divider"></div>
              <SectionBoundary label="charts" fallback={null}>
                <Suspense fallback={<div className="skeleton h-44 w-full" />}>
                  <div className="grid lg:grid-cols-2 gap-4">
                    <PriceHistoryChart productId={product.id} />
                    {/* Estimado de margen/ganancia: SOLO ADMIN (oculto a soporte/OPERATOR y usuarios). */}
                    {isAdmin && <MarginEstimate productId={product.id} />}
                  </div>
                </Suspense>
              </SectionBoundary>
            </div>
          </section>
        </Reveal>

        {/* DROP-355: merchant recommend */}
        <Reveal>
          <section id="tab-recommend">
            <SectionBoundary label="merchant recommend" fallback={null}>
              <MerchantRecommendCarousel items={recommend?.items ?? []} format={format} t={t} />
            </SectionBoundary>
          </section>
        </Reveal>

        {/* DROP-357: content disclaimer */}
        <p className="text-[11px] opacity-60 leading-relaxed border-t border-base-200 pt-4">
          <FontAwesomeIcon icon={faCircleExclamation} className="text-warning mr-1" />
          {tt(t, 'product.content_disclaimer',
            'Product images, attributes and descriptions are provided by the supplier and translated automatically. NX036 is not responsible for inaccuracies; contact us if you need verified specs before placing a large order.')}
        </p>
      </div>
    </>
  )
}

/* ===================== Subcomponentes ===================== */

function Gallery({ imgs, videoUrl, active, onActive, title, t }: {
  imgs: { id: string; cdnUrl?: string; sourceUrl: string; role: string }[]
  videoUrl?: string
  active: number
  onActive: (i: number) => void
  title: string
  t: (k: string) => string
}) {
  const [showVideo, setShowVideo] = useState(false)
  // DROP-439: lightbox — click en imagen principal abre fullscreen con navegación.
  const [lightbox, setLightbox] = useState(false)
  useEffect(() => {
    if (!lightbox) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowLeft')  onActive((active - 1 + Math.max(1, imgs.length)) % Math.max(1, imgs.length))
      if (e.key === 'ArrowRight') onActive((active + 1) % Math.max(1, imgs.length))
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [lightbox, active, imgs.length, onActive])
  const total = imgs.length
  const prev = () => onActive((active - 1 + total) % Math.max(1, total))
  const next = () => onActive((active + 1) % Math.max(1, total))
  const current = imgs[active]
  const src = current?.cdnUrl || current?.sourceUrl
  // DROP: swipe táctil en móvil — pasar imágenes deslizando como en cualquier app de ecommerce.
  const touchX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || total < 2) return
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current
    if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev() }
    touchX.current = null
  }
  return (
    // Móvil: imagen grande deslizable (swipe) con puntos indicadores — sin tira de miniaturas.
    // sm+: columna de miniaturas a la izquierda + imagen principal a la derecha (sin cambios).
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Miniaturas SOLO en sm+ (en móvil se navega por swipe + puntos, look de app). */}
      <div className="hidden sm:flex sm:flex-col gap-2 shrink-0 sm:max-h-[34rem] sm:overflow-y-auto scrollbar-thin">
        {videoUrl && (
          <button type="button" onClick={() => setShowVideo(true)}
                  className="aspect-square w-20 shrink-0 border border-base-200 rounded-lg overflow-hidden relative hover:border-primary">
            <video src={videoUrl} muted playsInline className="w-full h-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
              <FontAwesomeIcon icon={faPlay} />
            </span>
          </button>
        )}
        {imgs.map((img, i) => (
          <button key={img.id} type="button" onClick={() => { onActive(i); setShowVideo(false) }}
                  aria-label={`${t('product.image_n')} ${i + 1}`}
                  className={`aspect-square w-20 shrink-0 border rounded-lg overflow-hidden transition-colors ${i === active && !showVideo ? 'border-primary ring-2 ring-primary/20' : 'border-base-200 hover:border-base-content/30'}`}>
            <img src={img.cdnUrl || img.sourceUrl} alt="" loading="lazy" className="w-full h-full object-cover"
                 onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </button>
        ))}
      </div>

      <div className="relative flex-1 min-w-0" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="aspect-square bg-base-100 border border-base-200 rounded-xl overflow-hidden flex items-center justify-center select-none">
          {showVideo && videoUrl
            ? <video src={videoUrl} controls autoPlay className="w-full h-full object-contain bg-black" />
            : src
              ? <img id="nx-pdp-main-img" src={src} alt={title} draggable={false} className="w-full h-full object-contain cursor-zoom-in"
                     onClick={() => setLightbox(true)}
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }} />
              : <span className="opacity-40 text-sm">{t('product.no_image')}</span>}
        </div>
        {/* Móvil: botón flotante para ver el vídeo (las miniaturas están ocultas). */}
        {videoUrl && !showVideo && (
          <button type="button" onClick={() => setShowVideo(true)} aria-label={tt(t, 'product.play_video', 'Play video')}
                  className="sm:hidden btn btn-sm btn-circle bg-base-100/85 backdrop-blur border-base-200 absolute top-2 left-2">
            <FontAwesomeIcon icon={faPlay} className="text-primary" />
          </button>
        )}
        {/* Lightbox: se monta vía portal en <body> para que `fixed inset-0` cubra TODA la
            pantalla. Si se renderizara aquí, el `transform` de animate-fade-up lo confinaría
            al contenedor del producto (por eso antes salía recortado). */}
        {lightbox && src && createPortal(
          <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center cursor-zoom-out overscroll-contain"
               onClick={() => setLightbox(false)} role="dialog" aria-modal="true">
            <img src={src} alt={title} className="max-w-[100vw] max-h-[100dvh] w-auto h-auto object-contain p-2"
                 onClick={(e) => e.stopPropagation()} />
            {total > 1 && (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); prev() }}
                        className="btn btn-circle btn-ghost text-white bg-black/40 absolute left-3 top-1/2 -translate-y-1/2"
                        aria-label="prev"><FontAwesomeIcon icon={faChevronLeft} className="text-xl" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); next() }}
                        className="btn btn-circle btn-ghost text-white bg-black/40 absolute right-3 top-1/2 -translate-y-1/2"
                        aria-label="next"><FontAwesomeIcon icon={faChevronRight} className="text-xl" /></button>
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] text-white/90 px-2.5 py-1 rounded-full bg-white/10">
                  {active + 1} / {total}
                </span>
              </>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); setLightbox(false) }}
                    className="btn btn-circle btn-ghost text-white bg-black/40 absolute top-3 right-3"
                    aria-label="close"><FontAwesomeIcon icon={faPlay} className="rotate-45" /></button>
          </div>, document.body
        )}
        {total > 1 && !showVideo && (
          <>
            {/* Flechas: ocultas en móvil (se usa swipe), visibles en sm+. */}
            <button type="button" onClick={prev}
                    className="hidden sm:flex btn btn-sm btn-circle btn-ghost bg-base-100/80 backdrop-blur absolute left-2 top-1/2 -translate-y-1/2"
                    aria-label="prev"><FontAwesomeIcon icon={faChevronLeft} /></button>
            <button type="button" onClick={next}
                    className="hidden sm:flex btn btn-sm btn-circle btn-ghost bg-base-100/80 backdrop-blur absolute right-2 top-1/2 -translate-y-1/2"
                    aria-label="next"><FontAwesomeIcon icon={faChevronRight} /></button>
            <span className="absolute bottom-2 right-3 text-[11px] px-2 py-0.5 rounded-full bg-base-100/80 border border-base-200">
              {active + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Puntos indicadores SOLO en móvil — tocar salta a esa imagen (look de app). */}
      {total > 1 && !showVideo && (
        <div className="sm:hidden order-3 flex flex-wrap justify-center gap-1.5 pt-0.5">
          {imgs.map((_, i) => (
            <button key={i} type="button" onClick={() => onActive(i)}
                    aria-label={`${t('product.image_n')} ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-primary' : 'w-1.5 bg-base-300'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function PriceBlock({ displayPrice, currency, tiers, moq, activeTierMin, t }: {
  displayPrice: number
  currency: string
  tiers: { minQty: number; maxQty?: number; unitPrice: number; currency: string }[]
  moq: number
  activeTierMin?: number
  t: (k: string) => string
}) {
  const format = useCurrencyStore((s) => s.format)
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body p-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-2xl sm:text-3xl font-medium text-primary">{format(displayPrice, currency)}</span>
          {moq > 1 && (
            <span className="badge badge-outline">{t('product.moq')} <strong className="ml-1">{moq}</strong></span>
          )}
        </div>
        {tiers.length > 0 && (
          <div className="mt-3">
            <div className="text-[12px] opacity-70 mb-1">{t('product.tiered_pricing')}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {tiers.map((tier, i) => {
                const active = activeTierMin === tier.minQty
                return (
                  <div key={i}
                       className={`rounded-lg border px-2.5 py-2 text-center transition-colors ${active ? 'border-primary bg-primary/5' : 'border-base-200'}`}>
                    <div className="text-[11px] opacity-70">{tier.minQty}{tier.maxQty ? ` – ${tier.maxQty}` : '+'}</div>
                    {/* DROP-637: string formateado por el backend (margen + tasa). El front solo pinta. */}
                    <div className="font-medium text-[13px]">{(tier as any).unitPriceFormatted ?? format(Number(tier.unitPrice), tier.currency)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ShippingBlock({ t }: { t: (k: string) => string }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
      <li className="flex items-start gap-2"><FontAwesomeIcon icon={faTruck} className="text-primary mt-0.5" />
        <span><strong>{tt(t, 'pdp.shipping.title', 'Shipping')}</strong><br/><span className="opacity-70">{tt(t, 'pdp.shipping.body', '7–14 days, tracked')}</span></span>
      </li>
      <li className="flex items-start gap-2"><FontAwesomeIcon icon={faRotateLeft} className="text-primary mt-0.5" />
        <span><strong>{tt(t, 'pdp.returns.title', 'Returns')}</strong><br/><span className="opacity-70">{tt(t, 'pdp.returns.body', '30-day defect policy')}</span></span>
      </li>
      <li className="flex items-start gap-2"><FontAwesomeIcon icon={faGlobe} className="text-primary mt-0.5" />
        <span><strong>{tt(t, 'pdp.origin.title', 'Origin')}</strong><br/><span className="opacity-70">{tt(t, 'pdp.origin.body', 'Ships from China')}</span></span>
      </li>
    </ul>
  )
}

function ColorSwatches({ option, active, onPick, t }: {
  option: { values?: { id: string; value?: string; valueLocalized?: string; valueZh: string; imageUrl?: string }[] }
  active: string | null
  onPick: (v: string, imageUrl?: string) => void
  t: (k: string) => string
}) {
  const locale = useLocaleStore((s) => s.locale)
  const values = option.values ?? []
  // La etiqueta visible: traducción del idioma activo (valueLocalized) → override neutral → diccionario
  // CN→idioma (fallback) para no exponer 驼色/墨绿/炭黑 al comprador.
  const resolveLabel = (v: { value?: string; valueLocalized?: string; valueZh: string }) =>
    (v.valueLocalized && v.valueLocalized.trim() !== '') ? v.valueLocalized
      : (v.value && v.value.trim() !== '') ? v.value : translateVariantCN(v.valueZh, locale)
  // Selecciona el PRIMER color por defecto al cargar la ficha; el usuario puede
  // cambiarlo después. Solo actúa si aún no hay color elegido (active == null).
  useEffect(() => {
    if (active == null && values.length > 0) onPick(resolveLabel(values[0]), values[0].imageUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, values.length])
  if (values.length === 0) return null
  return (
    <div>
      <div className="text-[12px] opacity-70 mb-1">{tt(t, 'pdp.color', 'Color')}: <strong>{active ?? '—'}</strong></div>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const label = resolveLabel(v)
          const sel = active === label
          // Borde de 2 px con el color real de la variante (fallback gris si no se
          // reconoce el color); la selección se marca con el ring primario.
          const swatchColor = colorToCss(label)
          return (
            <button key={v.id} type="button" onClick={() => onPick(label, v.imageUrl)}
                    title={label}
                    style={{ borderColor: swatchColor ?? '#d1d5db' }}
                    className={`w-12 h-12 rounded-lg border-2 overflow-hidden relative transition-transform ${sel ? 'ring-2 ring-primary/50 ring-offset-1 scale-105' : 'hover:scale-105'}`}>
              {v.imageUrl
                ? <img src={v.imageUrl} alt={label} loading="lazy" className="w-full h-full object-cover" />
                : <span className="flex items-center justify-center w-full h-full text-[10px] px-1 text-center">{label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SizeInventoryTable({ option, qtyBySize, setSizeQty, stockFor, t }: {
  option: { values?: { id: string; value?: string; valueLocalized?: string; valueZh: string }[] }
  qtyBySize: Record<string, number>
  setSizeQty: (v: string, n: number) => void
  stockFor: (v: string) => number
  t: (k: string) => string
}) {
  const locale = useLocaleStore((s) => s.locale)
  const values = option.values ?? []
  if (values.length === 0) return null
  // Tarjeta compacta por talla. Grid responsive: escala bien de 3 a 30+ tallas
  // sin convertir el PDP en una columna infinita.
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body p-3">
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h3 className="text-[13px] font-medium">{tt(t, 'pdp.size', 'Size')}</h3>
          <span className="text-[11px] opacity-60">{values.length} · {tt(t, 'pdp.size.stock', 'Stock')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
          {values.map((v) => {
            const label = (v.valueLocalized && v.valueLocalized.trim() !== '') ? v.valueLocalized
              : (v.value && v.value.trim() !== '') ? v.value : translateVariantCN(v.valueZh, locale)
            const stock = stockFor(label)
            const qty = qtyBySize[label] ?? 0
            const outOfStock = stock <= 0
            const active = qty > 0
            return (
              <div key={v.id}
                   className={`border rounded-lg p-2 overflow-hidden transition-colors ${
                     outOfStock ? 'border-base-300 opacity-60'
                     : active ? 'border-primary bg-primary/5'
                     : 'border-base-300 hover:border-base-content/30'
                   }`}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-semibold text-[13px]">{label}</span>
                  <span className={`text-[10px] ${outOfStock ? 'text-error' : 'opacity-60'}`}>
                    {outOfStock ? tt(t, 'product.out_of_stock', 'out of stock') : stock}
                  </span>
                </div>
                <div className="join w-full max-w-full">
                  <button type="button" className="btn btn-xs join-item w-7 shrink-0 px-0"
                          disabled={outOfStock || qty <= 0}
                          onClick={() => setSizeQty(label, qty - 1)} aria-label="decrease">
                    <FontAwesomeIcon icon={faMinus} className="text-[10px]" />
                  </button>
                  <input type="number" min={0} max={stock} value={qty}
                         disabled={outOfStock}
                         onChange={(e) => setSizeQty(label, Math.min(stock, Math.max(0, Number(e.target.value))))}
                         className="input input-bordered input-xs join-item flex-1 min-w-0 w-full text-center font-mono px-1"
                         aria-label={`${tt(t, 'pdp.size', 'Size')} ${label}`} />
                  <button type="button" className="btn btn-xs join-item w-7 shrink-0 px-0"
                          disabled={outOfStock || qty >= stock}
                          onClick={() => setSizeQty(label, qty + 1)} aria-label="increase">
                    <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SingleQtyRow({ qty, setQty, min = 1, t }: { qty: number; setQty: (n: number) => void; min?: number; t: (k: string) => string }) {
  // DROP-635: el mínimo es el MOQ. No se puede bajar de él con el botón "−".
  return (
    <div>
      <div className="text-[12px] opacity-70 mb-1">
        {t('product.qty')}
        {min > 1 && <span className="opacity-70 ml-1">· {t('product.moq')} {min}</span>}
      </div>
      <div className="join">
        <button type="button" className="btn btn-sm join-item" disabled={qty <= min}
                onClick={() => setQty(Math.max(min, qty - 1))} aria-label="decrease">
          <FontAwesomeIcon icon={faMinus} />
        </button>
        <span className="btn btn-sm join-item no-animation pointer-events-none">{qty}</span>
        <button type="button" className="btn btn-sm join-item" onClick={() => setQty(qty + 1)} aria-label="increase">
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>
    </div>
  )
}

// DROP-467: el placeholder previo era sólo un círculo violeta vacío (avatar-placeholder
// de daisyUI espera texto, no un FontAwesomeIcon, y la maquetación lo recortaba).
// Ahora generamos iniciales reales a partir del nombre del proveedor — patrón clásico
// de avatar tipo "JL" sobre fondo de color — y caemos al icono de fábrica sólo cuando
// no hay nombre. Esto sirve hasta que demos de alta logos de proveedor en backend.
function supplierInitials(name?: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function FactoryCard({ supplierName, t }: { supplierName?: string; t: (k: string) => string }) {
  const initials = supplierInitials(supplierName)
  return (
    <section className="card card-border bg-base-100 mt-6">
      <div className="card-body flex-row items-center gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-full bg-primary text-primary-content flex items-center justify-center font-semibold text-lg shrink-0 select-none">
          {initials ? <span aria-hidden="true">{initials}</span>
                    : <FontAwesomeIcon icon={faIndustry} className="text-2xl" aria-hidden="true" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] opacity-60">{tt(t, 'pdp.factory.label', 'Verified factory')}</div>
          <div className="font-medium">{supplierName ?? tt(t, 'pdp.factory.unknown', 'NX036 partner supplier')}</div>
          <div className="text-[12px] opacity-70 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span><FontAwesomeIcon icon={faShieldHalved} className="text-success" /> TrustPass</span>
            <span><FontAwesomeIcon icon={faStar} className="text-warning" /> 4.7</span>
            <span><FontAwesomeIcon icon={faGlobe} /> CN — Guangdong</span>
            <span>{tt(t, 'pdp.factory.years', 'Years on platform')}: 6</span>
          </div>
        </div>
        <button type="button" className="btn btn-outline btn-sm">{tt(t, 'pdp.factory.contact', 'Contact supplier')}</button>
      </div>
    </section>
  )
}

function StickyTabs({ active, onChange, t }: { active: Tab; onChange: (t: Tab) => void; t: (k: string) => string }) {
  // DROP-350: tabs sticky bajo navbar — usar `tabs tabs-bordered` con sticky.
  const items: { key: Tab; label: string }[] = [
    { key: 'reviews',    label: tt(t, 'pdp.tab.reviews',    'Reviews') },
    { key: 'attributes', label: tt(t, 'pdp.tab.attributes', 'Attributes') },
    { key: 'packing',    label: tt(t, 'pdp.tab.packing',    'Packing') },
    { key: 'details',    label: tt(t, 'pdp.tab.details',    'Details') },
    { key: 'recommend',  label: tt(t, 'pdp.tab.recommend',  'Merchant recommend') },
  ]
  function go(k: Tab) {
    onChange(k)
    const el = document.getElementById(`tab-${k}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <div role="tablist" className="tabs tabs-bordered sticky top-14 z-20 bg-base-100 mt-8 overflow-x-auto">
      {items.map((it) => (
        <button key={it.key} role="tab"
                onClick={() => go(it.key)}
                className={`tab ${active === it.key ? 'tab-active' : ''}`}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

const LANG_LABEL: Record<string, string> = { es: 'ES', en: 'EN', pt: 'PT', zh: 'ZH', fr: 'FR', de: 'DE', it: 'IT', nl: 'NL' }

function ReviewsSection({ productId, rating, reviewCount, t }: { productId: string; rating?: number | null; reviewCount?: number; t: (k: string) => string }) {
  const qc = useQueryClient()
  const lang = useLocaleStore((s) => s.locale)
  const { data } = useQuery({ queryKey: ['reviews', productId], queryFn: () => listReviews(productId, 0, 50) })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rating: 5, title: '', body: '', authorName: '' })
  const [langFilter, setLangFilter] = useState<string | null>(null)
  const userTouchedFilter = useRef(false)
  const create = useMutation({
    mutationFn: () => createReview(productId, {
      rating: form.rating, title: form.title.trim() || undefined, body: form.body.trim() || undefined,
      language: lang, authorName: form.authorName.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', productId] })
      qc.invalidateQueries({ queryKey: ['product'] })
      setShowForm(false); setForm({ rating: 5, title: '', body: '', authorName: '' })
    },
  })

  const items = data?.items ?? []
  const total = data?.totalElements ?? reviewCount ?? 0
  const overall = data?.averageRating ?? (rating != null ? Number(rating) : 0)
  const dist = data?.distribution ?? {}
  const distTotal = Object.values(dist).reduce((a, b) => a + Number(b), 0) || 1
  const langsPresent = Array.from(new Set(items.map((r) => r.language).filter(Boolean))) as string[]
  // Por defecto se muestran las reseñas en el idioma del comprador (si las hay); puede ver "Todas".
  useEffect(() => {
    if (userTouchedFilter.current) return
    if (langsPresent.includes(lang)) setLangFilter(lang)
  }, [lang, langsPresent.join(',')])
  const shown = langFilter ? items.filter((r) => (r.language ?? '') === langFilter) : items

  return (
    <div className="card card-border bg-base-100" data-product-id={productId}>
      <div className="card-body">
        <header className="flex items-center justify-between mb-2">
          <h2 className="card-title">{tt(t, 'reviews.title', 'Reviews')}</h2>
          <button onClick={() => setShowForm((s) => !s)} className="link link-primary text-[12px]">
            {tt(t, 'reviews.write', 'Write a review')}
          </button>
        </header>

        {/* DROP-680: sin reseñas reales no se muestra una valoración inventada (0.0★). */}
        {total === 0 ? (
          <div className="text-[13px] opacity-70 py-2">{tt(t, 'reviews.none', 'No ratings yet — be the first to review this product.')}</div>
        ) : (
        <div className="grid sm:grid-cols-[10rem_1fr] gap-6">
          <div className="text-center">
            <div className="text-4xl font-medium text-primary">{overall.toFixed(1)}</div>
            <div className="rating rating-sm mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <input key={n} type="radio" className="mask mask-star-2 bg-warning" disabled checked={n === Math.round(overall)} readOnly />
              ))}
            </div>
            <div className="text-[11px] opacity-70 mt-1">{total} {tt(t, 'reviews.reviews', 'reviews')}</div>
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const cnt = Number(dist[String(stars)] ?? 0)
              const pct = Math.round((cnt / distTotal) * 100)
              return (
                <div key={stars} className="flex items-center gap-2 text-[12px]">
                  <span className="w-4 opacity-70">{stars}</span>
                  <span className="text-warning">★</span>
                  <progress className="progress progress-warning flex-1 h-2" value={pct} max={100} />
                  <span className="w-8 text-right opacity-70">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* Formulario para crear reseña (en el idioma activo). */}
        {showForm && (
          <form onSubmit={(e) => { e.preventDefault(); if (form.body.trim() || form.title.trim()) create.mutate() }}
                className="mt-4 rounded-box border border-base-200 p-3 space-y-2 bg-base-200/30">
            <div className="flex items-center gap-2">
              <span className="text-[12px]">{tt(t, 'reviews.your_rating', 'Your rating')}:</span>
              <div className="rating rating-sm">
                {[1, 2, 3, 4, 5].map((n) => (
                  <input key={n} type="radio" name="newrating" className="mask mask-star-2 bg-warning"
                         checked={form.rating === n} onChange={() => setForm({ ...form, rating: n })} />
                ))}
              </div>
              <span className="ml-auto badge badge-sm badge-outline">{LANG_LABEL[lang] ?? lang.toUpperCase()}</span>
            </div>
            <input className="input input-bordered input-sm w-full" placeholder={tt(t, 'reviews.name', 'Your name')}
                   value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} />
            <input className="input input-bordered input-sm w-full" placeholder={tt(t, 'reviews.title_field', 'Title')}
                   value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="textarea textarea-bordered textarea-sm w-full h-20" placeholder={tt(t, 'reviews.body', 'Write your review…')}
                      value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">{tt(t, 'common.cancel', 'Cancel')}</button>
              <button type="submit" disabled={create.isPending || (!form.body.trim() && !form.title.trim())} className="btn btn-primary btn-sm">
                {tt(t, 'reviews.submit', 'Submit review')}
              </button>
            </div>
          </form>
        )}

        {/* Filtro por idioma (si hay reseñas en varios idiomas). */}
        {langsPresent.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button onClick={() => { userTouchedFilter.current = true; setLangFilter(null) }} className={`badge ${langFilter === null ? 'badge-primary' : 'badge-outline'}`}>
              {tt(t, 'reviews.all_langs', 'All')}
            </button>
            {langsPresent.map((l) => (
              <button key={l} onClick={() => { userTouchedFilter.current = true; setLangFilter(l) }} className={`badge ${langFilter === l ? 'badge-primary' : 'badge-outline'}`}>
                {LANG_LABEL[l] ?? l.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Lista de reseñas reales. */}
        {shown.length === 0 ? (
          <div className="mt-6 text-center text-[13px] opacity-60 py-6">{tt(t, 'reviews.empty', 'No reviews yet. Be the first to write one.')}</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shown.map((r) => (
              <article key={r.id} className="card card-border bg-base-100">
                <div className="card-body p-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium flex items-center gap-1.5">
                      {r.authorName || tt(t, 'reviews.anon', 'Anonymous')}
                      {r.language && <span className="badge badge-xs badge-ghost">{LANG_LABEL[r.language] ?? r.language.toUpperCase()}</span>}
                    </span>
                    <span className="text-warning">{'★'.repeat(r.rating)}<span className="opacity-30">{'★'.repeat(5 - r.rating)}</span></span>
                  </div>
                  {r.title && <div className="text-[12px] font-medium mt-1">{r.title}</div>}
                  {r.body && <p className="text-[12px] mt-1 leading-relaxed">{r.body}</p>}
                  <div className="text-[11px] opacity-60 mt-1.5">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AttributesSection({ product, t, specsLive, attrsLive }: {
  product: any; t: (k: string) => string;
  specsLive?: { key: string; value: string }[];
  attrsLive?: { key: string; value: string }[];
}) {
  // DROP-410/443: combina specifications (multilingüe del backend) + attributes
  // free-form (color/material/talla del feed 1688) + campos básicos del modelo.
  // Antes sólo se mostraban 3 filas porque ProductDetailView NO embebía specs;
  // ahora las cargamos por endpoint separado y caemos al ES si el idioma del
  // usuario aún no está poblado.
  const rows: { k: string; v: string }[] = []
  const embeddedAttrs = product.attributes as Record<string, string> | undefined
  const embeddedSpecs = (product.specifications ?? []) as { key: string; value: string }[]
  const specs = (specsLive && specsLive.length > 0 ? specsLive : embeddedSpecs)
  const liveAttrsList = (attrsLive ?? [])
  // DROP-495: traducción de valores de atributos comunes (slug → label legible).
  // Cubre los casos reportados: kids, all_season, fashion-apparel, fashion / unisex…
  // Si no hay match, devolvemos el valor original (puede ser número, marca, etc.).
  const VALUE_MAP: Record<string, string> = {
    'kids': tt(t, 'attr.val.kids', 'Kids'),
    'adults': tt(t, 'attr.val.adults', 'Adults'),
    'unisex': tt(t, 'attr.val.unisex', 'Unisex'),
    'men': tt(t, 'attr.val.men', 'Men'),
    'women': tt(t, 'attr.val.women', 'Women'),
    'all_season': tt(t, 'attr.val.all_season', 'All seasons'),
    'winter': tt(t, 'attr.val.winter', 'Winter'),
    'summer': tt(t, 'attr.val.summer', 'Summer'),
    'spring': tt(t, 'attr.val.spring', 'Spring'),
    'autumn': tt(t, 'attr.val.autumn', 'Autumn'),
    'fall': tt(t, 'attr.val.autumn', 'Autumn'),
    'fashion-apparel': tt(t, 'category.fashion-apparel', 'Fashion & Apparel'),
    'consumer-electronics': tt(t, 'category.consumer-electronics', 'Consumer Electronics'),
    'home-kitchen': tt(t, 'category.home-kitchen', 'Home & Kitchen'),
    'beauty-personal-care': tt(t, 'category.beauty-personal-care', 'Beauty & Personal Care'),
    'sports-outdoors': tt(t, 'category.sports-outdoors', 'Sports & Outdoors'),
    'toys-gifts': tt(t, 'category.toys-gifts', 'Toys & Gifts'),
  }
  const labelValue = (raw: string): string => VALUE_MAP[raw.toLowerCase()] ?? raw
  if (specs.length > 0) {
    for (const s of specs) rows.push({ k: tt(t, `attr.${s.key}`, s.key), v: labelValue(String(s.value)) })
  }
  if (liveAttrsList.length > 0) {
    for (const a of liveAttrsList) {
      if (rows.some((r) => r.k.toLowerCase() === a.key.toLowerCase())) continue
      rows.push({ k: tt(t, `attr.${a.key}`, a.key), v: labelValue(String(a.value)) })
    }
  }
  if (embeddedAttrs) {
    for (const [k, v] of Object.entries(embeddedAttrs)) {
      if (rows.some((r) => r.k.toLowerCase() === k.toLowerCase())) continue
      rows.push({ k: tt(t, `attr.${k}`, k), v: labelValue(String(v)) })
    }
  }
  // Siempre añadimos los básicos al final (sin pisar si ya están en attrs/specs).
  function addIfMissing(label: string, value: string | number | undefined) {
    if (value == null || value === '') return
    if (rows.some((r) => r.k.toLowerCase() === label.toLowerCase())) return
    rows.push({ k: label, v: String(value) })
  }
  addIfMissing(tt(t, 'attr.brand', 'Brand'), product.brand)
  addIfMissing(tt(t, 'attr.source', 'Source'), product.source)
  addIfMissing(tt(t, 'attr.moq', 'MOQ'), product.moq)
  addIfMissing(tt(t, 'attr.weight', 'Weight (g)'), product.weightGrams ?? product.packageWeightGrams)
  addIfMissing(tt(t, 'attr.dimensions', 'Dimensions'), product.dimensions ?? product.packageSize)
  addIfMissing(tt(t, 'attr.material', 'Material'), product.material)
  addIfMissing(tt(t, 'attr.ship_from', 'Ships from'), product.shipFrom)
  addIfMissing(tt(t, 'attr.certifications', 'Certifications'),
               Array.isArray(product.certifications) ? product.certifications.join(', ') : product.certifications)
  addIfMissing(tt(t, 'attr.rating', 'Rating'),
               product.rating != null ? `${Number(product.rating).toFixed(1)} ★ (${product.reviewCount ?? 0})` : null as any)
  addIfMissing(tt(t, 'attr.inventory', 'Inventory'), product.inventoryCount ?? product.availableUnits)
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body">
        <h2 className="card-title">{tt(t, 'pdp.section.attributes', 'Product attributes')}</h2>
        <div className="overflow-hidden mt-1">
          <table className="table table-zebra table-sm">
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={2} className="text-center opacity-60 py-6">{tt(t, 'pdp.attr.empty', 'No attributes published for this product.')}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>
                  <td className="w-44 opacity-70">{r.k}</td>
                  <td className="font-medium">{r.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PackingSection({ t }: { t: (k: string) => string }) {
  // Datos sintéticos coherentes hasta cablear `packing` real al backend.
  const rows = [
    { k: tt(t, 'pdp.packing.unit',     'Unit packaging'), v: tt(t, 'pdp.packing.unit.val',   'Polybag + brand sticker') },
    { k: tt(t, 'pdp.packing.size',     'Carton size'),    v: '50 × 40 × 30 cm' },
    { k: tt(t, 'pdp.packing.weight',   'Gross weight'),   v: '12.5 kg' },
    { k: tt(t, 'pdp.packing.perCarton','Units / carton'), v: '24' },
  ]
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body">
        <h2 className="card-title">{tt(t, 'pdp.section.packing', 'Packing & shipping')}</h2>
        <div className="overflow-hidden mt-1">
          <table className="table table-zebra table-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="w-44 opacity-70">{r.k}</td>
                  <td className="font-medium">{r.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MerchantRecommendCarousel({ items, format, t }: { items: any[]; format: (n: number, c: string) => string; t: (k: string) => string }) {
  const railRef = useRef<HTMLDivElement>(null)
  const scrollBy = (dx: number) => railRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body">
        <header className="flex items-center justify-between">
          <h2 className="card-title">{tt(t, 'pdp.section.recommend', 'Merchant recommend')}</h2>
          <div className="join">
            <button type="button" onClick={() => scrollBy(-360)} className="btn btn-sm btn-square join-item" aria-label="prev">
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <button type="button" onClick={() => scrollBy(360)} className="btn btn-sm btn-square join-item" aria-label="next">
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </header>
        <div ref={railRef} className="mt-3 flex gap-3 overflow-x-auto scrollbar-thin scroll-smooth">
          {items.length === 0
            ? <div className="opacity-60 text-sm">{tt(t, 'pdp.recommend.empty', 'No recommendations available.')}</div>
            : items.map((it) => (
              <a key={it.id} href={`/catalog/${it.slug}`}
                 className="shrink-0 w-44 card card-border bg-base-100 hover:shadow-lg transition-shadow">
                <figure className="aspect-square bg-base-200">
                  {it.mainImage && <img src={it.mainImage} alt={it.title} loading="lazy" className="w-full h-full object-cover" />}
                </figure>
                <div className="card-body p-2 text-[12px]">
                  <div className="line-clamp-2">{it.title}</div>
                  <div className="text-primary font-medium">{format(Number(it.basePrice ?? 0), it.currency || 'USD')}</div>
                </div>
              </a>
            ))}
        </div>
      </div>
    </div>
  )
}
