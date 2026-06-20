import { useState, FormEvent, useEffect } from 'react'
import { useAuthStore } from '../../store/auth'
import { admin } from '../../api/admin'
import { profile } from '../../api/profile'
import { api } from '../../api/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faKey, faCircleCheck, faPen, faShieldHalved, faMobileScreen, faLaptop,
  faRightFromBracket, faUserPen, faQrcode, faCopy,
} from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'
import { useT, useLocaleStore } from '../../store/locale'

const COUNTRY_NAMES: Record<string, Record<string, string>> = {
  en: { ES: 'Spain', US: 'United States', MX: 'Mexico', BR: 'Brazil', CN: 'China', GB: 'United Kingdom', DE: 'Germany', FR: 'France', IT: 'Italy', JP: 'Japan' },
  es: { ES: 'España', US: 'Estados Unidos', MX: 'México', BR: 'Brasil', CN: 'China', GB: 'Reino Unido', DE: 'Alemania', FR: 'Francia', IT: 'Italia', JP: 'Japón' },
  pt: { ES: 'Espanha', US: 'Estados Unidos', MX: 'México', BR: 'Brasil', CN: 'China', GB: 'Reino Unido', DE: 'Alemanha', FR: 'França', IT: 'Itália', JP: 'Japão' },
  zh: { ES: '西班牙', US: '美国', MX: '墨西哥', BR: '巴西', CN: '中国', GB: '英国', DE: '德国', FR: '法国', IT: '意大利', JP: '日本' },
}
const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Español', pt: 'Português', zh: '中文' }

export default function AdminProfilePage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const user = useAuthStore((s) => s.user)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.displayName ?? '')
  const [company, setCompany] = useState(user?.companyName ?? '')
  const [country, setCountry] = useState(user?.country ?? '')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // DROP-436: estado real de 2FA. /me/2fa/status devuelve { enabled }.
  const [twoFa, setTwoFa] = useState(false)
  const [twoFaModal, setTwoFaModal] = useState<null | 'setup' | 'verify' | 'disable' | 'codes'>(null)
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null)
  const [twoFaQr, setTwoFaQr] = useState<string | null>(null)
  const [twoFaOtp, setTwoFaOtp] = useState('')
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([])
  const [twoFaPw, setTwoFaPw] = useState('')

  useEffect(() => {
    api.get<{ enabled: boolean }>('/me/2fa/status')
       .then((r) => setTwoFa(!!r.data.enabled))
       .catch(() => {/* ignorable: usuario sin endpoint o token inválido */})
  }, [])

  async function startTwoFaSetup() {
    try {
      // Backend devuelve { base32Secret, otpauthUrl }; el QR lo renderizamos
      // como SVG vía servicio público de QR (no añade dependencia npm).
      const { data } = await api.post<{ base32Secret: string; otpauthUrl: string }>('/me/2fa/setup')
      setTwoFaSecret(data.base32Secret)
      // QR rendering: usamos quickchart.io (libre, sin auth) para evitar añadir
      // dependencia npm de qrcode. El URL otpauth:// no se filtra fuera del
      // navegador del usuario porque el QR se renderiza desde el frontend.
      const enc = encodeURIComponent(data.otpauthUrl)
      setTwoFaQr(`https://quickchart.io/qr?text=${enc}&size=240&margin=2`)
      setTwoFaOtp('')
      setTwoFaModal('verify')
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.profile.2fa.setup_error') })
    }
  }
  async function verifyTwoFa() {
    try {
      const { data } = await api.post<{ backupCodes: string[] }>('/me/2fa/verify', { otp: twoFaOtp })
      setTwoFaBackupCodes(data.backupCodes ?? [])
      setTwoFa(true)
      setTwoFaModal('codes')
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.profile.2fa.verify_error') })
    }
  }
  async function disableTwoFa() {
    try {
      await api.post('/me/2fa/disable', { password: twoFaPw })
      setTwoFa(false); setTwoFaPw(''); setTwoFaModal(null)
      dialog.alert({ variant: 'success', message: t('admin.profile.2fa.disabled_ok') })
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.profile.2fa.disable_error') })
    }
  }
  function toggleTwoFa() {
    if (twoFa) setTwoFaModal('disable')
    else startTwoFaSetup()
  }
  // Dispositivos/sesiones conectados REALES (GET /me/sessions).
  type SessionRow = { id: string; device: string; ip?: string; createdAt: string; lastSeenAt: string; current: boolean }
  const [sessions, setSessions] = useState<SessionRow[]>([])
  function loadSessions() {
    api.get<SessionRow[]>('/me/sessions').then((r) => setSessions(r.data ?? [])).catch(() => {/* sin sesiones */})
  }
  useEffect(loadSessions, [])
  async function revokeSession(id: string) {
    try { await api.post(`/me/sessions/${id}/revoke`); loadSessions() }
    catch (e: any) { dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.profile.sessions.revoke') }) }
  }
  const deviceIcon = (device: string) => /iphone|ipad|android|ios|mobile/i.test(device) ? faMobileScreen : faLaptop
  function relativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime()
    const diffSec = Math.round(diffMs / 1000)
    if (diffSec < 60) return t('admin.profile.sessions.now')
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    if (Math.abs(diffSec) < 3600)      return rtf.format(-Math.round(diffSec / 60),       'minute')
    if (Math.abs(diffSec) < 86400)     return rtf.format(-Math.round(diffSec / 3600),     'hour')
    if (Math.abs(diffSec) < 86400 * 30) return rtf.format(-Math.round(diffSec / 86400),   'day')
    if (Math.abs(diffSec) < 86400 * 365) return rtf.format(-Math.round(diffSec / 2592000), 'month')
    return rtf.format(-Math.round(diffSec / 31536000), 'year')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setOk(false)
    if (newPw !== confirmPw) { setError(t('admin.profile.pw.mismatch')); return }
    setSubmitting(true)
    try {
      await admin.changePassword(currentPw, newPw)
      setOk(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: any) {
      setError(err?.response?.data?.message || t('admin.profile.pw.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const setUser = useAuthStore((s) => (s as any).setUser)
  // DROP-544: el botón Guardar solo mostraba toast y NO persistía. Cableamos
  // PUT /me real y refrescamos el store de auth para que el `<Field>` muestre
  // el nuevo valor sin recargar la página.
  async function saveProfile() {
    try {
      const updated = await profile.update({
        displayName: name || undefined,
        companyName: company || undefined,
        country: country || undefined,
      })
      if (typeof setUser === 'function') setUser(updated as any)
      setSavedAt(new Date())
      setEditing(false)
      dialog.alert({ variant: 'success', message: t('admin.profile.saved_ok') })
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.profile.save_failed') })
    }
  }

  function initials(s?: string) {
    if (!s) return '?'
    const parts = s.split(/\s|@/).filter(Boolean)
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  }

  const countryLabel = (cc?: string) => {
    if (!cc) return '—'
    return COUNTRY_NAMES[lang]?.[cc] ?? COUNTRY_NAMES.en[cc] ?? cc
  }
  const langLabel = (code?: string) => (code ? (LANG_NAMES[code] ?? code) : '—')

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">{t('admin.profile.title')}</h1>

      <div className="card p-6">
        <div className="flex items-start gap-4">
          {/* El avatar puede provenir de Google (avatarUrl); ya no hay subida
              de archivo: las imágenes se manejan solo por URL. */}
          <div className="relative">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar"
                   className="w-20 h-20 rounded-full object-cover border border-ink-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-2xl font-medium">
                {initials(user?.displayName ?? user?.email).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-lg">{user?.displayName ?? user?.email}</div>
            <div className="text-[12px] text-ink-500">{user?.email}</div>
            <div className="text-[12px] text-ink-500">{t(`admin.users.role.${user?.role}`)}</div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faUserPen} /> {t('admin.profile.edit')}
            </button>
          )}
        </div>

        {savedAt && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] border border-emerald-200">
            <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.profile.saved')} ({savedAt.toLocaleTimeString()})
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Field label={t('admin.profile.email')} value={user?.email} readOnly />
          {editing ? (
            <Editable label={t('admin.profile.name')} value={name} onChange={setName} />
          ) : (
            <Field label={t('admin.profile.name')} value={user?.displayName} />
          )}
          {editing ? (
            <Editable label={t('admin.profile.company')} value={company} onChange={setCompany} />
          ) : (
            <Field label={t('admin.profile.company')} value={user?.companyName} />
          )}
          {editing ? (
            <Editable label={t('admin.profile.country')} value={country} onChange={setCountry}
                      hint={t('admin.profile.country_hint')} />
          ) : (
            <Field label={t('admin.profile.country')} value={countryLabel(user?.country)} />
          )}
          <Field label={t('admin.profile.language')} value={langLabel(user?.language)} />
          <Field label={t('admin.profile.role')} value={t(`admin.users.role.${user?.role}`)} />
          <Field label={t('admin.profile.created')}
                 value={user?.createdAt ? new Date(user.createdAt).toLocaleString() : '—'} />
        </div>

        {editing && (
          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
            <button onClick={saveProfile} className="btn btn-primary text-[12px]">
              <FontAwesomeIcon icon={faPen} /> {t('admin.profile.save')}
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-medium mb-4"><FontAwesomeIcon icon={faShieldHalved} /> {t('admin.profile.security.title')}</h2>
        <div className="flex items-center justify-between py-2 border-b border-ink-100">
          <div>
            <div className="text-sm font-medium">{t('admin.profile.2fa.title')}</div>
            <div className="text-[12px] text-ink-500">{t('admin.profile.2fa.body')}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-[12px] font-medium ${twoFa ? 'text-emerald-600' : 'text-ink-400'}`}>
              {twoFa ? (t('admin.profile.2fa.on') ?? 'Activado') : (t('admin.profile.2fa.off') ?? 'Desactivado')}
            </span>
            <input type="checkbox" role="switch" checked={twoFa} onChange={toggleTwoFa}
                   aria-label={twoFa ? t('admin.profile.2fa.disable') : t('admin.profile.2fa.enable')}
                   className="toggle toggle-success" />
          </div>
        </div>

        {/* DROP-436: modal de enrolamiento — QR + verificación + backup codes */}
        {twoFaModal === 'verify' && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setTwoFaModal(null)}>
            <div onClick={(e) => e.stopPropagation()} className="card bg-base-100 p-5 w-full max-w-md space-y-3">
              <h3 className="font-medium flex items-center gap-2"><FontAwesomeIcon icon={faQrcode} /> {t('admin.profile.2fa.scan_title')}</h3>
              <p className="text-[12px] text-ink-500">{t('admin.profile.2fa.scan_body')}</p>
              {twoFaQr
                ? <img src={twoFaQr} alt="2FA QR" className="mx-auto w-44 h-44 border border-ink-100 rounded p-2 bg-white" />
                : <div className="bg-ink-50 rounded p-3 text-center font-mono text-[12px] break-all">{twoFaSecret}</div>}
              <div className="flex items-center gap-2 text-[11px] text-ink-500">
                <span className="font-mono break-all">{twoFaSecret}</span>
                <button type="button" onClick={() => navigator.clipboard.writeText(twoFaSecret ?? '')}
                        className="btn btn-xs btn-outline"><FontAwesomeIcon icon={faCopy} /></button>
              </div>
              <label className="text-xs text-ink-500 mt-2 block">{t('admin.profile.2fa.otp_label')}</label>
              <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                     value={twoFaOtp} onChange={(e) => setTwoFaOtp(e.target.value)}
                     className="input font-mono text-center text-lg tracking-widest" placeholder="123456" autoFocus />
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setTwoFaModal(null)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
                <button onClick={verifyTwoFa} disabled={twoFaOtp.length !== 6}
                        className="btn btn-primary text-[12px]">{t('admin.profile.2fa.enable')}</button>
              </div>
            </div>
          </div>
        )}
        {twoFaModal === 'codes' && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setTwoFaModal(null)}>
            <div onClick={(e) => e.stopPropagation()} className="card bg-base-100 p-5 w-full max-w-md space-y-3">
              <h3 className="font-medium flex items-center gap-2"><FontAwesomeIcon icon={faKey} /> {t('admin.profile.2fa.backup_title')}</h3>
              <p className="text-[12px] text-ink-500">{t('admin.profile.2fa.backup_body')}</p>
              <pre className="bg-ink-50 rounded p-3 text-[12px] font-mono whitespace-pre-wrap">
                {twoFaBackupCodes.join('\n')}
              </pre>
              <div className="flex justify-end gap-2">
                <button onClick={() => navigator.clipboard.writeText(twoFaBackupCodes.join('\n'))}
                        className="btn btn-outline text-[12px]"><FontAwesomeIcon icon={faCopy} /> {t('admin.profile.2fa.copy')}</button>
                <button onClick={() => setTwoFaModal(null)} className="btn btn-primary text-[12px]">{t('actions.save')}</button>
              </div>
            </div>
          </div>
        )}
        {twoFaModal === 'disable' && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setTwoFaModal(null)}>
            <div onClick={(e) => e.stopPropagation()} className="card bg-base-100 p-5 w-full max-w-sm space-y-3">
              <h3 className="font-medium">{t('admin.profile.2fa.disable_title')}</h3>
              <p className="text-[12px] text-ink-500">{t('admin.profile.2fa.disable_body')}</p>
              <input type="password" value={twoFaPw} onChange={(e) => setTwoFaPw(e.target.value)}
                     className="input" placeholder={t('admin.profile.pw.current')} autoFocus />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setTwoFaModal(null); setTwoFaPw('') }} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
                <button onClick={disableTwoFa} disabled={!twoFaPw} className="btn btn-error text-[12px]">{t('admin.profile.2fa.disable')}</button>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">{t('admin.profile.sessions.title')}</div>
          <ul className="space-y-2">
            {sessions.length === 0 && (
              <li className="text-[12px] text-ink-400">{t('admin.profile.sessions.empty') ?? 'Sin sesiones activas.'}</li>
            )}
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-2 min-w-0">
                  <FontAwesomeIcon icon={deviceIcon(s.device)} className="text-ink-500 shrink-0" />
                  <span className="truncate">{s.device}</span>
                  <span className="text-ink-400 truncate">{s.ip ? `· ${s.ip} ` : ''}· {relativeTime(new Date(s.lastSeenAt))}</span>
                  {s.current && <span className="badge bg-emerald-100 text-emerald-700 text-[10px] shrink-0">{t('admin.profile.sessions.current')}</span>}
                </span>
                {!s.current && (
                  <button onClick={() => revokeSession(s.id)}
                          className="text-[11px] text-red-600 hover:underline shrink-0">
                    <FontAwesomeIcon icon={faRightFromBracket} /> {t('admin.profile.sessions.revoke')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-medium mb-3"><FontAwesomeIcon icon={faKey} /> {t('admin.profile.pw.title')}</h2>
        {error && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
        {ok && <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
          <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.profile.pw.updated')}
        </div>}
        <form onSubmit={onSubmit} className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-ink-500 mb-1 block">{t('admin.profile.pw.current')}</label>
            <input type="password" required className="input" value={currentPw}
                   onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-ink-500 mb-1 block">{t('admin.profile.pw.new')}</label>
            <input type="password" required minLength={12} className="input" value={newPw}
                   onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-ink-500 mb-1 block">{t('admin.profile.pw.repeat')}</label>
            <input type="password" required minLength={12} className="input" value={confirmPw}
                   onChange={(e) => setConfirmPw(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? t('admin.profile.pw.updating') : t('admin.profile.pw.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, readOnly }: { label: string; value?: string | null; readOnly?: boolean }) {
  const t = useT()
  return (
    <div className="text-sm">
      <div className="text-[11px] tracking-wide text-ink-500 mb-0.5 flex items-center gap-1">
        <span>{label}</span>
        {readOnly && <span className="text-[10px] text-ink-400">· {t('admin.profile.read_only')}</span>}
      </div>
      <div className="font-medium">{value || '—'}</div>
    </div>
  )
}
function Editable({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-0.5">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input w-full text-[13px]" />
      {hint && <div className="text-[10px] text-ink-400 mt-0.5">{hint}</div>}
    </div>
  )
}
