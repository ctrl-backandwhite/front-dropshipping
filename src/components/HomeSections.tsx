import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFire, faWandMagicSparkles as faSparkles, faVideo, faTrophy, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { listHomeSections } from '../api/catalog'
import { ProductCard } from './ProductCard'
import { useT, useLocaleStore } from '../store/locale'

const SECTION_ICON: Record<string, any> = {
  trending: faFire, newest: faSparkles, video: faVideo, top_selling: faTrophy,
}
const SECTION_KEY: Record<string, string> = {
  trending: 'catalog.home.trending',
  newest: 'catalog.home.newest',
  video: 'catalog.home.video',
  top_selling: 'catalog.home.top_selling',
}

/** Home merchandising rows + hot categories — DROP-20. Skeletons follow DROP-23. */
export function HomeSections() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  // Home pública = solo un TEASER: una hilera por apartado (6 = una fila en desktop). El catálogo
  // completo es interno: el "Ver todos" lleva al catálogo, que exige login.
  const { data, isLoading } = useQuery({
    queryKey: ['home-sections', lang],
    queryFn: () => listHomeSections(lang, 6),
  })

  if (isLoading) return <HomeSkeleton />
  if (!data) return null

  return (
    <div className="space-y-10">
      {data.sections.map((s) => (
        s.items.length > 0 && (
          <section key={s.code}>
            <header className="flex items-baseline justify-between mb-3">
              <h2 className="flex items-center gap-2 text-xl">
                <FontAwesomeIcon icon={SECTION_ICON[s.code] ?? faFire} className="text-brand-500 text-[16px]" />
                {t(SECTION_KEY[s.code] ?? '')}
              </h2>
              <Link to={`/catalog?sort=${s.code === 'top_selling' ? 'sales' : s.code === 'newest' ? 'newest' : 'trending'}`}
                className="text-[12px] text-brand-700 hover:underline">
                {t('catalog.home.see_all')} <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
              </Link>
            </header>
            {/* Una sola hilera (máx 6 columnas) — el resto del catálogo está tras el login. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {s.items.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )
      ))}
      <section>
        <h2 className="text-xl mb-3">{t('catalog.home.hot_categories')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {data.hotCategories.map((c) => (
            <Link key={c.id} to={`/catalog?categoryId=${c.id}`} data-tip={c.name}
              className="card p-4 text-center hover:border-brand-300 hover:bg-brand-50 transition-colors tooltip tooltip-bottom">
              <div className="text-[13px] font-medium text-ink-900 line-clamp-1">{c.name}</div>
              <div className="text-[11px] text-ink-500 mt-1">{c.directProductCount} prod.</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="space-y-10">
      {[0, 1, 2].map((i) => (
        <section key={i}>
          <div className="h-6 w-40 bg-ink-100 rounded animate-pulse mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="card overflow-hidden">
                <div className="aspect-square bg-ink-100 animate-pulse" />
                <div className="p-2 space-y-1.5">
                  <div className="h-3 bg-ink-100 rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-ink-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
