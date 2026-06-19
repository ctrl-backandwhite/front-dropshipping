import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faRotate, faPlug, faTrashCan } from '@fortawesome/free-solid-svg-icons'
import { shopsApi } from '../../../api/platform'
import { useT } from '../../../store/locale'
import { dialog } from '../../../store/dialog'

export default function ShopsPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list })
  const { data: platforms = [] } = useQuery({ queryKey: ['shops-platforms'], queryFn: shopsApi.platforms })
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState('shopify')
  const [handle, setHandle]   = useState('')
  const [token, setToken]     = useState('')
  const isAvailable = (code: string) => platforms.find((p) => p.code === code)?.available ?? false

  const connect = useMutation({
    mutationFn: () => shopsApi.connect({ platform, shopHandle: handle, accessToken: token || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shops'] }); setShow(false); setHandle(''); setToken('') },
  })
  const sync = useMutation({ mutationFn: (id: string) => shopsApi.sync(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['shops'] }) })
  const disconnect = useMutation({ mutationFn: (id: string) => shopsApi.disconnect(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['shops'] }) })

  function Bullet({ stepKey }: { stepKey: string }) {
    return (
      <div className="text-[12px] text-ink-600">
        <div className="font-medium text-ink-800">{t(`${stepKey}.title`)}</div>
        <div className="text-ink-500 mt-1">{t(`${stepKey}.body`)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{t('shops.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('shops.subtitle')}</p>
        </div>
        <button onClick={() => setShow(true)} className="btn btn-primary">
          <FontAwesomeIcon icon={faPlus} /> {t('shops.connect')}
        </button>
      </header>

      {shops.length === 0 && (
        <div className="card p-10">
          <div className="text-center">
            <FontAwesomeIcon icon={faPlug} className="text-4xl text-ink-300 mb-3" />
            <h2 className="font-medium text-lg">{t('shops.empty.title')}</h2>
            <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">{t('shops.empty.body')}</p>
          </div>
          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-3 text-center">
              {t('shops.empty.integrations')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {platforms.map((p) => (
                <button key={p.code} disabled={!p.available}
                        onClick={() => { if (p.available) { setPlatform(p.code); setShow(true) } }}
                        className={`card p-4 text-center transition-all relative ${p.available ? 'hover:border-brand-300 hover:shadow-sm' : 'opacity-60 cursor-not-allowed'}`}>
                  <div className={`text-2xl font-bold ${p.available ? 'text-brand-600' : 'text-ink-400'}`}>{(p.label?.[0] ?? '?').toUpperCase()}</div>
                  <div className="text-[12px] mt-1 font-medium truncate">{p.label}</div>
                  {!p.available && <div className="text-[10px] mt-1 text-amber-600 font-medium">{t('shops.coming_soon')}</div>}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 grid sm:grid-cols-3 gap-3 text-center">
            <Bullet stepKey="shops.empty.step1" />
            <Bullet stepKey="shops.empty.step2" />
            <Bullet stepKey="shops.empty.step3" />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shops.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-wider text-brand-700 font-medium">{s.platform}</div>
              {/* DROP-503 */}
              <span className={`badge ${s.status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t(`shops.status.${s.status}`)}</span>
            </div>
            <div className="font-medium mt-1 truncate">{s.shopHandle}</div>
            <div className="text-[11px] text-ink-500 mt-1">{s.listings} {t('shops.listings').toLowerCase()}</div>
            {s.lastSyncAt && <div className="text-[11px] text-ink-400 mt-1">sync {new Date(s.lastSyncAt).toLocaleString()}</div>}
            {/* DROP-693: el sync ya explica por qué hay 0 productos publicados (mensaje + error). */}
            {s.lastSyncMessage && <div className="text-[11px] text-ink-600 mt-1">{s.lastSyncMessage}</div>}
            {s.lastSyncError && <div className="text-[11px] text-red-600 mt-0.5 wrap-break-word">{s.lastSyncError}</div>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => sync.mutate(s.id)} className="btn btn-outline text-[11px]">
                <FontAwesomeIcon icon={faRotate} /> {t('shops.action.sync')}
              </button>
              <button onClick={async () => {
                        const ok = await dialog.confirm({ variant: 'error',
                          message: t('shops.action.disconnect_confirm').replace('{shop}', s.shopHandle ?? s.platform ?? '') })
                        if (ok) disconnect.mutate(s.id)
                      }} className="btn btn-outline text-[11px] text-red-600">
                <FontAwesomeIcon icon={faTrashCan} /> {t('shops.action.disconnect')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md p-5">
            <h3>{t('shops.connect')}</h3>
            <form onSubmit={(e) => { e.preventDefault(); connect.mutate() }} className="space-y-3 mt-3">
              <div>
                <label className="text-xs text-ink-500">{t('shops.connect.platform')}</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input mt-1">
                  {platforms.map((p) => (
                    <option key={p.code} value={p.code} disabled={!p.available}>
                      {p.label}{p.available ? '' : ` — ${t('shops.coming_soon')}`}
                    </option>
                  ))}
                </select>
              </div>
              {/* DROP-555: autoComplete="new-password" + name únicos para que
                  Chrome no rellene el handle con el email del admin ni
                  pre-pegue tokens guardados en otras webs. */}
              <div>
                <label className="text-xs text-ink-500">{t('shops.connect.handle')}</label>
                <input required value={handle} onChange={(e) => setHandle(e.target.value)}
                       className="input mt-1" placeholder="my-shop.myshopify.com"
                       name="shop-handle" autoComplete="off" autoCapitalize="off" spellCheck={false} />
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('shops.connect.token')}</label>
                <input value={token} onChange={(e) => setToken(e.target.value)}
                       className="input mt-1" type="password"
                       name="shop-access-token" autoComplete="new-password" spellCheck={false} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShow(false)} className="btn btn-ghost">{t('common.cancel')}</button>
                <button type="submit" disabled={connect.isPending || !isAvailable(platform)} className="btn btn-primary">{connect.isPending ? t('common.saving') : t('shops.connect')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
