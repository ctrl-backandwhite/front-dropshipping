import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTag, faCircleNodes, faCode, faSignInAlt, faGauge, faHouse,
  faRightFromBracket, faBars, faXmark,
  faUser, faReceipt, faWallet, faLocationDot, faIdCard, faStore, faHandshake, faCartShopping,
} from '@fortawesome/free-solid-svg-icons'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { useCartStore } from '../store/cart'
import { useT } from '../store/locale'
import { CurrencyLanguagePicker } from '../components/CurrencyLanguagePicker'
import { SiteFooter } from '../components/SiteFooter'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { SectionBoundary, ContentUnavailable } from '../components/ErrorBoundary'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { PageTransition, useScrollShadow } from '../components/Motion'

export default function StorefrontLayout() {
  const { user, init, initialized, logout } = useAuthStore()
  const t = useT()
  const cartCount = useCartStore((s) => s.count())
  const openCart = useCartStore((s) => s.openDrawer)
  const navigate = useNavigate()
  const location = useLocation()
  const [menu, setMenu] = useState(false)

  useEffect(() => { if (!initialized) init() }, [initialized, init])
  useEffect(() => { setMenu(false) }, [location.pathname])
  useScrollShadow()

  // Only ADMIN/OPERATOR can open the back-office console; everyone else (USER/PARTNER)
  // gets their storefront account area instead of an Admin button that bounces to home.
  const isStaff = user?.role === 'ADMIN' || user?.role === 'OPERATOR'
  // End-user account options surfaced in the header for non-staff accounts.
  const accountItems = [
    { to: '/orders',    label: t('nav.orders'),       icon: faReceipt },
    { to: '/wallet',    label: t('nav.wallet'),       icon: faWallet },
    { to: '/affiliate', label: t('platform.affiliate'), icon: faHandshake },
    { to: '/addresses', label: t('addresses.title'),  icon: faLocationDot },
    { to: '/profile',   label: t('profile.title'),    icon: faIdCard },
  ]

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  // El catálogo completo es interno (requiere login): solo se ofrece a usuarios autenticados.
  // Anónimo ve precios + developers (y el teaser del home).
  const navItems = [
    { to: '/',            label: t('nav.home'),       icon: faHouse, end: true },
    ...(user ? [{ to: '/catalog', label: t('nav.catalog'), icon: faStore, end: false }] : []),
    { to: '/pricing',     label: t('nav.pricing'),    icon: faTag,  end: false },
    { to: '/developers',  label: t('nav.developers'), icon: faCode, end: false },
  ]

  return (
    <div className="min-h-full flex flex-col">
      <header className="navbar bg-base-100 border-b border-base-200 sticky top-0 z-30 min-h-14 px-4 lg:px-6">
        <div className="navbar-start">
          <Link to="/" className="flex items-center gap-2 font-medium text-[15px]">
            <FontAwesomeIcon icon={faCircleNodes} className="text-primary" />
            <span className="hidden sm:inline">NX036 Dropshipping</span>
            <span className="sm:hidden">NX036</span>
          </Link>
        </div>

        <div className="navbar-center hidden md:flex">
          <ul className="menu menu-horizontal gap-1 text-[13px]">
            {navItems.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 ${isActive ? 'menu-active font-medium' : ''}`
                  }
                >
                  <FontAwesomeIcon icon={n.icon} className="text-[11px]" />
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="navbar-end gap-1">
          <div className="hidden sm:block">
            <CurrencyLanguagePicker />
          </div>
          <ThemeSwitcher />
          {/* Carrito: visible para cualquier visitante; abre el drawer con el contador de líneas. */}
          <div id="nx-cart-icon" className="indicator ml-2 mr-5">
            {cartCount > 0 && (
              <span className="indicator-item badge badge-primary badge-sm">{cartCount > 9 ? '9+' : cartCount}</span>
            )}
            <button onClick={openCart} className="btn btn-ghost btn-sm btn-square"
                    title={t('nav.cart')} aria-label={t('nav.cart')}>
              <FontAwesomeIcon icon={faCartShopping} />
            </button>
          </div>
          {user ? (
            <>
              {/* Staff conserva el acceso directo al panel admin; el menú de cuenta (Mis pedidos,
                  Wallet, Perfil…) se muestra SIEMPRE que hay sesión, también para staff. */}
              {isStaff && (
                <Link to="/admin" className="btn btn-primary btn-sm text-[12px] hidden sm:inline-flex">
                  <FontAwesomeIcon icon={faGauge} /> {t('nav.admin')}
                </Link>
              )}
              <div className="dropdown dropdown-end hidden sm:block">
                <button tabIndex={0} className={`btn btn-sm text-[12px] ${isStaff ? 'btn-outline' : 'btn-primary'}`}>
                  <FontAwesomeIcon icon={faUser} />
                  <span className="max-w-30 truncate">{user.displayName || t('nav.profile')}</span>
                </button>
                <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-100 rounded-box shadow-lg border border-base-200 mt-2 w-56 z-50 p-2">
                  {accountItems.map((a) => (
                    <li key={a.to}>
                      <Link to={a.to}><FontAwesomeIcon icon={a.icon} className="w-4 text-center" /> {a.label}</Link>
                    </li>
                  ))}
                  <li>
                    <button onClick={handleLogout}>
                      <FontAwesomeIcon icon={faRightFromBracket} className="w-4 text-center" /> {t('nav.signout')}
                    </button>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm text-[12px] hidden sm:inline-flex">
              <FontAwesomeIcon icon={faSignInAlt} /> {t('nav.signin')}
            </Link>
          )}
          <button onClick={() => setMenu(true)} className="md:hidden btn btn-ghost btn-sm btn-square" aria-label={t('nav.menu')}>
            <FontAwesomeIcon icon={faBars} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menu && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()}
               className="absolute right-0 top-0 bottom-0 w-[88vw] max-w-sm bg-base-100 shadow-xl flex flex-col">
            <div className="navbar bg-base-100 border-b border-base-200 min-h-14 px-4">
              <span className="flex-1 font-medium">{t('nav.menu')}</span>
              <button onClick={() => setMenu(false)} className="btn btn-ghost btn-sm btn-square">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <ul className="menu menu-sm flex-1 overflow-y-auto p-2 gap-0.5 text-sm">
              {navItems.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.end}
                    className={({ isActive }) => isActive ? 'menu-active font-medium' : ''}>
                    <FontAwesomeIcon icon={n.icon} className="w-4 text-center" /> {n.label}
                  </NavLink>
                </li>
              ))}
              {user && isStaff && (
                <li>
                  <Link to="/admin">
                    <FontAwesomeIcon icon={faGauge} className="w-4 text-center" /> {t('nav.admin')}
                  </Link>
                </li>
              )}
              {user && accountItems.map((a) => (
                <li key={a.to}>
                  <Link to={a.to}>
                    <FontAwesomeIcon icon={a.icon} className="w-4 text-center" /> {a.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="p-3 border-t border-base-200 space-y-2">
              {/* DROP: en el cajón móvil el picker está abajo del todo → su panel debe abrir HACIA
                  ARRIBA (placement="up") para no salirse de la pantalla; a ancho completo y con el
                  nombre del país para que se entienda que es el selector de país/moneda/idioma. */}
              <div className="text-[10px] uppercase tracking-wide text-ink-400 px-0.5">{t('picker.country_currency')}</div>
              <CurrencyLanguagePicker placement="up" fullWidth />
              {user ? (
                <button onClick={handleLogout} className="btn btn-outline btn-sm w-full">
                  <FontAwesomeIcon icon={faRightFromBracket} /> Salir
                </button>
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm w-full">{t('nav.signin')}</Link>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 lg:px-6 py-6 lg:py-10">
        {/* DROP-267: skip auto-breadcrumb on PDP routes — pages render their own with the product title. */}
        {location.pathname !== '/' && !/^\/(catalog|admin\/browse)\/[^/]+$/.test(location.pathname) && <Breadcrumbs />}
        {/* Contención por página: si el contenido de la ruta revienta (API caída en remoto),
            el chrome del sitio (nav/footer) se mantiene y mostramos un estado vacío limpio
            en vez de la pantalla de error. `key` por ruta para resetear al navegar. */}
        <SectionBoundary key={location.pathname} fallback={<ContentUnavailable />}>
          <PageTransition><Outlet /></PageTransition>
        </SectionBoundary>
      </main>

      <SiteFooter />

    </div>
  )
}
