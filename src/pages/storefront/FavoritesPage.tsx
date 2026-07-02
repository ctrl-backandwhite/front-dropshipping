import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart } from '@fortawesome/free-solid-svg-icons'
import { favorites } from '../../api/catalog'
import { ProductCard } from '../../components/ProductCard'
import { useT, useLocaleStore } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'

/**
 * Página "Mis favoritos": los productos que el usuario ha marcado con el corazón, con el mismo pipeline de
 * precios que el catálogo (el backend devuelve los importes ya formateados). El idioma y la moneda activa
 * van en la queryKey para refrescar al cambiarlos.
 */
export default function FavoritesPage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const currency = useCurrencyStore((s) => s.current)
  const [page, setPage] = useState(0)
  const { data, isLoading } = useQuery({
    queryKey: ['favorites', lang, currency, page],
    queryFn: () => favorites.list(page, 24, lang),
  })
  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2">
          <FontAwesomeIcon icon={faHeart} className="text-red-500" /> {t('favorites.title')}
        </h1>
        <p className="text-sm text-ink-500 mt-1">{t('favorites.subtitle')}</p>
      </header>

      {isLoading && items.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="aspect-square w-full bg-ink-100 animate-pulse" />
              <div className="p-3 space-y-2"><div className="h-3 bg-ink-100 rounded animate-pulse" /><div className="h-3 w-1/2 bg-ink-100 rounded animate-pulse" /></div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="card p-10 text-center">
          <FontAwesomeIcon icon={faHeart} className="text-3xl text-ink-300 mb-3" />
          <p className="text-sm text-ink-500">{t('favorites.empty')}</p>
          <Link to="/catalog" className="btn btn-primary mt-4 text-sm">{t('favorites.browse')}</Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="btn btn-outline btn-sm">{t('common.prev')}</button>
          <span className="text-sm text-ink-500">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages}
            className="btn btn-outline btn-sm">{t('common.next')}</button>
        </div>
      )}
    </div>
  )
}
