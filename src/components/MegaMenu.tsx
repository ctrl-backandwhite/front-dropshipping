import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars, faChevronDown, faShirt, faMobileScreen, faHouse, faSpa, faDumbbell,
  faGamepad, faCar, faPaw, faPalette, faCookieBite, faBookOpen, faIndustry,
  faTags, faFolder,
} from '@fortawesome/free-solid-svg-icons'
import { listCategories } from '../api/catalog'
import { useT, useLocaleStore } from '../store/locale'

const SLUG_ICONS: Record<string, any> = {
  'consumer-electronics': faMobileScreen,
  'fashion-apparel':      faShirt,
  'home-kitchen':         faHouse,
  'beauty-personal-care': faSpa,
  'sports-outdoors':      faDumbbell,
  'toys-gifts':           faGamepad,
  'automotive':           faCar,
  'pet-supplies':         faPaw,
  'arts-crafts':          faPalette,
  'food-beverage':        faCookieBite,
  'books-media':          faBookOpen,
  'industrial-tools':     faIndustry,
  'jewelry-accessories':  faTags,
}

export function MegaMenu() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: cats = [] } = useQuery({
    queryKey: ['storefront-categories', lang],
    queryFn: () => listCategories(lang),
  })

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Sort by name and split into top (with products) / rest.
  const sorted = [...cats].sort((a, b) => (b.directProductCount ?? 0) - (a.directProductCount ?? 0))
  const featured = sorted.slice(0, 6)
  const rest = sorted.slice(6)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-ink-700 hover:text-brand-700 transition-colors focus-ring"
      >
        <FontAwesomeIcon icon={faBars} className="text-[12px]" />
        <span className="hidden sm:inline">{t('mega.shop_by_category')}</span>
        <FontAwesomeIcon icon={faChevronDown} className={`text-[9px] text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" aria-label={t('mega.shop_by_category')}
             className="absolute left-0 top-full mt-2 w-full lg:w-[56rem] max-w-[92vw] max-h-[80vh] overflow-y-auto bg-white border border-ink-200 rounded-lg shadow-lg z-50 p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-5">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-3">
                {t('mega.featured')}
              </div>
              <ul className="space-y-1">
                {featured.map((c) => (
                  <li key={c.id}>
                    <Link to={`/admin/catalog?categoryId=${c.id}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2.5 rounded-md p-2 hover:bg-ink-50 group">
                      <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-brand-50 text-brand-700 group-hover:bg-brand-100">
                        <FontAwesomeIcon icon={SLUG_ICONS[c.slug] ?? faFolder} className="text-[13px]" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-medium text-ink-800 truncate group-hover:text-brand-700">{c.name}</span>
                        <span className="block text-[11px] text-ink-500">{c.directProductCount} {t('mega.products_short')}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-3">
                {t('mega.all_categories')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
                {rest.map((c) => (
                  <Link key={c.id} to={`/admin/catalog?categoryId=${c.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 text-[13px] text-ink-700 hover:text-brand-700 hover:bg-ink-50 rounded px-2 py-1.5">
                    <FontAwesomeIcon icon={SLUG_ICONS[c.slug] ?? faFolder} className="text-[11px] text-ink-400" />
                    <span className="truncate">{c.name}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-ink-100">
                <Link to="/catalog" onClick={() => setOpen(false)}
                      className="text-[12px] text-brand-700 hover:underline">
                  {t('mega.view_all')} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
