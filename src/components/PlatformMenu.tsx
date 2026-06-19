import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown, faStore, faMagnifyingGlassDollar, faChartLine,
  faGraduationCap, faChalkboardUser, faLifeRing, faBell,
  faPalette, faIndustry, faHandshake, faWarehouse, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'

type Item = { to: string; labelKey: string; descKey: string; icon: any; auth: boolean }

const ITEMS: Item[] = [
  { to: '/shops',         labelKey: 'platform.shops',         descKey: 'platform.shops_desc',         icon: faStore,                auth: true  },
  { to: '/sourcing',      labelKey: 'platform.sourcing',      descKey: 'platform.sourcing_desc',      icon: faMagnifyingGlassDollar, auth: true  },
  { to: '/intelligence',  labelKey: 'platform.intelligence',  descKey: 'platform.intelligence_desc',  icon: faChartLine,            auth: true  },
  { to: '/academy',       labelKey: 'platform.academy',       descKey: 'platform.academy_desc',       icon: faGraduationCap,        auth: false },
  { to: '/mentors',       labelKey: 'platform.mentors',       descKey: 'platform.mentors_desc',       icon: faChalkboardUser,       auth: false },
  { to: '/support',       labelKey: 'platform.support',       descKey: 'platform.support_desc',       icon: faLifeRing,             auth: true  },
  { to: '/notifications', labelKey: 'platform.notifications', descKey: 'platform.notifications_desc', icon: faBell,                 auth: true  },
  { to: '/pod',           labelKey: 'platform.pod',           descKey: 'platform.pod_desc',           icon: faPalette,              auth: true  },
  { to: '/odm',           labelKey: 'platform.odm',           descKey: 'platform.odm_desc',           icon: faIndustry,             auth: true  },
  { to: '/affiliate',     labelKey: 'platform.affiliate',     descKey: 'platform.affiliate_desc',     icon: faHandshake,            auth: true  },
  { to: '/warehouses',    labelKey: 'platform.warehouses',    descKey: 'platform.warehouses_desc',    icon: faWarehouse,            auth: false },
]

export function PlatformMenu() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-ink-700 hover:text-brand-700 transition-colors"
      >
        <FontAwesomeIcon icon={faLayerGroup} className="text-[12px]" />
        <span className="hidden sm:inline">{t('platform.menu_label')}</span>
        <FontAwesomeIcon icon={faChevronDown} className="text-[9px] text-ink-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-[44rem] max-w-[90vw] bg-white border border-ink-200 rounded-md shadow-md z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">
              {t('platform.menu_section')}
            </div>
            <Link to="/platform" onClick={() => setOpen(false)}
                  className="text-[11px] text-brand-700 hover:underline">
              {t('platform.menu_view_all')}
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {ITEMS.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                onClick={() => setOpen(false)}
                className="flex items-start gap-2.5 rounded-md p-2 hover:bg-ink-50 transition-colors group"
              >
                <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-700 group-hover:bg-brand-100">
                  <FontAwesomeIcon icon={i.icon} className="text-[12px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] text-ink-800 font-medium group-hover:text-brand-700 truncate">
                    {t(i.labelKey)}
                  </span>
                  <span className="block text-[11px] text-ink-500 line-clamp-2">
                    {t(i.descKey)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
