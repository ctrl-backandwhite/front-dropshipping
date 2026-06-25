import { useState, FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleNodes, faSignInAlt, faEye, faEyeSlash,
  faTriangleExclamation, faShield, faBolt, faGlobe, faQuoteLeft, faArrowLeft,
} from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'
import { faGoogle, faGithub, faApple } from '@fortawesome/free-brands-svg-icons'
import { useAuthStore } from '../../store/auth'
import { API_BASE } from '../../api/client'
import { useT } from '../../store/locale'

/** i18n estricto — devuelve el fallback en lugar de exponer la clave cruda si falta la traducción. */
function tt(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key)
  return v === key ? fallback : v
}

// Only surface the demo accounts panel in non-production builds, and only when explicitly enabled.
const DEMO_PANEL_ENABLED =
  import.meta.env.MODE !== 'production' && import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true'

export default function LoginPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string }; search?: string }
  // Intento de navegación que ProtectedRoute guardó (si lo hubo); sin default fijo: el destino por
  // ausencia se decide por rol tras autenticar (staff → /admin, usuario → /catalog).
  const from = location.state?.from

  // Notices coming back from the Google OAuth2 flow (see GoogleOAuth2SuccessHandler).
  const params = new URLSearchParams(location.search || '')
  const linkRequired = params.get('link') === 'required'
  const googleError = params.get('error')
  const googleNotice = linkRequired
    ? t('login.google.link_required')
    : googleError === 'google_email_unverified'
    ? t('login.google.email_unverified')
    : googleError === 'google_no_email'
    ? t('login.google.no_email')
    : googleError === 'google'
    ? t('login.google.failed')
    : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const u = await login(email.trim(), password)
      // Honra el `from` que ProtectedRoute guardó (p.ej. /catalog, /checkout). Si no hubo intento,
      // el destino depende del rol: staff → back-office; usuario normal → catálogo (su zona de reventa).
      const isStaff = u.role === 'ADMIN' || u.role === 'OPERATOR'
      const fallback = isStaff ? '/admin' : '/catalog'
      const dest = from && from !== '/login' ? from : fallback
      navigate(dest, { replace: true })
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message
      if (status === 401) setError(t('login.error.invalid'))
      else if (status === 422 || status === 400) setError(msg || t('login.error.bad_data'))
      else if (status === 429) setError(t('login.error.rate_limit'))
      else setError(msg || t('login.error.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-base-100">
      {/* LEFT — brand panel (DROP-247 / DROP-303 / DROP-388 pastel hero + blobs) */}
      <aside className="hero relative hidden lg:flex flex-col justify-between p-10 text-primary-content isolate overflow-hidden bg-primary">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary/80 to-accent" />
          <div className="absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-base-100/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-accent/30 blur-3xl" />
        </div>

        <Link to="/" className="inline-flex items-center gap-2 font-bold text-lg">
          <FontAwesomeIcon icon={faCircleNodes} /> NX036 Dropshipping
        </Link>

        <div>
          <h2 className="text-3xl lg:text-4xl font-medium tracking-tight max-w-md">
            {t('login.brand.title')}
          </h2>
          <p className="mt-3 text-primary-content/90 max-w-md leading-relaxed">{t('login.brand.body')}</p>

          <ul className="mt-6 space-y-2.5 text-[14px]">
            <BrandPerk icon={faShield} labelKey="login.brand.perk1" />
            <BrandPerk icon={faBolt}   labelKey="login.brand.perk2" />
            <BrandPerk icon={faGlobe}  labelKey="login.brand.perk3" />
          </ul>
        </div>

        {/* DROP-388/461: testimonial en card pastel. El bug DROP-461 reportó
            "negro sobre negro" en este bloque: la combinación bg-base-100/15
            (translúcido sobre bg-primary) + text-primary-content (oscuro)
            colapsaba a contraste muy bajo en dark mode. Cambiamos a un fondo
            más opaco con borde claro y texto explícitamente claro — esto da
            >=4.5:1 en light y dark sin depender de tokens fluctuantes. */}
        <figure className="card bg-primary-content/5 backdrop-blur border border-primary-content/20 max-w-md">
          <div className="card-body p-4">
            <FontAwesomeIcon icon={faQuoteLeft} className="text-primary-content/60 text-2xl mb-2" />
            <blockquote className="text-[14px] text-primary-content leading-relaxed">
              {t('login.brand.quote')}
            </blockquote>
            <figcaption className="mt-2 text-[12px] text-primary-content/80">— {t('login.brand.quote_author')}</figcaption>
          </div>
        </figure>
      </aside>

      {/* RIGHT — login form */}
      <div className="flex items-center justify-center px-4 py-12 lg:px-12 bg-base-100">
        <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-200">
        <div className="card-body">
        <Link to="/" className="flex lg:hidden items-center justify-center gap-2 mb-2 font-bold text-lg">
          <FontAwesomeIcon icon={faCircleNodes} className="text-primary" />
          NX036 Dropshipping
        </Link>

        {/* DROP: enlace claro a la home — esta página es standalone (sin header de tienda),
            así que sin esto el usuario quedaba atrapado en móvil y escritorio. */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-3 self-start">
          <FontAwesomeIcon icon={faArrowLeft} className="text-[12px]" />
          {tt(t, 'common.back_to_store', 'Back to store')}
        </Link>

        <div>
          <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
          <p className="text-sm opacity-70 mt-1">{t('login.subtitle')}</p>

          {/* Avisos del flujo de login con Google (vinculación / email no verificado). */}
          {googleNotice && (
            <div role="alert" className={`alert mt-4 py-2 text-[13px] ${linkRequired ? 'alert-warning' : 'alert-error'}`}>
              <FontAwesomeIcon icon={linkRequired ? faShield : faTriangleExclamation} />
              <span>{googleNotice}</span>
            </div>
          )}

          {error && (
            <div role="alert" className="alert alert-error mt-5 py-2 text-sm">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              <span>{error}</span>
            </div>
          )}

          {/* SSO row — DROP-247 */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            <SsoButton provider="google" icon={faGoogle} onClick={() => {
              // El `state` de react-router no sobrevive al redirect OAuth, así que
              // guardamos el destino pretendido (p.ej. /checkout) para que el callback lo honre.
              if (from && from.startsWith('/') && !from.startsWith('//')) sessionStorage.setItem('nx-login-from', from)
              window.location.href = `${API_BASE}/oauth2/authorization/google`
            }} />
            <SsoButton provider="github" icon={faGithub} onClick={() => dialog.alert(t('login.sso_soon'))} />
            <SsoButton provider="apple"  icon={faApple}  onClick={() => dialog.alert(t('login.sso_soon'))} />
          </div>
          <div className="divider text-[11px] uppercase tracking-wider opacity-60 my-5">{t('login.or_email')}</div>

          <form onSubmit={onSubmit} className="mt-2 space-y-4">
            <div>
              <label className="text-sm opacity-80 mb-1 block">{t('login.email')}</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full"
                placeholder={t('login.email_placeholder')}
              />
            </div>
            <div>
              <label className="text-sm opacity-80 mb-1 block">{t('login.password')}</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-bordered w-full pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 px-2 opacity-60 hover:opacity-100"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={t(showPwd ? 'login.hide_password' : 'login.show_password')}
                >
                  <FontAwesomeIcon icon={showPwd ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <Link to="/password-reset" className="link link-primary link-hover">
                {t('login.forgot')}
              </Link>
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting ? (<><span className="loading loading-spinner loading-sm" /> {t('login.signing_in')}</>) : (<><FontAwesomeIcon icon={faSignInAlt} /> {t('login.submit')}</>)}
            </button>
          </form>

          <div className="mt-6 text-center text-sm opacity-70">
            {t('login.no_account')}{' '}
            <Link to="/register" className="link link-primary font-medium">
              {t('login.register')}
            </Link>
          </div>

          {DEMO_PANEL_ENABLED && (
            <div className="collapse collapse-arrow bg-base-200/40 mt-6 text-xs">
              <input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} />
              <div className="collapse-title font-semibold inline-flex items-center gap-1.5 min-h-0 py-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-warning" />
                {t('login.demo.toggle')}
              </div>
              <div className="collapse-content">
                <div role="alert" className="alert alert-warning py-2 text-[11px]">
                  <span>{t('login.demo.warning')}</span>
                </div>
                <ul className="space-y-0.5 mt-2">
                  <DemoRow role="Admin"    email="admin@nx036.local"    onPick={(e) => { setEmail(e); setPassword('') }} />
                  <DemoRow role="Operator" email="operator@nx036.local" onPick={(e) => { setEmail(e); setPassword('') }} />
                  <DemoRow role="Partner"  email="partner@nx036.local"  onPick={(e) => { setEmail(e); setPassword('') }} />
                  <DemoRow role="Customer" email="customer@nx036.local" onPick={(e) => { setEmail(e); setPassword('') }} />
                </ul>
              </div>
            </div>
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  )
}

function BrandPerk({ icon, labelKey }: { icon: any; labelKey: string }) {
  const t = useT()
  return (
    <li className="flex items-start gap-2.5">
      <span className="inline-flex w-6 h-6 items-center justify-center rounded bg-base-100/20">
        <FontAwesomeIcon icon={icon} className="text-[12px]" />
      </span>
      <span className="text-primary-content/95 leading-relaxed">{t(labelKey)}</span>
    </li>
  )
}

function SsoButton({ provider, icon, onClick }: { provider: string; icon: any; onClick: () => void }) {
  const t = useT()
  return (
    <button type="button" onClick={onClick}
            aria-label={`Sign in with ${provider}`}
            className="btn btn-outline btn-sm justify-center gap-2">
      <FontAwesomeIcon icon={icon} className="text-[16px]" />
      <span className="text-[12px] capitalize">{t(`login.sso.${provider}`)}</span>
    </button>
  )
}

function DemoRow({ role, email, onPick }: { role: string; email: string; onPick: (email: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onPick(email)}
              className="text-left hover:bg-ink-50 px-1 py-0.5 rounded w-full">
        <strong>{role}</strong>: {email}
      </button>
    </li>
  )
}
