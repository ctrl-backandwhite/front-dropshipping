import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { admin } from '../../api/admin'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faStar, faCheckCircle, faShield, faBan, faCircleCheck, faFileImport, faEye, faPlus, faPen, faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'
import { Link } from 'react-router-dom'
import { useT, useLocaleStore } from '../../store/locale'
import { SearchInput } from '../../components/SearchInput'
import { FilterBar, SelectFilter } from '../../components/FilterBar'

const COUNTRY_NAMES: Record<string, Record<string, string>> = {
  es: { CN: 'China', US: 'Estados Unidos', ES: 'España', MX: 'México', BR: 'Brasil', IN: 'India', VN: 'Vietnam', TH: 'Tailandia', JP: 'Japón', KR: 'Corea del Sur', TR: 'Turquía', PL: 'Polonia', DE: 'Alemania', GB: 'Reino Unido', IT: 'Italia', FR: 'Francia' },
  en: { CN: 'China', US: 'United States', ES: 'Spain', MX: 'Mexico', BR: 'Brazil', IN: 'India', VN: 'Vietnam', TH: 'Thailand', JP: 'Japan', KR: 'South Korea', TR: 'Turkey', PL: 'Poland', DE: 'Germany', GB: 'United Kingdom', IT: 'Italy', FR: 'France' },
  pt: { CN: 'China', US: 'Estados Unidos', ES: 'Espanha', MX: 'México', BR: 'Brasil', IN: 'Índia', VN: 'Vietnã', TH: 'Tailândia', JP: 'Japão', KR: 'Coreia do Sul', TR: 'Turquia', PL: 'Polônia', DE: 'Alemanha', GB: 'Reino Unido', IT: 'Itália', FR: 'França' },
  zh: { CN: '中国', US: '美国', ES: '西班牙', MX: '墨西哥', BR: '巴西', IN: '印度', VN: '越南', TH: '泰国', JP: '日本', KR: '韩国', TR: '土耳其', PL: '波兰', DE: '德国', GB: '英国', IT: '意大利', FR: '法国' },
}
function countryName(cc?: string | null, lang: string = 'en'): string | null {
  if (!cc) return null
  return COUNTRY_NAMES[lang]?.[cc] ?? COUNTRY_NAMES.en[cc] ?? cc
}

export default function AdminSuppliersPage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['admin-suppliers'], queryFn: admin.suppliers })
  const [q, setQ] = useState('')
  const [country, setCountry] = useState<string | null>(null)
  const [verified, setVerified] = useState<string | null>(null)
  const [detail, setDetail] = useState<any | null>(null)

  const countries = useMemo(() =>
    Array.from(new Set(data.map((s) => s.country).filter(Boolean) as string[])).sort()
      .map((c) => ({ value: c, label: c })),
    [data])

  const rows = useMemo(() => {
    const needle = q.toLowerCase()
    return data.filter((s) => {
      if (country && s.country !== country) return false
      if (verified === 'yes' && !s.verified) return false
      if (verified === 'no'  && s.verified) return false
      if (needle && !((s.name ?? '').toLowerCase().includes(needle)
                   || (s.city ?? '').toLowerCase().includes(needle)
                   || (s.nameZh ?? '').toLowerCase().includes(needle))) return false
      return true
    })
  }, [data, q, country, verified])

  // Only render the Chinese sub-label for the Chinese locale (DROP-112).
  const showZh = lang === 'zh'

  // Selección + acciones masivas (sobre las filas filtradas).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const pageIds = rows.map((s) => s.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id))
    return n
  })
  async function runBulk(
    fn: (ids: string[]) => Promise<{ succeeded: number; failed: number; errors: string[] }>,
    opts?: { confirm?: { title?: string; message: string; variant?: 'error' } },
  ) {
    const ids = [...selected]
    if (!ids.length) return
    if (opts?.confirm && !await dialog.confirm({ ...opts.confirm })) return
    setBulkBusy(true)
    try {
      const r = await fn(ids)
      setSelected(new Set())
      await qc.invalidateQueries({ queryKey: ['admin-suppliers'] })
      dialog.alert({
        variant: r.failed ? 'warning' : 'success',
        message: t('admin.bulk.done').replace('{ok}', String(r.succeeded)).replace('{fail}', String(r.failed))
          + (r.failed ? '\n' + r.errors.slice(0, 8).join('\n') : ''),
      })
    } finally {
      setBulkBusy(false)
    }
  }

  // DROP-585: verify/unverify reales — antes era un dialog "soon" en la
  // rama no-verificado y un dialog "done" cosmético en la verificada.
  async function unverify(s: any) {
    if (!(await dialog.confirm(t('admin.suppliers.unverify_confirm').replace('{name}', s.name)))) return
    try {
      await admin.toggleSupplierVerified(s.id)
      qc.invalidateQueries({ queryKey: ['admin-suppliers'] })
    } catch (e: any) {
      dialog.alert(e?.response?.data?.message ?? 'No se pudo actualizar')
    }
  }
  async function verify(s: any) {
    try {
      await admin.toggleSupplierVerified(s.id)
      qc.invalidateQueries({ queryKey: ['admin-suppliers'] })
    } catch (e: any) {
      dialog.alert(e?.response?.data?.message ?? 'No se pudo actualizar')
    }
  }
  // DROP-625: alta/edición/eliminación manual de proveedores.
  const EMPTY_SUP = { name: '', nameZh: '', country: 'CN', city: '', rating: '', yearsActive: '', verified: false, trustPass: false, profileUrl: '' }
  const [supOpen, setSupOpen] = useState(false)
  const [supEditId, setSupEditId] = useState<string | null>(null)
  const [supForm, setSupForm] = useState<any>(EMPTY_SUP)
  const supErr = (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.suppliers.error') })
  function openCreateSup() { setSupEditId(null); setSupForm(EMPTY_SUP); setSupOpen(true) }
  function openEditSup(s: any) {
    setSupEditId(s.id)
    setSupForm({ name: s.name ?? '', nameZh: s.nameZh ?? '', country: s.country ?? '', city: s.city ?? '', rating: s.rating != null ? String(s.rating) : '', yearsActive: s.yearsActive != null ? String(s.yearsActive) : '', verified: !!s.verified, trustPass: !!s.trustPass, profileUrl: s.profileUrl ?? '' })
    setSupOpen(true)
  }
  async function saveSup() {
    if (!supForm.name.trim()) return
    const body = { ...supForm, rating: supForm.rating ? Number(supForm.rating) : null, yearsActive: supForm.yearsActive ? Number(supForm.yearsActive) : null }
    try {
      if (supEditId) await admin.updateSupplier(supEditId, body)
      else await admin.createSupplier(body)
      qc.invalidateQueries({ queryKey: ['admin-suppliers'] }); setSupOpen(false)
      dialog.alert({ variant: 'success', message: t('admin.suppliers.saved') })
    } catch (e) { supErr(e) }
  }
  async function block(s: any) {
    if (!(await dialog.confirm({ variant: 'error', message: t('admin.suppliers.delete_confirm').replace('{name}', s.name) }))) return
    try {
      await admin.deleteSupplier(s.id)
      qc.invalidateQueries({ queryKey: ['admin-suppliers'] })
      dialog.alert({ variant: 'success', message: t('admin.suppliers.deleted') })
    } catch (e) { supErr(e) }
  }
  function importMore() {
    dialog.alert(t('admin.suppliers.import_soon'))
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1>{t('admin.suppliers.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.suppliers.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <div className="flex items-center gap-1 flex-wrap mr-1">
              <span className="text-[11px] text-ink-500 mr-1">{t('admin.bulk.selected').replace('{n}', String(selected.size))}</span>
              <button onClick={() => runBulk((ids) => admin.bulkVerifySuppliers(ids, true))} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.suppliers.actions.verify')}>
                <FontAwesomeIcon icon={faCheckCircle} /> {t('admin.suppliers.actions.verify')}
              </button>
              <button onClick={() => runBulk((ids) => admin.bulkVerifySuppliers(ids, false))} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.suppliers.actions.unverify')}>
                <FontAwesomeIcon icon={faBan} /> {t('admin.suppliers.actions.unverify')}
              </button>
              <button onClick={() => runBulk(admin.bulkDeleteSuppliers, {
                        confirm: { variant: 'error', title: t('admin.suppliers.actions.delete'), message: t('admin.bulk.delete_confirm').replace('{n}', String(selected.size)) },
                      })} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px] border-red-300 text-red-700 hover:bg-red-50" title={t('admin.suppliers.actions.delete')}>
                <FontAwesomeIcon icon={faTrash} /> {t('admin.suppliers.actions.delete')}
              </button>
            </div>
          )}
          <button onClick={openCreateSup} className="btn btn-primary text-[12px]">
            <FontAwesomeIcon icon={faPlus} /> {t('admin.suppliers.actions.create')}
          </button>
          <button onClick={importMore} className="btn btn-outline text-[12px]">
            <FontAwesomeIcon icon={faFileImport} /> {t('admin.suppliers.actions.import')}
          </button>
        </div>
      </header>

      <FilterBar onClear={() => { setQ(''); setCountry(null); setVerified(null) }}
                 hasActive={!!q || !!country || !!verified}>
        <SearchInput value={q} onChange={setQ}
                     placeholder={t('admin.suppliers.search_placeholder')} className="min-w-[260px]" />
        {countries.length > 0 && (
          <SelectFilter label={t('admin.suppliers.col.country')}
                        value={country} options={countries}
                        onChange={setCountry} placeholder={t('filters.all')} />
        )}
        <SelectFilter label={t('admin.suppliers.col.verified')}
                      value={verified}
                      options={[
                        { value: 'yes', label: t('admin.suppliers.yes') },
                        { value: 'no',  label: t('admin.suppliers.no') },
                      ]}
                      onChange={setVerified} placeholder={t('filters.all')} />
        <span className="text-[11px] text-ink-400 ml-auto">{t('pagination.showing')} <strong>{rows.length}</strong> / {data.length}</span>
      </FilterBar>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="checkbox checkbox-xs" checked={allSelected} onChange={toggleAll} aria-label={t('admin.categories.select_all')} />
              </th>
              <th className="px-4 py-2 font-medium">{t('admin.suppliers.col.name')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.suppliers.col.city')} / {t('admin.suppliers.col.country')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.suppliers.col.rating')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.suppliers.col.years')}</th>
              <th className="px-4 py-2 font-medium text-center">{t('admin.suppliers.col.verified')}</th>
              <th className="px-4 py-2 font-medium text-center">TrustPass</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.catalog.col.product')}s</th>
              <th className="px-4 py-2 font-medium w-44">{t('admin.suppliers.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={`border-t border-ink-100 hover:bg-ink-50/50 cursor-pointer ${selected.has(s.id) ? 'bg-brand-50/40' : ''}`}>
                <td className="px-3 py-2 w-8" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="checkbox checkbox-xs" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} aria-label={s.name} />
                </td>
                <td className="px-4 py-2" onClick={() => setDetail(s)}>
                  <div className="font-medium text-[13px] text-brand-700 hover:underline">{s.name}</div>
                  {showZh && s.nameZh && <div className="text-[11px] text-ink-500">{s.nameZh}</div>}
                </td>
                <td className="px-4 py-2 text-[12px] text-ink-600">{s.city}, {countryName(s.country, lang) ?? s.country}</td>
                <td className="px-4 py-2 text-right text-[13px]">
                  <FontAwesomeIcon icon={faStar} className="text-amber-500 text-[11px]" /> {s.rating ?? '—'}
                </td>
                <td className="px-4 py-2 text-right text-[12px]">{s.yearsActive ?? '—'}</td>
                <td className="px-4 py-2 text-center">
                  {s.verified && <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500" />}
                </td>
                <td className="px-4 py-2 text-center">
                  {s.trustPass && <FontAwesomeIcon icon={faShield} className="text-brand-500" />}
                </td>
                <td className="px-4 py-2 text-right font-medium">{s.productCount}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => setDetail(s)} className="btn btn-outline text-[11px]" title={t('admin.suppliers.actions.view')}>
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                    <button onClick={() => openEditSup(s)} className="btn btn-outline text-[11px]" title={t('admin.suppliers.actions.edit')}>
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    {s.verified ? (
                      <button onClick={() => unverify(s)} className="btn btn-outline text-[11px]" title={t('admin.suppliers.actions.unverify')}>
                        <FontAwesomeIcon icon={faCircleCheck} />
                      </button>
                    ) : (
                      <button onClick={() => verify(s)} className="btn btn-outline text-[11px]" title={t('admin.suppliers.actions.verify')}>
                        <FontAwesomeIcon icon={faCheckCircle} />
                      </button>
                    )}
                    <button onClick={() => block(s)} className="btn btn-outline text-[11px] hover:border-red-300 hover:text-red-700" title={t('admin.suppliers.actions.delete')}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-ink-500 text-[13px]">{t('filters.no_results')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {detail && (
        <div onClick={() => setDetail(null)} className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="card p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">{detail.name}</h2>
                {showZh && detail.nameZh && <div className="text-[12px] text-ink-500">{detail.nameZh}</div>}
                <div className="text-[12px] text-ink-500 mt-1">
                  {detail.city ? `${detail.city}, ` : ''}{countryName(detail.country, lang) ?? '—'}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="btn btn-outline text-[11px]">{t('actions.cancel')}</button>
            </header>

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-ink-400 mb-2">{t('admin.suppliers.detail.summary')}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label={t('admin.suppliers.col.rating')} value={detail.rating} />
                <Field label={t('admin.suppliers.col.years')} value={detail.yearsActive} />
                <Field label={t('admin.suppliers.col.verified')} value={detail.verified ? t('admin.suppliers.yes') : t('admin.suppliers.no')} />
                <Field label="TrustPass" value={detail.trustPass ? t('admin.suppliers.yes') : t('admin.suppliers.no')} />
                <Field label={t('admin.catalog.col.product') + 's'} value={detail.productCount} />
                <Field label={t('admin.suppliers.detail.lead_time')} value={detail.leadTimeDays ? `${detail.leadTimeDays} d` : '—'} />
              </div>
              <div className="text-[12px] text-ink-500 mt-2">{detail.description ?? t('admin.suppliers.detail.no_description')}</div>
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-ink-400 mb-2">{t('admin.suppliers.detail.kpis')}</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Kpi label={t('admin.suppliers.detail.on_time')} value={detail.onTimePct != null ? `${detail.onTimePct}%` : '—'} />
                <Kpi label={t('admin.suppliers.detail.defect_rate')} value={detail.defectRate != null ? `${detail.defectRate}%` : '—'} />
                <Kpi label={t('admin.suppliers.detail.response_time')} value={detail.responseHours != null ? `${detail.responseHours} h` : '—'} />
              </div>
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-ink-400 mb-2">{t('admin.suppliers.detail.products')}</h3>
              <div className="text-[12px] text-ink-500">
                {t('admin.suppliers.detail.products_count').replace('{n}', String(detail.productCount ?? 0))}
              </div>
              <Link to={`/admin/catalog?supplierId=${detail.id}`}
                    onClick={() => setDetail(null)}
                    className="btn btn-outline text-[12px] mt-2 inline-flex">
                {t('admin.suppliers.detail.view_products')}
              </Link>
            </section>
          </div>
        </div>
      )}

      {supOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSupOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-lg p-5 border border-base-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">{supEditId ? t('admin.suppliers.actions.edit') : t('admin.suppliers.actions.create')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-ink-500 mb-1 block">{t('admin.suppliers.col.name')} *</label>
                <input className="input input-bordered input-sm w-full" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[12px] text-ink-500 mb-1 block">中文名</label>
                  <input className="input input-bordered input-sm w-full" value={supForm.nameZh} onChange={(e) => setSupForm({ ...supForm, nameZh: e.target.value })} /></div>
                <div><label className="text-[12px] text-ink-500 mb-1 block">{t('admin.suppliers.col.country')}</label>
                  <input className="input input-bordered input-sm w-full" value={supForm.country} onChange={(e) => setSupForm({ ...supForm, country: e.target.value })} placeholder="CN" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-[12px] text-ink-500 mb-1 block">{t('admin.suppliers.col.city')}</label>
                  <input className="input input-bordered input-sm w-full" value={supForm.city} onChange={(e) => setSupForm({ ...supForm, city: e.target.value })} /></div>
                <div><label className="text-[12px] text-ink-500 mb-1 block">{t('admin.suppliers.col.rating')}</label>
                  <input type="number" step="0.1" min="0" max="5" className="input input-bordered input-sm w-full" value={supForm.rating} onChange={(e) => setSupForm({ ...supForm, rating: e.target.value })} /></div>
                <div><label className="text-[12px] text-ink-500 mb-1 block">{t('admin.suppliers.col.years')}</label>
                  <input type="number" className="input input-bordered input-sm w-full" value={supForm.yearsActive} onChange={(e) => setSupForm({ ...supForm, yearsActive: e.target.value })} /></div>
              </div>
              <div><label className="text-[12px] text-ink-500 mb-1 block">Profile URL</label>
                <input className="input input-bordered input-sm w-full" value={supForm.profileUrl} onChange={(e) => setSupForm({ ...supForm, profileUrl: e.target.value })} /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="checkbox checkbox-sm" checked={supForm.verified} onChange={(e) => setSupForm({ ...supForm, verified: e.target.checked })} /> {t('admin.suppliers.col.verified')}</label>
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="checkbox checkbox-sm" checked={supForm.trustPass} onChange={(e) => setSupForm({ ...supForm, trustPass: e.target.checked })} /> TrustPass</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSupOpen(false)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
              <button onClick={saveSup} disabled={!supForm.name.trim()} className="btn btn-primary btn-sm">{t('admin.suppliers.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className="text-lg font-medium mt-1">{value}</div>
    </div>
  )
}
function Field({ label, value }: { label: string; value?: any }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-ink-500">{label}</div>
      <div className="font-medium">{value ?? '—'}</div>
    </div>
  )
}
