import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { admin, CountryTaxRow, CountryRegionRow } from '../../api/admin'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPercent, faTrash, faPen, faPlus, faCircleCheck, faCircleXmark, faMapLocationDot } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../store/locale'
import { dialog } from '../../store/dialog'
// Mismos países que el selector de moneda/idioma (REGIONS), para que cualquier país que el usuario
// pueda elegir al navegar tenga su impuesto configurable y se calcule en el checkout.
import { REGIONS } from '../../i18n/regions'

// Fallback i18n: usa la traducción si existe; si no, el texto por defecto (admin interno).
function tt(t: (k: string) => string, key: string, fb: string): string {
  const v = t(key)
  return v === key ? fb : v
}

const EMPTY = { countryCode: '', label: '', ratePercent: 0, active: true }
const EMPTY_REGION = { code: '', name: '', ratePercent: '' as string, active: true }

export default function AdminTaxesPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-taxes'], queryFn: admin.taxRates })
  const [form, setForm] = useState<{ countryCode: string; label: string; ratePercent: number; active: boolean }>(EMPTY)
  const [editing, setEditing] = useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-taxes'] })
  const save = useMutation({
    mutationFn: () => admin.taxUpsert(form.countryCode.trim().toUpperCase(),
      { label: form.label, rateBps: Math.round((form.ratePercent || 0) * 100), active: form.active }),
    onSuccess: () => { invalidate(); setForm(EMPTY); setEditing(false) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })
  const toggle = useMutation({
    mutationFn: (r: CountryTaxRow) => admin.taxUpsert(r.countryCode, { label: r.label ?? '', rateBps: r.rateBps, active: !r.active }),
    onSuccess: invalidate,
  })
  const del = useMutation({
    mutationFn: (code: string) => admin.taxDelete(code),
    onSuccess: invalidate,
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })

  const edit = (r: CountryTaxRow) => { setForm({ countryCode: r.countryCode, label: r.label ?? '', ratePercent: r.ratePercent, active: r.active }); setEditing(true) }
  const remove = async (code: string) => {
    if (await dialog.confirm({ variant: 'error', message: t('admin.taxes.delete_confirm').replace('{c}', code) })) del.mutate(code)
  }

  // ===== Regiones (estado/provincia) del país seleccionado =====
  const [regionCountry, setRegionCountry] = useState<string | null>(null)
  const [regionForm, setRegionForm] = useState<{ code: string; name: string; ratePercent: string; active: boolean }>(EMPTY_REGION)
  const [regionEditing, setRegionEditing] = useState(false)
  const countryLabel = (cc: string) => REGIONS.find((x) => x.countryCode === cc)?.countryLabel ?? cc

  const { data: regions = [], isLoading: regionsLoading } = useQuery({
    queryKey: ['admin-regions', regionCountry],
    queryFn: () => admin.regions(regionCountry!),
    enabled: !!regionCountry,
  })
  const invalidateRegions = () => qc.invalidateQueries({ queryKey: ['admin-regions', regionCountry] })
  const regionSave = useMutation({
    mutationFn: () => admin.regionUpsert(regionCountry!, regionForm.code.trim().toUpperCase(), {
      name: regionForm.name.trim(),
      rateBps: regionForm.ratePercent.trim() === '' ? null : Math.round(Number(regionForm.ratePercent) * 100),
      active: regionForm.active,
    }),
    onSuccess: () => { invalidateRegions(); setRegionForm(EMPTY_REGION); setRegionEditing(false) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })
  const regionToggle = useMutation({
    mutationFn: (r: CountryRegionRow) => admin.regionUpsert(r.countryCode, r.regionCode, {
      name: r.regionName, rateBps: r.rateBps ?? null, active: !r.active, position: r.position,
    }),
    onSuccess: invalidateRegions,
  })
  const regionDel = useMutation({
    mutationFn: (code: string) => admin.regionDelete(regionCountry!, code),
    onSuccess: invalidateRegions,
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })
  const openRegions = (cc: string) => { setRegionCountry(cc); setRegionForm(EMPTY_REGION); setRegionEditing(false) }
  const editRegion = (r: CountryRegionRow) => {
    setRegionForm({ code: r.regionCode, name: r.regionName, ratePercent: r.ratePercent != null ? String(r.ratePercent) : '', active: r.active })
    setRegionEditing(true)
  }
  const removeRegion = async (r: CountryRegionRow) => {
    if (await dialog.confirm({ variant: 'error', message: tt(t, 'admin.taxes.region_delete_confirm', '¿Eliminar la región {r}?').replace('{r}', `${r.regionName} (${r.regionCode})`) })) regionDel.mutate(r.regionCode)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header>
        <h1 className="flex items-center gap-2"><FontAwesomeIcon icon={faPercent} className="text-primary" /> {t('admin.taxes.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('admin.taxes.subtitle')}</p>
      </header>

      <div className="card p-4">
        <h3 className="mb-3">{editing ? t('admin.taxes.edit') : t('admin.taxes.add')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <label className="text-xs text-ink-500">{t('admin.taxes.country')}
            <select value={form.countryCode} disabled={editing}
                    onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                    className="select select-bordered select-sm w-full mt-1">
              <option value="">{t('admin.taxes.country')}…</option>
              {REGIONS.map((r) => (
                <option key={r.countryCode} value={r.countryCode}>{r.flag} {r.countryLabel} ({r.currency})</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-500">{t('admin.taxes.label')}
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                   placeholder="IVA" className="input input-bordered input-sm w-full mt-1" />
          </label>
          <label className="text-xs text-ink-500">{t('admin.taxes.rate')} (%)
            <input type="number" step="0.01" min="0" value={form.ratePercent}
                   onChange={(e) => setForm({ ...form, ratePercent: Number(e.target.value) })}
                   placeholder="21" className="input input-bordered input-sm w-full mt-1" />
          </label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-500 flex-1">
              <input type="checkbox" className="toggle toggle-sm toggle-success" checked={form.active}
                     onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {t('admin.taxes.active')}
            </label>
            <button onClick={() => save.mutate()} disabled={!form.countryCode || save.isPending} className="btn btn-primary btn-sm">
              <FontAwesomeIcon icon={faPlus} /> {t('common.save')}
            </button>
            {editing && <button onClick={() => { setForm(EMPTY); setEditing(false) }} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>}
          </div>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-ink-500">{t('common.loading')}</p> : (
        <div className="card overflow-x-auto">
          <table className="table table-zebra text-sm">
            <thead>
              <tr>
                <th>{t('admin.taxes.country')}</th>
                <th>{t('admin.taxes.label')}</th>
                <th className="text-right">{t('admin.taxes.rate')}</th>
                <th>{t('admin.taxes.active')}</th>
                <th className="w-40"></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && <tr><td colSpan={5} className="text-center text-ink-400 py-6">{t('admin.taxes.empty')}</td></tr>}
              {data.map((r: CountryTaxRow) => (
                <tr key={r.countryCode} className={regionCountry === r.countryCode ? 'bg-primary/5' : ''}>
                  <td className="font-medium">{REGIONS.find((x) => x.countryCode === r.countryCode)?.flag ?? ''} <span className="font-mono">{r.countryCode}</span> <span className="text-ink-500 font-normal">{countryLabel(r.countryCode)}</span></td>
                  <td className="text-ink-600">{r.label || '—'}</td>
                  <td className="text-right tabular-nums">{r.ratePercent}%</td>
                  <td>
                    <button onClick={() => toggle.mutate(r)} className={`badge cursor-pointer ${r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
                      <FontAwesomeIcon icon={r.active ? faCircleCheck : faCircleXmark} className="mr-1" />
                      {r.active ? t('admin.taxes.active') : t('admin.taxes.inactive')}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openRegions(r.countryCode)} className="btn btn-ghost btn-xs" title={tt(t, 'admin.taxes.manage_regions', 'Regiones')}>
                        <FontAwesomeIcon icon={faMapLocationDot} /> {tt(t, 'admin.taxes.manage_regions', 'Regiones')}
                      </button>
                      <button onClick={() => edit(r)} className="btn btn-ghost btn-xs btn-square" title={t('common.edit')}><FontAwesomeIcon icon={faPen} /></button>
                      <button onClick={() => remove(r.countryCode)} className="btn btn-ghost btn-xs btn-square text-error" title={t('common.delete')}><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Panel de regiones del país seleccionado ===== */}
      {regionCountry && (
        <div className="card p-4 border-2 border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2">
              <FontAwesomeIcon icon={faMapLocationDot} className="text-primary" />
              {tt(t, 'admin.taxes.regions', 'Regiones (estado/provincia)')} · <span className="font-mono">{regionCountry}</span> <span className="text-ink-500 font-normal">{countryLabel(regionCountry)}</span>
            </h3>
            <button onClick={() => setRegionCountry(null)} className="btn btn-ghost btn-xs">{t('common.close') === 'common.close' ? 'Cerrar' : t('common.close')}</button>
          </div>
          <p className="text-xs text-ink-500 mb-3">{tt(t, 'admin.taxes.region_hint', 'Deja la tasa vacía para usar la nacional del país. Solo se aplica una tasa propia donde el impuesto varía por región (US/CA/BR).')}</p>

          {/* Alta/edición de región */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end mb-4">
            <label className="text-xs text-ink-500">{tt(t, 'admin.taxes.region_code', 'Código')}
              <input value={regionForm.code} disabled={regionEditing}
                     onChange={(e) => setRegionForm({ ...regionForm, code: e.target.value })}
                     placeholder="CA" className="input input-bordered input-sm w-full mt-1 font-mono" />
            </label>
            <label className="text-xs text-ink-500">{tt(t, 'admin.taxes.region_name', 'Nombre')}
              <input value={regionForm.name} onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })}
                     placeholder="California" className="input input-bordered input-sm w-full mt-1" />
            </label>
            <label className="text-xs text-ink-500">{tt(t, 'admin.taxes.region_rate', 'Tasa propia (%)')}
              <input type="number" step="0.01" min="0" value={regionForm.ratePercent}
                     onChange={(e) => setRegionForm({ ...regionForm, ratePercent: e.target.value })}
                     placeholder={tt(t, 'admin.taxes.region_national', 'Nacional')} className="input input-bordered input-sm w-full mt-1" />
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-ink-500 flex-1">
                <input type="checkbox" className="toggle toggle-sm toggle-success" checked={regionForm.active}
                       onChange={(e) => setRegionForm({ ...regionForm, active: e.target.checked })} />
                {t('admin.taxes.active')}
              </label>
              <button onClick={() => regionSave.mutate()} disabled={!regionForm.code.trim() || !regionForm.name.trim() || regionSave.isPending} className="btn btn-primary btn-sm">
                <FontAwesomeIcon icon={faPlus} /> {t('common.save')}
              </button>
              {regionEditing && <button onClick={() => { setRegionForm(EMPTY_REGION); setRegionEditing(false) }} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>}
            </div>
          </div>

          {regionsLoading ? <p className="text-sm text-ink-500">{t('common.loading')}</p> : (
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm text-sm">
                <thead>
                  <tr>
                    <th>{tt(t, 'admin.taxes.region_code', 'Código')}</th>
                    <th>{tt(t, 'admin.taxes.region_name', 'Nombre')}</th>
                    <th className="text-right">{tt(t, 'admin.taxes.region_rate', 'Tasa propia (%)')}</th>
                    <th>{t('admin.taxes.active')}</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {regions.length === 0 && <tr><td colSpan={5} className="text-center text-ink-400 py-6">{tt(t, 'admin.taxes.no_regions', 'Este país no tiene regiones. Añade una arriba.')}</td></tr>}
                  {regions.map((r: CountryRegionRow) => (
                    <tr key={r.regionCode}>
                      <td className="font-mono">{r.regionCode}</td>
                      <td className="text-ink-700">{r.regionName}</td>
                      <td className="text-right tabular-nums">{r.ratePercent != null ? `${r.ratePercent}%` : <span className="text-ink-400">{tt(t, 'admin.taxes.region_national', 'Nacional')}</span>}</td>
                      <td>
                        <button onClick={() => regionToggle.mutate(r)} className={`badge cursor-pointer ${r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
                          <FontAwesomeIcon icon={r.active ? faCircleCheck : faCircleXmark} className="mr-1" />
                          {r.active ? t('admin.taxes.active') : t('admin.taxes.inactive')}
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => editRegion(r)} className="btn btn-ghost btn-xs btn-square" title={t('common.edit')}><FontAwesomeIcon icon={faPen} /></button>
                          <button onClick={() => removeRegion(r)} className="btn btn-ghost btn-xs btn-square text-error" title={t('common.delete')}><FontAwesomeIcon icon={faTrash} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
