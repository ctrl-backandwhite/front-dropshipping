import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRocket, faGlobe, faBox, faArrowRight, faPlay, faShieldHalved,
  faBolt, faChartLine, faCubesStacked,
} from '@fortawesome/free-solid-svg-icons'
import { HomeSections } from '../../components/HomeSections'
import { ShippingCountriesBanner } from '../../components/ShippingCountriesBanner'
import { useT } from '../../store/locale'
import { Reveal } from '../../components/Motion'
import { useQuery } from '@tanstack/react-query'
import { warehouseApi } from '../../api/platform'

export default function HomePage() {
  // DROP-501: contador real de warehouses sincronizado con /admin/warehouses.
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses-count'], queryFn: warehouseApi.list, staleTime: 5 * 60_000 })
  // DROP-689: el conteo es el REAL del backend (sin inventar un número si hay 0).
  const warehousesCount = warehouses.length
  const t = useT()
  return (
    <div className="space-y-20">
      {/* Hero — DROP-232 / DROP-305 / DROP-385 hero pastel + blobs */}
      <section className="hero relative isolate overflow-hidden -mx-4 lg:-mx-6 -mt-6 lg:-mt-10 px-4 lg:px-6 py-16 lg:py-24 rounded-none">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-base-100 to-accent/15" />
          <div className="absolute -top-32 -right-24 w-[32rem] h-[32rem] rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 w-[32rem] h-[32rem] rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute top-1/3 left-1/3 w-[20rem] h-[20rem] rounded-full bg-accent/15 blur-3xl" />
        </div>

        <div className="hero-content max-w-3xl mx-auto text-center flex-col">
          <div className="badge badge-outline gap-2 bg-base-100/70">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            {t('home.hero.pill')}
          </div>

          <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight">
            {t('home.hero.title_pre')}{' '}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              {t('home.hero.title_accent')}
            </span>
          </h1>

          <p className="mt-5 text-lg opacity-80 max-w-2xl mx-auto leading-relaxed">
            {t('home.hero.body')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn btn-primary">
              {t('home.hero.cta_register')} <FontAwesomeIcon icon={faArrowRight} />
            </Link>
            <Link to="/pricing" className="btn btn-outline">
              {t('home.hero.cta_pricing')}
            </Link>
            <Link to="/developers" className="btn btn-ghost btn-sm">
              <FontAwesomeIcon icon={faPlay} className="text-[10px]" /> {t('home.hero.cta_demo')}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[12px] opacity-70">
            <Trust icon={faShieldHalved} label={t('home.hero.trust_verified')} />
            <Trust icon={faGlobe}        label={t('home.hero.trust_global')} />
            <Trust icon={faBolt}         label={t('home.hero.trust_fast')} />
          </div>
        </div>
      </section>

      {/* Value props — DROP-233 / DROP-336 / DROP-386 features pastel */}
      <Reveal><section className="grid md:grid-cols-3 gap-4">
        {[
          { icon: faRocket, key: 'home.feature.curated',    tone: 'text-primary' },
          { icon: faGlobe,  key: 'home.feature.translate',  tone: 'text-secondary' },
          { icon: faBox,    key: 'home.feature.fulfilment', tone: 'text-accent' },
        ].map((c) => (
          <div key={c.key} className="card card-border bg-base-100" data-hover="true">
            <div className="card-body items-center text-center">
              <span className={`kpi-icon ${c.tone}`} style={{ width: '3.25rem', height: '3.25rem' }}>
                <FontAwesomeIcon icon={c.icon} className="text-xl" />
              </span>
              <p className="mt-2 text-[14px] leading-relaxed">{t(c.key)}</p>
            </div>
          </div>
        ))}
      </section></Reveal>

      {/* Numbers strip — daisyUI stats.
          DROP-501: ahora hay 8 locales reales (es/en/pt/zh/fr/de/it/nl) y los
          almacenes los expone `warehousesCount` desde el backend; los
          números hardcoded contradecían la vista /admin/warehouses. */}
      <Reveal delay={0.05}><section>
        <div className="stats stats-vertical sm:stats-horizontal shadow w-full bg-base-100">
          <Stat value="50k+" labelKey="home.stat.products" icon={faCubesStacked} />
          <Stat value="14"  labelKey="home.stat.categories" icon={faChartLine} />
          <Stat value={String(warehousesCount)} labelKey="home.stat.warehouses" icon={faGlobe} />
          <Stat value="8"   labelKey="home.stat.languages"  icon={faBolt} />
        </div>
      </section></Reveal>

      {/* Curated catalog (existing component) */}
      <HomeSections />

      {/* Final CTA */}
      <section className="hero bg-primary text-primary-content rounded-2xl">
        <div className="hero-content text-center py-12 lg:py-16 px-6 lg:px-12">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight">{t('home.cta.title')}</h2>
            <p className="mt-3 opacity-90">{t('home.cta.body')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="btn btn-secondary">
                {t('home.cta.signup')}
              </Link>
              <Link to="/developers" className="btn btn-outline border-primary-content/40 text-primary-content hover:bg-primary-content/10">
                {t('home.cta.docs')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* DROP-637: banner giratorio con los países a los que enviamos (cobertura real de Cainiao). */}
      <ShippingCountriesBanner />
    </div>
  )
}

function Trust({ icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <FontAwesomeIcon icon={icon} className="text-success" /> {label}
    </span>
  )
}

function Stat({ value, labelKey, icon }: { value: string; labelKey: string; icon: any }) {
  const t = useT()
  return (
    <div className="stat">
      <div className="stat-figure text-primary opacity-80">
        <FontAwesomeIcon icon={icon} className="text-2xl" />
      </div>
      <div className="stat-value text-3xl">{value}</div>
      <div className="stat-desc">{t(labelKey)}</div>
    </div>
  )
}
