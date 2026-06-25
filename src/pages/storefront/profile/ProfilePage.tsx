import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { profile } from '../../../api/profile'
import { addresses } from '../../../api/addresses'
// Tipos AddressInput/UserAddress se mueven a AddressesPage; aquí sólo listamos.
import { useAuthStore } from '../../../store/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUser, faLocationDot, faKey, faStar, faPlus, faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../../store/locale'
import { COUNTRIES } from '../../../data/countries'
import PaymentMethodsSection from '../../../components/PaymentMethodsSection'
import PlanSelectorSection from '../../../components/PlanSelectorSection'
import MySubscriptionSection from '../../../components/MySubscriptionSection'

export default function ProfilePage() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const reinit = useAuthStore((s) => s.init)

  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [country, setCountry] = useState('')
  const [language, setLanguage] = useState('es')
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '')
      setCompanyName(user.companyName ?? '')
      setCountry(user.country ?? '')
      setLanguage(user.language ?? 'es')
    }
  }, [user])

  const saveProfile = useMutation({
    mutationFn: () => profile.update({ displayName, companyName, country, language }),
    onSuccess: () => {
      reinit()
      setProfileSavedMsg(t('profile.saved'))
      setTimeout(() => setProfileSavedMsg(null), 2500)
    },
  })

  const { data: addrs = [] } = useQuery({ queryKey: ['addresses'], queryFn: addresses.list })

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const changePwd = useMutation({
    mutationFn: () => profile.changePassword({ currentPassword: oldPwd, newPassword: newPwd }),
    onSuccess: () => {
      setPwdMsg({ type: 'ok', text: t('profile.password_updated') })
      setOldPwd(''); setNewPwd('')
      setTimeout(() => setPwdMsg(null), 3000)
    },
    onError: (e: any) => {
      setPwdMsg({ type: 'err', text: e?.response?.data?.message ?? t('profile.password_err') })
    },
  })

  function onSubmitProfile(e: FormEvent) {
    e.preventDefault()
    setProfileSavedMsg(null)
    saveProfile.mutate()
  }

  async function onSubmitPwd(e: FormEvent) {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd.length < 12) {
      setPwdMsg({ type: 'err', text: t('profile.password_min') })
      return
    }
    changePwd.mutate()
  }

  if (!user) return <p className="text-sm">{t('common.loading')}</p>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1>{t('profile.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('profile.subtitle')}</p>
      </header>

      <section className="card p-5">
        <h3 className="flex items-center gap-2"><FontAwesomeIcon icon={faUser} className="text-brand-600" /> {t('profile.section.personal')}</h3>
        <form onSubmit={onSubmitProfile} className="grid sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-xs text-ink-500">{t('profile.email')}</label>
            <input value={user.email} disabled className="input mt-1 bg-ink-50" />
          </div>
          <div>
            <label className="text-xs text-ink-500">{t('profile.role')}</label>
            <input value={user.role} disabled className="input mt-1 bg-ink-50" />
          </div>
          <div>
            <label className="text-xs text-ink-500">{t('profile.display_name')}</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="text-xs text-ink-500">{t('profile.company')}</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="text-xs text-ink-500">{t('profile.country')}</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="input mt-1">
              <option value="">—</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-500">{t('profile.language')}</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input mt-1">
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={saveProfile.isPending} className="btn btn-primary">
              {saveProfile.isPending ? t('common.saving') : t('profile.save')}
            </button>
            {profileSavedMsg && (
              <span className="text-xs text-emerald-700 flex items-center gap-1">
                <FontAwesomeIcon icon={faCheck} /> {profileSavedMsg}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2"><FontAwesomeIcon icon={faLocationDot} className="text-brand-600" /> {t('profile.section.addresses')}</h3>
          <Link to="/addresses" className="btn btn-primary btn-sm">
            <FontAwesomeIcon icon={faPlus} /> {t('addresses.manage_link')}
          </Link>
        </div>

        {addrs.length === 0 && (
          <p className="text-sm text-ink-500 mt-3">{t('profile.addresses.empty')}</p>
        )}

        {addrs.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {addrs.slice(0, 4).map((a) => (
              <div key={a.id} className="border border-ink-100 rounded-md p-3 text-sm relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{a.label || a.fullName}</div>
                  {a.default && <span className="badge bg-brand-50 text-brand-700"><FontAwesomeIcon icon={faStar} className="mr-1" /> {t('checkout.default')}</span>}
                </div>
                <div className="text-xs text-ink-600 mt-1">{a.fullName}</div>
                <div className="text-xs text-ink-500">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
                <div className="text-xs text-ink-500">{a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode}</div>
                <div className="text-xs text-ink-500">{a.country}</div>
              </div>
            ))}
            {addrs.length > 4 && (
              <Link to="/addresses" className="text-xs text-brand-700 hover:underline self-center">
                +{addrs.length - 4} {t('common.more') ?? 'more'}…
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="flex items-center gap-2"><FontAwesomeIcon icon={faKey} className="text-brand-600" /> {t('profile.section.security')}</h3>
        <form onSubmit={onSubmitPwd} className="grid sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-xs text-ink-500">{t('profile.current_password')}</label>
            <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} required className="input mt-1" />
          </div>
          <div>
            <label className="text-xs text-ink-500">{t('profile.new_password')}</label>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={12} className="input mt-1" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={changePwd.isPending} className="btn btn-primary">
              {changePwd.isPending ? t('common.saving') : t('profile.change_password')}
            </button>
            {pwdMsg && (
              <span className={`text-xs ${pwdMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                {pwdMsg.text}
              </span>
            )}
          </div>
        </form>
      </section>

      <PaymentMethodsSection />
      <PlanSelectorSection />
      <MySubscriptionSection />
    </div>
  )
}

