import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { admin } from '../../api/admin'
import { useT } from '../../store/locale'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faRotateRight, faTrash, faEye, faEyeSlash, faCopy, faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'

export default function AdminPartnersPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data: clients } = useQuery({ queryKey: ['admin-oauth'], queryFn: admin.oauthClients })
  const { data: apps } = useQuery({ queryKey: ['admin-apps'], queryFn: admin.partnerApps })
  const { data: hooks } = useQuery({ queryKey: ['admin-webhooks'], queryFn: admin.webhooks })
  // DROP-663: disparar un webhook de prueba a todas las apps activas y refrescar la tabla.
  const testHooks = useMutation({
    mutationFn: () => admin.testPartnerWebhooks(),
    onSuccess: async (r: any) => {
      await new Promise((res) => setTimeout(res, 1500)) // dar tiempo al drain (cada 5s) a registrar intentos
      qc.invalidateQueries({ queryKey: ['admin-webhooks'] })
      dialog.alert({ variant: 'success', message: t('admin.partners.webhook_test_sent').replace('{n}', String(r?.queued ?? 0)) })
    },
    onError: () => dialog.alert({ variant: 'error', message: t('admin.partners.webhook_test_error') }),
  })

  const [reveal, setReveal] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    client_id: '',
    scopes: 'catalog.read,orders.write',
    webhook_url: '',
    grants: ['client_credentials'] as string[],
  })
  const ALL_GRANTS = ['client_credentials', 'authorization_code', 'refresh_token']

  function copy(text: string) {
    navigator.clipboard?.writeText(text)
    dialog.alert(t('admin.partners.copied'))
  }
  const ERR = (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.partners.error') })
  function resetForm() {
    setForm({ name: '', client_id: '', scopes: 'catalog.read,orders.write', webhook_url: '', grants: ['client_credentials'] })
  }
  async function rotateSecret(alias: string) {
    if (!(await dialog.confirm(t('admin.partners.rotate_confirm').replace('{alias}', alias)))) return
    try {
      const r = await admin.rotateOAuthSecret(alias)
      await dialog.alert({ variant: 'success', message: `${t('admin.partners.rotate_done').replace('{alias}', alias)}\n\nclientSecret: ${r.clientSecret}\n${r.message ?? ''}` })
      qc.invalidateQueries({ queryKey: ['admin-oauth'] })
    } catch (e) { ERR(e) }
  }
  async function deleteClient(alias: string) {
    if (!(await dialog.confirm({ variant: 'error', message: t('admin.partners.delete_confirm').replace('{alias}', alias) }))) return
    try {
      await admin.deleteOAuthClient(alias)
      dialog.alert({ variant: 'success', message: t('admin.partners.delete_done').replace('{alias}', alias) })
      qc.invalidateQueries({ queryKey: ['admin-oauth'] })
    } catch (e) { ERR(e) }
  }
  async function createClient() {
    if (!form.name) return
    try {
      const r = await admin.createOAuthClient({ name: form.name, scopes: form.scopes.split(',').map((s) => s.trim()).filter(Boolean) })
      await dialog.alert({ variant: 'success', message: `${t('admin.partners.created').replace('{alias}', r.clientId)}\n\nclientId: ${r.clientId}\nclientSecret: ${r.clientSecret}\n\n${r.message ?? ''}` })
      setCreating(false); resetForm()
      qc.invalidateQueries({ queryKey: ['admin-oauth'] })
    } catch (e) { ERR(e) }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.partners.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.partners.subtitle')}</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-primary text-[12px]">
          <FontAwesomeIcon icon={faPlus} /> {t('admin.partners.actions.create')}
        </button>
      </header>

      <section className="card overflow-hidden">
        <div className="card-header"><span>{t('admin.partners.section.oauth')}</span></div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.alias')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.name')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.grants')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.scopes')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.secret')}</th>
              <th className="px-4 py-2 font-medium w-44">{t('admin.partners.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c) => {
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.client_name ?? '')
              const safeName = isUuid ? (c.client_id) : c.client_name
              return (
                <tr key={c.id} className="border-t border-ink-100">
                  <td className="px-4 py-2 font-mono text-xs">{c.client_id}</td>
                  <td className="px-4 py-2">{safeName}</td>
                  <td className="px-4 py-2 text-xs text-ink-500">{renderGrants(c.grant_types, t)}</td>
                  <td className="px-4 py-2 text-xs text-ink-500">{renderScopes(c.scopes, t)}</td>
                  <td className="px-4 py-2 text-[11px] font-mono">
                    {reveal[c.id] ? '••••••••-rotate-to-view' : '••••••••'}
                    <button onClick={() => setReveal((m) => ({ ...m, [c.id]: !m[c.id] }))}
                            className="ml-1 text-ink-500 hover:text-ink-700">
                      <FontAwesomeIcon icon={reveal[c.id] ? faEyeSlash : faEye} className="text-[11px]" />
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => copy(c.client_id)} className="btn btn-outline btn-square text-[11px]" title={t('admin.partners.actions.copy_id')} aria-label={t('admin.partners.actions.copy_id')}>
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                      <button onClick={() => rotateSecret(c.client_id)} className="btn btn-outline btn-square text-[11px]" title={t('admin.partners.actions.rotate')} aria-label={t('admin.partners.actions.rotate')}>
                        <FontAwesomeIcon icon={faRotateRight} />
                      </button>
                      <button onClick={() => deleteClient(c.client_id)} className="btn btn-outline btn-square text-[11px] hover:border-red-300 hover:text-red-700" title={t('admin.partners.actions.delete')} aria-label={t('admin.partners.actions.delete')}>
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header"><span>{t('admin.partners.section.apps')}</span></div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.name')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.alias')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.scopes')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.webhook')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {apps?.length ? apps.map((a: any) => (
              <tr key={a.id} className="border-t border-ink-100">
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{a.client_id}</td>
                <td className="px-4 py-2 text-xs">{renderScopes(a.scopes, t)}</td>
                <td className="px-4 py-2 text-xs">{a.webhook_url ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`badge ${a.active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-200 text-ink-600'}`}>
                    {a.active ? t('common.yes') : t('common.no')}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">{t('admin.partners.empty_apps')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <span>{t('admin.partners.section.webhooks')}</span>
          <button onClick={() => testHooks.mutate()} disabled={testHooks.isPending}
                  className="btn btn-outline btn-xs text-[12px]">
            <FontAwesomeIcon icon={faPaperPlane} className={testHooks.isPending ? 'fa-spin' : ''} /> {t('admin.partners.webhook_test')}
          </button>
        </div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.event')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.attempts')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.response')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.partners.col.date')}</th>
            </tr>
          </thead>
          <tbody>
            {hooks?.length ? hooks.map((h: any) => (
              <tr key={h.id} className="border-t border-ink-100">
                <td className="px-4 py-2">{h.event_type}</td>
                <td className="px-4 py-2">{h.status}</td>
                <td className="px-4 py-2">{h.attempt_count}</td>
                <td className="px-4 py-2">{h.response_code ?? '—'}</td>
                <td className="px-4 py-2 text-xs">{h.created_at}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">{t('admin.partners.empty_hooks')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card p-5 w-full max-w-md space-y-3">
            <h2 className="font-medium">{t('admin.partners.actions.create')}</h2>
            <div className="space-y-2 text-sm">
              <div>
                <label className="text-xs text-ink-500">{t('admin.partners.col.name')}</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                       placeholder="Acme Inc." />
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.partners.col.alias')}</label>
                <input className="input font-mono" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                       placeholder="acme-prod" />
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.partners.col.grants')}</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ALL_GRANTS.map((g) => (
                    <label key={g} className="inline-flex items-center gap-1.5 text-[12px]">
                      <input type="checkbox"
                             checked={form.grants.includes(g)}
                             onChange={(e) => setForm({
                               ...form,
                               grants: e.target.checked ? [...form.grants, g] : form.grants.filter((x) => x !== g),
                             })} />
                      {t(`admin.partners.grants.${g}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.partners.col.scopes')}</label>
                <input className="input font-mono text-[12px]" value={form.scopes}
                       onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                       placeholder="catalog.read, orders.write" />
                <div className="text-[11px] text-ink-400 mt-0.5">{t('admin.partners.scopes_hint')}</div>
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.partners.col.webhook')}</label>
                <input className="input font-mono text-[12px]" value={form.webhook_url}
                       onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                       placeholder={t('admin.partners.webhook_placeholder')} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
              <button onClick={createClient} className="btn btn-primary text-[12px]">
                <FontAwesomeIcon icon={faPlus} /> {t('admin.partners.actions.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Tag/badge renderers — keep raw OAuth tokens in monospace, but show the user-friendly label too.
function renderGrants(raw: string | null | undefined, t: (k: string) => string) {
  if (!raw) return '—'
  return raw.split(',').map((g) => g.trim()).filter(Boolean).map((g) => {
    const key = `admin.partners.grants.${g.toLowerCase().replace(/-/g, '_')}`
    const label = t(key)
    return label === key ? g : `${label}`
  }).join(' · ')
}
function renderScopes(raw: string | null | undefined, t: (k: string) => string) {
  if (!raw) return '—'
  return raw.split(/[\s,]/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const key = `admin.partners.scopes.${s.replace(/[.\-]/g, '_')}`
    const label = t(key)
    return label === key ? s : label
  }).join(' · ')
}
