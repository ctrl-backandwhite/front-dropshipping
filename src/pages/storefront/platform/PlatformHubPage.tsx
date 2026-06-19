import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faStore, faMagnifyingGlassDollar, faChartLine, faGraduationCap,
  faChalkboardUser, faLifeRing, faBell, faPalette, faIndustry,
  faHandshake, faWarehouse,
} from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../../store/locale'

type Item = { to: string; labelKey: string; descKey: string; icon: any }

const ITEMS: Item[] = [
  { to: '/shops',         labelKey: 'platform.shops',         descKey: 'platform.shops_desc',         icon: faStore },
  { to: '/sourcing',      labelKey: 'platform.sourcing',      descKey: 'platform.sourcing_desc',      icon: faMagnifyingGlassDollar },
  { to: '/intelligence',  labelKey: 'platform.intelligence',  descKey: 'platform.intelligence_desc',  icon: faChartLine },
  { to: '/academy',       labelKey: 'platform.academy',       descKey: 'platform.academy_desc',       icon: faGraduationCap },
  { to: '/mentors',       labelKey: 'platform.mentors',       descKey: 'platform.mentors_desc',       icon: faChalkboardUser },
  { to: '/support',       labelKey: 'platform.support',       descKey: 'platform.support_desc',       icon: faLifeRing },
  { to: '/notifications', labelKey: 'platform.notifications', descKey: 'platform.notifications_desc', icon: faBell },
  { to: '/pod',           labelKey: 'platform.pod',           descKey: 'platform.pod_desc',           icon: faPalette },
  { to: '/odm',           labelKey: 'platform.odm',           descKey: 'platform.odm_desc',           icon: faIndustry },
  { to: '/affiliate',     labelKey: 'platform.affiliate',     descKey: 'platform.affiliate_desc',     icon: faHandshake },
  { to: '/warehouses',    labelKey: 'platform.warehouses',    descKey: 'platform.warehouses_desc',    icon: faWarehouse },
]

export default function PlatformHubPage() {
  const t = useT()
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-medium">{t('platform.hub.title')}</h1>
        <p className="text-ink-600 mt-2 max-w-2xl">{t('platform.hub.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ITEMS.map((i) => (
          <Link key={i.to} to={i.to}
                className="card p-5 hover:border-brand-300 hover:shadow-sm transition-all group">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-100">
                <FontAwesomeIcon icon={i.icon} />
              </span>
              <div className="min-w-0">
                <div className="font-medium group-hover:text-brand-700">{t(i.labelKey)}</div>
                <div className="text-[12px] text-ink-500 mt-1 line-clamp-2">{t(i.descKey)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
