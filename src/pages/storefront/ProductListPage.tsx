import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTableCells, faList, faTruckFast, faVideo } from '@fortawesome/free-solid-svg-icons'
import {
  listStorefrontProducts, listCategoriesTree, listSuppliers, ProductFilters, ProductSummary, CategoryView,
} from '../../api/catalog'
import { ProductCard } from '../../components/ProductCard'
import { useCurrencyStore } from '../../store/currency'
import { SearchInput } from '../../components/SearchInput'
import { FilterBar, SelectFilter, PillToggle, RangeInput } from '../../components/FilterBar'
import { useT, useLocaleStore } from '../../store/locale'

const PAGE_SIZE = 36
type View = 'grid' | 'list'

const SHIP_FROM = ['CN', 'HK', 'US', 'ES', 'MX']
const CERTS     = ['CE', 'FCC', 'RoHS', 'FDA', 'EN71']

export default function ProductListPage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const [params, setParams] = useSearchParams()

  // ---------- filter state (mirrors URL for shareable links) ----------
  const [q, setQ]                   = useState(params.get('q') ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(params.get('categoryId'))
  const [supplierId, setSupplierId] = useState<string | null>(params.get('supplierId'))
  const [minPrice, setMinPrice]     = useState(params.get('minPrice') ?? '')
  const [maxPrice, setMaxPrice]     = useState(params.get('maxPrice') ?? '')
  const [shipFrom, setShipFrom]     = useState<string | null>(params.get('shipFrom'))
  const [freeShipping, setFreeShipping] = useState(params.get('freeShipping') === '1')
  const [hasVideo, setHasVideo]     = useState(params.get('hasVideo') === '1')
  const [minRating, setMinRating]   = useState<string | null>(params.get('minRating'))
  const [certification, setCertification] = useState<string | null>(params.get('certification'))
  const [sort, setSort]             = useState<NonNullable<ProductFilters['sort']>>((params.get('sort') as any) ?? 'best_match')
  const [view, setView] = useState<View>(((localStorage.getItem('nx036-catalog-view') as View) ?? 'grid'))

  useEffect(() => { localStorage.setItem('nx036-catalog-view', view) }, [view])

  // serialize filters into URL for deep links / sharing
  useEffect(() => {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (categoryId) next.set('categoryId', categoryId)
    if (supplierId) next.set('supplierId', supplierId)
    if (minPrice) next.set('minPrice', minPrice)
    if (maxPrice) next.set('maxPrice', maxPrice)
    if (shipFrom) next.set('shipFrom', shipFrom)
    if (freeShipping) next.set('freeShipping', '1')
    if (hasVideo) next.set('hasVideo', '1')
    if (minRating) next.set('minRating', minRating)
    if (certification) next.set('certification', certification)
    if (sort && sort !== 'best_match') next.set('sort', sort)
    setParams(next, { replace: true })
  }, [q, categoryId, supplierId, minPrice, maxPrice, shipFrom, freeShipping, hasVideo, minRating, certification, sort, setParams])

  // ---------- supporting data ----------
  const { data: catTree = [] } = useQuery({ queryKey: ['cats-tree', lang], queryFn: () => listCategoriesTree(lang) })
  const { data: suppliers  = [] } = useQuery({ queryKey: ['sups'],         queryFn: listSuppliers })

  // Aplanamos el árbol (raíces + subcategorías). El filtro ofrece SOLO las categorías con productos
  // cargados (directProductCount > 0) — en este catálogo son las subcategorías hoja. Seleccionar una
  // filtra por su categoryId exacto, que es donde están los productos. `categories` (todas, aplanadas)
  // se usa para resolver el nombre de la categoría seleccionada en el chip y el encabezado.
  const categories = useMemo(() => {
    const out: CategoryView[] = []
    const walk = (nodes: CategoryView[]) => nodes.forEach((n) => { out.push(n); if (n.children?.length) walk(n.children) })
    walk(catTree)
    return out
  }, [catTree])
  const productCats = useMemo(() => categories.filter((c) => (c.directProductCount ?? 0) > 0), [categories])

  const filters: ProductFilters = useMemo(() => ({
    q: q || undefined,
    categoryId: categoryId ?? undefined,
    supplierId: supplierId ?? undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    shipFrom: shipFrom ?? undefined,
    freeShipping: freeShipping || undefined,
    hasVideo: hasVideo || undefined,
    minRating: minRating ? Number(minRating) : undefined,
    certification: certification ?? undefined,
    sort,
  }), [q, categoryId, supplierId, minPrice, maxPrice, shipFrom, freeShipping, hasVideo, minRating, certification, sort])

  // ---------- paginated results — proper useInfiniteQuery (DROP-261 fix) ----------
  // DROP-498: si el filtro categoryId no es un UUID válido (p.ej. llega un slug
  // por error desde algún link legacy), evitamos disparar la query y limpiamos
  // el filtro inválido — antes la query reintentaba en bucle y el skeleton
  // quedaba infinito sin mostrar empty state ni error.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const categoryIdInvalid = !!categoryId && !UUID_RE.test(categoryId)
  useEffect(() => {
    if (categoryIdInvalid) {
      // Limpia el query-string corrupto para no congelar la UI.
      setCategoryId(null)
    }
  }, [categoryIdInvalid])
  const infinite = useInfiniteQuery({
    queryKey: ['catalog', filters, lang],
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) => listStorefrontProducts(pageParam as number, PAGE_SIZE, lang, filters),
    getNextPageParam: (last, all) => {
      const totalPagesNow = last?.totalPages ?? 0
      return all.length < totalPagesNow ? all.length : undefined
    },
    enabled: !categoryIdInvalid,
    retry: 1,
  })
  const items: ProductSummary[] = (infinite.data?.pages ?? []).flatMap((p) => p?.items ?? [])
  const total = infinite.data?.pages?.[0]?.totalElements ?? 0
  const isLoading = infinite.isLoading && !infinite.isError
  const canLoadMore = infinite.hasNextPage ?? false
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMore = useCallback(() => {
    if (canLoadMore && !infinite.isFetchingNextPage) infinite.fetchNextPage()
  }, [canLoadMore, infinite])
  useEffect(() => {
    if (!sentinelRef.current || !canLoadMore) return
    const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore() }, { rootMargin: '300px' })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [canLoadMore, loadMore, items.length])

  const activeCount = [q, categoryId, supplierId, minPrice, maxPrice, shipFrom, freeShipping, hasVideo, minRating, certification, sort && sort !== 'best_match' ? sort : '']
    .filter((v) => !!v).length
  const hasActive = activeCount > 0
  const clearAll = () => {
    setQ(''); setCategoryId(null); setSupplierId(null); setMinPrice(''); setMaxPrice('')
    setShipFrom(null); setFreeShipping(false); setHasVideo(false); setMinRating(null)
    setCertification(null); setSort('best_match')
  }

  const activeCategory = categoryId ? categories.find((c) => c.id === categoryId) : null

  return (
    <div className="space-y-5">
      {activeCategory && (
        <section className="rounded-xl bg-gradient-to-r from-brand-50 via-white to-amber-50 border border-ink-100 px-6 py-8 lg:px-10 lg:py-10">
          <div className="text-[11px] uppercase tracking-wider text-brand-700 font-medium">{t('catalog.category_hero.label')}</div>
          <h1 className="mt-1 text-3xl font-medium">{activeCategory.name}</h1>
          <div className="mt-3 inline-flex items-center gap-3 text-[12px] text-ink-500">
            <span><strong className="text-ink-700">{activeCategory.directProductCount ?? 0}</strong> {t('catalog.category_hero.products')}</span>
            <button onClick={() => setCategoryId(null)} className="text-brand-700 hover:underline">
              {t('catalog.category_hero.clear')}
            </button>
          </div>
        </section>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!activeCategory && (
            <>
              <h1>{t('catalog.title')}</h1>
              <p className="text-sm text-ink-500 mt-1">{t('catalog.subtitle')}</p>
            </>
          )}
        </div>
        <div className="inline-flex border border-ink-200 rounded-md overflow-hidden">
          <button onClick={() => setView('grid')}
            className={`px-3 py-1.5 text-[12px] ${view === 'grid' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50'}`}>
            <FontAwesomeIcon icon={faTableCells} /> <span className="hidden sm:inline ml-1">{t('catalog.view.grid')}</span>
          </button>
          <button onClick={() => setView('list')}
            className={`px-3 py-1.5 text-[12px] border-l border-ink-200 ${view === 'list' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50'}`}>
            <FontAwesomeIcon icon={faList} /> <span className="hidden sm:inline ml-1">{t('catalog.view.list')}</span>
          </button>
        </div>
      </header>

      <FilterBar onClear={clearAll} hasActive={hasActive} activeCount={activeCount}>
        <SearchInput value={q} onChange={setQ} placeholder={t('catalog.search_placeholder')} className="w-full sm:min-w-[240px]" />
        {/* Solo categorías CON productos cargados (no las vacías), incluidas las subcategorías. */}
        {productCats.length > 0 && (
          <SelectFilter label={t('filters.category')}
            value={categoryId} placeholder={t('filters.all')}
            options={productCats.map((c) => ({ value: c.id, label: c.name }))}
            onChange={setCategoryId} />
        )}
        {suppliers.length > 0 && (
          <SelectFilter label={t('filters.supplier')}
            value={supplierId} placeholder={t('filters.all')}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            onChange={setSupplierId} />
        )}
        <SelectFilter label={t('catalog.filters.ship_from')}
          value={shipFrom} placeholder={t('filters.all')}
          options={SHIP_FROM.map((c) => ({ value: c, label: c }))}
          onChange={setShipFrom} />
        <SelectFilter label={t('catalog.filters.certification')}
          value={certification} placeholder={t('filters.all')}
          options={CERTS.map((c) => ({ value: c, label: c }))}
          onChange={setCertification} />
        <SelectFilter label={t('catalog.filters.min_rating')}
          value={minRating} placeholder={t('filters.all')}
          options={[{ value: '4', label: '4★+' }, { value: '3', label: '3★+' }]}
          onChange={setMinRating} />
        <PillToggle label={t('catalog.filters.free_shipping')}
                    checked={freeShipping} onChange={setFreeShipping} icon={faTruckFast} />
        <PillToggle label={t('catalog.filters.has_video')}
                    checked={hasVideo} onChange={setHasVideo} icon={faVideo} />
        <RangeInput label={t('catalog.price_range')}
                    min={minPrice} max={maxPrice}
                    onMin={setMinPrice} onMax={setMaxPrice}
                    placeholderMin={t('catalog.price_min')}
                    placeholderMax={t('catalog.price_max')} />
        <SelectFilter label={t('catalog.sort')}
          value={sort}
          options={[
            { value: 'best_match',  label: t('catalog.sort.best_match') },
            { value: 'sales',       label: t('catalog.sort.sales') },
            { value: 'newest',      label: t('catalog.sort.newest') },
            { value: 'rating',      label: t('catalog.sort.rating') },
            { value: 'inventory',   label: t('catalog.sort.inventory') },
            { value: 'lists',       label: t('catalog.sort.lists') },
            { value: 'price_asc',   label: t('catalog.sort.price_asc') },
            { value: 'price_desc',  label: t('catalog.sort.price_desc') },
          ]}
          onChange={(v) => setSort((v as any) ?? 'best_match')} />
        <span className="text-[11px] text-ink-400 ml-auto">{t('pagination.showing')} <strong>{items.length}</strong> / {total}</span>
      </FilterBar>

      {/* DROP-235 — active filter chips */}
      {hasActive && (
        <div className="flex flex-wrap items-center gap-1.5">
          {q && <Chip label={`"${q}"`}                   onClear={() => setQ('')} />}
          {categoryId && <Chip label={categories.find((c) => c.id === categoryId)?.name ?? t('filters.category')} onClear={() => setCategoryId(null)} />}
          {supplierId && <Chip label={suppliers.find((s) => s.id === supplierId)?.name ?? t('filters.supplier')} onClear={() => setSupplierId(null)} />}
          {minPrice    && <Chip label={`≥ ${minPrice}`}  onClear={() => setMinPrice('')} />}
          {maxPrice    && <Chip label={`≤ ${maxPrice}`}  onClear={() => setMaxPrice('')} />}
          {shipFrom    && <Chip label={`${t('catalog.filters.ship_from')}: ${shipFrom}`} onClear={() => setShipFrom(null)} />}
          {freeShipping && <Chip label={t('catalog.filters.free_shipping')} onClear={() => setFreeShipping(false)} />}
          {hasVideo    && <Chip label={t('catalog.filters.has_video')} onClear={() => setHasVideo(false)} />}
          {minRating   && <Chip label={`★ ${minRating}+`} onClear={() => setMinRating(null)} />}
          {certification && <Chip label={certification} onClear={() => setCertification(null)} />}
          {sort && sort !== 'best_match' && (
            <Chip label={t(`catalog.sort.${sort}`)} onClear={() => setSort('best_match')} />
          )}
          <button onClick={clearAll} className="text-[12px] text-brand-700 hover:underline ml-2">
            {t('catalog.clear_all')}
          </button>
        </div>
      )}

      {isLoading && items.length === 0 && (
        <Skeletons view={view} count={12} />
      )}

      {items.length === 0 && !isLoading && (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-500">{t('catalog.empty')}</p>
          {hasActive && <button onClick={clearAll} className="btn btn-outline mt-3 text-sm">{t('catalog.clear')}</button>}
        </div>
      )}

      {view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => <ListRow key={p.id} p={p} />)}
        </div>
      )}

      {/* infinite scroll sentinel + explicit load-more button as fallback */}
      {canLoadMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          <button onClick={loadMore} disabled={isLoading || infinite.isFetchingNextPage}
                  className="btn btn-outline text-[12px]">
            {isLoading ? t('common.loading') : t('catalog.load_more')}
          </button>
        </div>
      )}
      {!canLoadMore && items.length > 0 && (
        <div className="text-center text-[12px] text-ink-400 py-3">{t('catalog.end_of_list')}</div>
      )}
    </div>
  )
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="chip chip-active inline-flex items-center gap-1.5">
      <span className="truncate max-w-[180px]">{label}</span>
      <button onClick={onClear} aria-label="Remove filter"
              className="hover:text-red-700 text-[10px]">✕</button>
    </span>
  )
}

function ListRow({ p }: { p: ProductSummary }) {
  const format = useCurrencyStore((s) => s.format)
  // DROP-497: vista Lista debe ocupar 100% ancho, mostrar miniatura grande,
  // titulo, descripcion breve, supplier, rating, sales y precio + CTA.
  return (
    <a href={`/catalog/${p.slug}`}
       className="card w-full p-4 flex items-center gap-4 hover:border-brand-300 hover:shadow-pastel transition-colors">
      {p.mainImage
        ? <img src={p.mainImage}
               className="w-24 h-24 object-cover rounded-lg shrink-0"
               alt={p.title}
               onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        : <div className="w-24 h-24 rounded-lg bg-ink-50 shrink-0 flex items-center justify-center text-ink-300">—</div>}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium line-clamp-1">{p.title}</div>
        {(p as any).supplierName && (
          <div className="text-[11px] text-ink-500 truncate">{(p as any).supplierName}</div>
        )}
        <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-3 flex-wrap">
          <span>★ {p.rating ?? '—'}</span>
          <span>· {p.monthlySales ?? 0} ventas/mes</span>
          {(p as any).shipFrom && <span>· {(p as any).shipFrom}</span>}
          {(p as any).status === 'ACTIVE' && <span className="text-success">·  En stock</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[15px] font-semibold text-brand-700">
        {p.basePrice != null ? format(Number(p.basePrice), p.currency ?? 'CNY') : '—'}
        </div>
        <button type="button" className="btn btn-outline btn-sm mt-2">Ver detalle</button>
      </div>
    </a>
  )
}

function Skeletons({ view, count }: { view: View; count: number }) {
  if (view === 'list') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card p-3 flex items-center gap-3">
            <div className="w-16 h-16 bg-ink-100 rounded animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-ink-100 rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-ink-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="aspect-square bg-ink-100 animate-pulse" />
          <div className="p-2 space-y-1.5">
            <div className="h-3 bg-ink-100 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-ink-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
