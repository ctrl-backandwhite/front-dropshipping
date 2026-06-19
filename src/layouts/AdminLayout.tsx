import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Fragment, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGauge, faBoxesStacked, faShop, faKey, faUsers,
  faRightFromBracket, faCircleUser, faSackDollar, faTruck, faPercent, faCircleNodes,
  faBars, faXmark, faChartLine, faWallet, faStore, faMagnifyingGlassDollar, faEnvelope,
  faGraduationCap, faChalkboardUser, faLifeRing, faBell, faPalette, faIndustry,
  faHandshake, faWarehouse, faCartShopping, faTags, faSwatchbook, faLanguage, faLayerGroup, faCoins, faHeadset,
} from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { useAuthStore } from '../store/auth'
import { useCartStore } from '../store/cart'
import { useT } from '../store/locale'
import { CurrencyLanguagePicker } from '../components/CurrencyLanguagePicker'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { PageTransition, useScrollShadow } from '../components/Motion'
import { AdminGlobalSearch } from '../components/AdminGlobalSearch'
import { NotificationsDropdown } from '../components/NotificationsDropdown'

/** i18n laxo: fallback si la clave no está traducida aún. */
function tt(t: (k: string) => string, key: string, fb: string): string {
  const v = t(key); return v === key ? fb : v
}

export default function AdminLayout() {
  const { user, init, logout, initialized } = useAuthStore()
  const cartCount = useCartStore((s) => s.count())
  const openCart = useCartStore((s) => s.openDrawer)
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => { if (!initialized) init() }, [initialized, init])
  useEffect(() => { setOpen(false) }, [location.pathname])
  // OPERATOR (soporte) solo puede estar en órdenes, su área de operador o su perfil. Si intenta entrar
  // a cualquier otra pantalla del admin (dashboard/estadísticas, pricing, usuarios…), se le redirige.
  useEffect(() => {
    if (user?.role !== 'OPERATOR') return
    const p = location.pathname
    const allowed = p.startsWith('/admin/orders') || p.startsWith('/admin/operator') || p === '/admin/profile'
    if (!allowed) navigate('/admin/orders', { replace: true })
  }, [user?.role, location.pathname, navigate])
  useScrollShadow()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // Orden estándar de admin SaaS B2B: visión → trabajo diario (catálogo/ventas)
  // → dinero (finanzas) → crecimiento → infra (sistema) → cuenta.
  const navSections = [
    {
      title: t('admin.section.overview'),
      items: [
        { to: '/admin', label: t('admin.nav.dashboard'), icon: faGauge, end: true },
      ],
    },
    {
      title: t('admin.section.catalog'),
      items: [
        { to: '/admin/browse',      label: t('admin.nav.browse'),     icon: faMagnifyingGlassDollar },
        { to: '/admin/catalog',     label: t('admin.nav.products'),   icon: faBoxesStacked },
        { to: '/admin/categories',  label: t('admin.nav.categories'), icon: faTags },
        { to: '/admin/suppliers',   label: t('admin.nav.suppliers'),  icon: faIndustry },
        { to: '/admin/warehouses',  label: t('platform.warehouses'),  icon: faWarehouse },
        { to: '/admin/pricing',     label: t('admin.nav.pricing'),    icon: faPercent },
        { to: '/admin/product-groups', label: t('admin.nav.product_groups'), icon: faLayerGroup },
        { to: '/admin/languages',   label: t('admin.nav.languages'),  icon: faLanguage },
        { to: '/admin/currencies',  label: t('admin.nav.currencies'), icon: faCoins },
        { to: '/admin/taxes',       label: t('admin.nav.taxes'),      icon: faPercent },
      ],
    },
    {
      title: t('admin.section.operations'),
      items: [
        { to: '/admin/orders',     label: t('admin.nav.orders'),    icon: faTruck, operatorOk: true },
        { to: '/admin/operator/earnings', label: tt(t, 'operator.nav.earnings', 'Mis ganancias'), icon: faSackDollar, operatorOk: true },
        { to: '/admin/shops',      label: t('platform.shops'),      icon: faStore },
        { to: '/admin/sourcing',   label: t('platform.sourcing'),   icon: faShop },
        { to: '/admin/pod',        label: t('platform.pod'),        icon: faPalette },
        { to: '/admin/odm',        label: t('platform.odm'),        icon: faIndustry },
        { to: '/admin/affiliate',  label: t('platform.affiliate'),  icon: faHandshake, customerOnly: true },
      ],
    },
    {
      title: t('admin.section.finance'),
      items: [
        { to: '/admin/billing', label: t('admin.nav.billing'), icon: faSackDollar },
        { to: '/admin/wallets', label: t('admin.nav.wallets'), icon: faWallet },
        { to: '/admin/affiliates', label: t('admin.affiliates.nav'), icon: faHandshake, staffOnly: true },
      ],
    },
    {
      title: t('admin.section.growth'),
      items: [
        { to: '/admin/intelligence', label: t('platform.intelligence'), icon: faChartLine },
        { to: '/admin/newsletter',   label: t('admin.newsletter.nav'),  icon: faEnvelope, staffOnly: true },
        { to: '/admin/academy',      label: t('platform.academy'),      icon: faGraduationCap },
        { to: '/admin/mentors',      label: t('platform.mentors'),      icon: faChalkboardUser },
      ],
    },
    {
      title: t('admin.section.system'),
      items: [
        { to: '/admin/users',         label: t('admin.nav.users'),        icon: faUsers },
        { to: '/admin/operators',     label: tt(t, 'admin.nav.operators', 'Operadores'), icon: faHeadset },
        { to: '/admin/partners',      label: t('admin.nav.partners'),     icon: faKey },
        { to: '/admin/notifications', label: t('platform.notifications'), icon: faBell },
        { to: '/admin/support',       label: t('platform.support'),       icon: faLifeRing },
      ],
    },
    {
      title: t('admin.section.account'),
      items: [
        { to: '/admin/profile',    label: t('admin.nav.profile'),    icon: faCircleUser, operatorOk: true },
        { to: '/admin/styleguide', label: t('admin.nav.styleguide'), icon: faSwatchbook },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-base-200">
      {open && (
        <div onClick={() => setOpen(false)}
             className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-hidden />
      )}

      <aside
        className={`fixed z-40 inset-y-0 left-0 w-64 bg-base-100 border-r border-base-300 flex flex-col shadow-pastel-sm
                    transform transition-transform duration-500 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="navbar min-h-14 px-4 border-b border-base-200">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 flex-1" title={t('admin.back_to_site')}>
            <FontAwesomeIcon icon={faCircleNodes} className="text-primary text-lg" />
            <div>
              <div className="font-medium text-[15px] leading-tight">NX036</div>
              <div className="text-[11px] opacity-60 -mt-0.5">{t('admin.subtitle')}</div>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden btn btn-ghost btn-sm btn-square" aria-label={t('admin.nav.close_menu')}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Aside single-column: secciones como menu-title planos, ítems como li hermanos. */}
        <ul className="menu menu-sm w-full flex-1 flex-nowrap overflow-y-auto scrollbar-thin px-2 py-3 gap-0.5">
          {navSections.map((sec, i) => {
            // OPERATOR (soporte) SOLO ve las opciones marcadas operatorOk (procesar órdenes + su perfil/ganancias).
            // ADMIN ve todo. Las secciones que queden sin opciones visibles no se renderizan.
            const isOperator = user?.role === 'OPERATOR'
            const visible = sec.items.filter((it) => {
              const staff = user?.role === 'ADMIN' || user?.role === 'OPERATOR'
              if ((it as any).staffOnly && !staff) return false
              if ((it as any).customerOnly && staff) return false
              if (isOperator && !(it as any).operatorOk) return false
              return true
            })
            if (visible.length === 0) return null
            return (
            <Fragment key={sec.title}>
              <li className={`menu-title text-[10px] uppercase tracking-wider opacity-60 ${i > 0 ? 'mt-3' : ''}`}>
                {sec.title}
              </li>
              {visible.map((it) => (
                <li key={it.to}>
                  <NavLink to={it.to} end={(it as any).end}
                           className={({ isActive }) => `text-[13px] ${isActive ? 'menu-active font-medium' : ''}`}>
                    <FontAwesomeIcon icon={it.icon} className="w-4 text-center text-[12px] text-base-content/50" />
                    <span className="truncate">{it.label}</span>
                  </NavLink>
                </li>
              ))}
            </Fragment>
            )
          })}
        </ul>

        <div className="p-3 border-t border-base-200">
          {user && (
            <div className="card card-compact bg-base-200 mb-2">
              <div className="card-body p-3">
                <div className="flex items-center gap-2">
                  {/* DROP-567: en dark mode el text-primary-content quedaba
                      del mismo color que el bg-primary (perdía las letras NX).
                      Forzamos contraste con text-white + leading explícito.
                      DROP-583: si el usuario subió avatar, lo mostramos. */}
                  {(user as any).avatarUrl ? (
                    <img src={(user as any).avatarUrl} alt=""
                         className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="avatar avatar-placeholder">
                      <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center">
                        <span className="text-[11px] font-medium leading-none">{(user.displayName || user.email).slice(0, 2).toUpperCase()}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{user.displayName || user.email}</div>
                    <div className="text-[11px] opacity-60 truncate">{user.email}</div>
                  </div>
                </div>
                <span className="badge badge-primary badge-sm mt-1">{user.role}</span>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-outline btn-sm w-full">
            <FontAwesomeIcon icon={faRightFromBracket} /> {t('admin.signout')}
          </button>
        </div>
      </aside>

      <main className="lg:ml-64 min-w-0">
        <div className="navbar bg-base-100/95 backdrop-blur border-b border-base-300 shadow-pastel-sm sticky top-0 z-40 min-h-14 px-4 lg:px-6">
          <div className="navbar-start gap-2">
            <button onClick={() => setOpen(true)} className="lg:hidden btn btn-ghost btn-sm btn-square" aria-label={t('admin.nav.open_menu')}>
              <FontAwesomeIcon icon={faBars} />
            </button>
            <div className="text-[13px] opacity-70 font-medium hidden xl:block">{t('admin.subtitle')} · NX036</div>
            <AdminGlobalSearch />
          </div>
          <div className="navbar-end flex items-center gap-2">
            <div className="indicator">
              {cartCount > 0 && (
                <span className="indicator-item badge badge-primary badge-sm">{cartCount > 9 ? '9+' : cartCount}</span>
              )}
              <button onClick={openCart} className="btn btn-ghost btn-sm btn-square"
                      title={t('nav.cart')} aria-label={t('nav.cart')}>
                <FontAwesomeIcon icon={faCartShopping} />
              </button>
            </div>
            <NotificationsDropdown />
            <ThemeSwitcher />
            <Link to="/" className="btn btn-outline btn-sm hidden sm:inline-flex" title={t('admin.back_to_site')}>
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
              <span className="hidden md:inline">{t('admin.view_site')}</span>
            </Link>
            <CurrencyLanguagePicker />
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 w-full">
          <PageTransition><Outlet /></PageTransition>
        </div>
      </main>
    </div>
  )
}
