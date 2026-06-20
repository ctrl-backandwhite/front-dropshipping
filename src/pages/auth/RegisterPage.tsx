import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNodes, faUserPlus, faShield, faBolt, faGlobe, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { useAuthStore } from '../../store/auth'
import { useT, useLocaleStore, LOCALE_OPTIONS } from '../../store/locale'

export default function RegisterPage() {
  const t = useT()
  const activeLocale = useLocaleStore((s) => s.locale)
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirm: '',
    displayName: '',
    companyName: '',
    country: '',
    // DROP-460: default al locale activo del usuario, no hardcoded 'en'.
    language: activeLocale,
  })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.')
      return
    }
    setSubmitting(true)
    try {
      const res = await register({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        country: form.country.trim() || undefined,
        language: form.language,
      })
      // DROP-458: usa la clave i18n local; si el backend trae texto en otro idioma se descarta.
      const localMsg = t('register.success')
      setDone(localMsg !== 'register.success' ? localMsg : (res.message ?? 'OK'))
      setTimeout(() => navigate('/activate'), 2500)
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message
      const fields = err?.response?.data?.fields
      if (status === 409) setError('Ya existe una cuenta con ese email.')
      else if (status === 422 && msg) setError(msg)
      else if (status === 400 && fields) setError(Object.values(fields).join(' · '))
      else if (status === 429) setError('Demasiados registros desde tu IP. Espera una hora.')
      else setError(msg || 'No se pudo crear la cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-base-100">
      {/* DROP-457: hero a la izquierda (igual estructura que /login) — pastel gradient. */}
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
            {t('register.hero.title')}
          </h2>
          <p className="mt-3 text-primary-content/90 max-w-md leading-relaxed">{t('register.hero.body')}</p>
          <ul className="mt-6 space-y-2.5 text-[14px]">
            <li className="inline-flex items-start gap-2.5">
              <span className="inline-flex w-6 h-6 items-center justify-center rounded bg-base-100/20">
                <FontAwesomeIcon icon={faShield} className="text-[12px]" />
              </span>
              <span className="text-primary-content/95">{t('register.hero.perk1')}</span>
            </li>
            <li className="inline-flex items-start gap-2.5">
              <span className="inline-flex w-6 h-6 items-center justify-center rounded bg-base-100/20">
                <FontAwesomeIcon icon={faBolt} className="text-[12px]" />
              </span>
              <span className="text-primary-content/95">{t('register.hero.perk2')}</span>
            </li>
            <li className="inline-flex items-start gap-2.5">
              <span className="inline-flex w-6 h-6 items-center justify-center rounded bg-base-100/20">
                <FontAwesomeIcon icon={faGlobe} className="text-[12px]" />
              </span>
              <span className="text-primary-content/95">{t('register.hero.perk3')}</span>
            </li>
          </ul>
        </div>
        <div /> {/* spacer for justify-between */}
      </aside>

      {/* RIGHT — form */}
      <div className="flex items-center justify-center px-4 py-10 lg:px-12 bg-base-100">
        <div className="card w-full max-w-lg bg-base-100 shadow-xl border border-base-200">
        <Link to="/" className="flex lg:hidden items-center justify-center gap-2 mt-4 font-bold text-lg">
          <FontAwesomeIcon icon={faCircleNodes} className="text-primary" />
          NX036 Dropshipping
        </Link>
        <div className="card-body">
          {/* DROP: enlace claro a la home — página standalone sin header de tienda. */}
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-1 self-start">
            <FontAwesomeIcon icon={faArrowLeft} className="text-[12px]" />
            Volver a la tienda
          </Link>
          <h1 className="text-2xl font-semibold">{t('register.title')}</h1>
          <p className="text-sm opacity-70 mt-1">{t('register.subtitle')}</p>

          {error && (
            <div role="alert" className="alert alert-error mt-5 py-2 text-sm"><span>{error}</span></div>
          )}
          {/* DROP-459: el alert-success por defecto puede tener bajo contraste; forzamos
              border-l y un text-success-content fuerte para asegurar legibilidad. */}
          {done && (
            <div role="alert"
                 className="alert alert-success mt-5 py-2 text-sm border-l-4 border-success !text-success-content font-medium">
              <FontAwesomeIcon icon={faCircleNodes} className="opacity-70" />
              <span>{done}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-slate-600 mb-1 block">Email *</label>
              <input type="email" required autoComplete="email" className="input input-bordered w-full"
                     value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Contraseña *</label>
              <input type="password" required minLength={12} className="input input-bordered w-full"
                     autoComplete="new-password"
                     value={form.password} onChange={(e) => set('password', e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">Min. 12, mayúscula, dígito, símbolo.</p>
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Repetir contraseña *</label>
              <input type="password" required minLength={12} className="input input-bordered w-full"
                     value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Nombre</label>
              <input className="input input-bordered w-full" maxLength={120}
                     value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Empresa</label>
              <input className="input input-bordered w-full" maxLength={180}
                     value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
            </div>
            <div>
              <label className="text-sm opacity-70 mb-1 block">{t('register.country')}</label>
              <input className="input input-bordered w-full" maxLength={60} placeholder="ES, US, MX…"
                     value={form.country} onChange={(e) => set('country', e.target.value)} />
            </div>
            <div>
              <label className="text-sm opacity-70 mb-1 block">{t('register.language')}</label>
              <select className="select select-bordered w-full" value={form.language} onChange={(e) => set('language', e.target.value)}>
                {LOCALE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 mt-2">
              <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                {submitting ? (<><span className="loading loading-spinner loading-sm" /> Creando…</>) : (<><FontAwesomeIcon icon={faUserPlus} /> Crear cuenta</>)}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm opacity-70">
            ¿Ya tienes cuenta? <Link to="/login" className="link link-primary font-medium">Inicia sesión</Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
