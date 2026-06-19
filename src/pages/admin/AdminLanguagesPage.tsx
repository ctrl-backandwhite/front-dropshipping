import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash, faCheck, faXmark, faCircleCheck, faBan } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../../api/admin'
import { dialog } from '../../store/dialog'
import { useT } from '../../store/locale'

type Lang = { id: string; code: string; label: string; flag?: string; position: number; active: boolean; isDefault: boolean }

/**
 * Gestión del registro de idiomas de la tienda (ilimitado). El operador puede añadir cuantos idiomas
 * quiera (código + nombre + bandera), activarlos/desactivarlos y marcar el idioma por defecto. Estos
 * idiomas alimentan el selector de la tienda y las pestañas de contenido del editor de productos.
 */
export default function AdminLanguagesPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data: langs } = useQuery({ queryKey: ['admin-languages'], queryFn: () => admin.languages() })
  const [form, setForm] = useState({ code: '', label: '', flag: '' })

  const save = useMutation({
    mutationFn: (body: any) => admin.upsertLanguage(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-languages'] }); qc.invalidateQueries({ queryKey: ['store-languages'] }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? 'Error' }),
  })
  const del = useMutation({
    mutationFn: (id: string) => admin.deleteLanguage(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-languages'] }); qc.invalidateQueries({ queryKey: ['store-languages'] }) },
  })

  function add() {
    const code = form.code.trim().toLowerCase()
    if (!code) { dialog.alert({ variant: 'error', message: 'Indica el código del idioma (ej. ja, ar).' }); return }
    save.mutate({ code, label: form.label.trim() || code.toUpperCase(), flag: form.flag.trim() || undefined,
      position: (langs?.length ?? 0), active: true })
    setForm({ code: '', label: '', flag: '' })
  }

  const list = (langs ?? []).slice().sort((a, b) => a.position - b.position) as Lang[]

  // Selección + activar/desactivar masivo. No hay endpoint masivo: se reutiliza el upsert por idioma
  // en un bucle cliente con reporte agregado.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allIds = list.map((l) => l.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) allIds.forEach((id) => n.delete(id)); else allIds.forEach((id) => n.add(id))
    return n
  })
  async function bulkActive(active: boolean) {
    const targets = list.filter((l) => selected.has(l.id))
    if (!targets.length) return
    setBulkBusy(true)
    let ok = 0; const fails: string[] = []
    for (const l of targets) {
      try { await admin.upsertLanguage({ ...l, active }); ok++ }
      catch (e: any) { fails.push(l.code + ': ' + (e?.response?.data?.message ?? '')) }
    }
    setBulkBusy(false); setSelected(new Set())
    qc.invalidateQueries({ queryKey: ['admin-languages'] }); qc.invalidateQueries({ queryKey: ['store-languages'] })
    dialog.alert({ variant: fails.length ? 'warning' : 'success',
      message: t('admin.bulk.done').replace('{ok}', String(ok)).replace('{fail}', String(fails.length)) + (fails.length ? '\n' + fails.slice(0, 8).join('\n') : '') })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t('admin.languages.title')}</h1>
          <p className="text-ink-500 text-sm">{t('admin.languages.subtitle')}</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-ink-500 mr-1">{t('admin.bulk.selected').replace('{n}', String(selected.size))}</span>
            <button onClick={() => bulkActive(true)} disabled={bulkBusy} className="btn btn-outline btn-sm text-[12px]" title={t('admin.languages.active')}>
              <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.languages.active')}
            </button>
            <button onClick={() => bulkActive(false)} disabled={bulkBusy} className="btn btn-outline btn-sm text-[12px]" title={t('admin.languages.inactive')}>
              <FontAwesomeIcon icon={faBan} /> {t('admin.languages.inactive')}
            </button>
          </div>
        )}
      </div>

      {/* Alta de idioma */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.languages.code')}</label>
          <input className="input input-bordered input-sm w-24" value={form.code} placeholder="ja"
                 onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div>
          <label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.languages.label')}</label>
          <input className="input input-bordered input-sm w-48" value={form.label} placeholder="日本語"
                 onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </div>
        <div>
          <label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.languages.flag')}</label>
          <input className="input input-bordered input-sm w-20" value={form.flag} placeholder="🇯🇵"
                 onChange={(e) => setForm({ ...form, flag: e.target.value })} />
        </div>
        <button onClick={add} disabled={save.isPending} className="btn btn-primary btn-sm">
          <FontAwesomeIcon icon={faPlus} /> {t('admin.languages.add')}
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="checkbox checkbox-xs" checked={allSelected} onChange={toggleAll} aria-label={t('admin.categories.select_all')} />
              </th>
              <th className="px-3 py-2">{t('admin.languages.code')}</th>
              <th className="px-3 py-2">{t('admin.languages.label')}</th>
              <th className="px-3 py-2 text-center">{t('admin.languages.active')}</th>
              <th className="px-3 py-2 text-center">{t('admin.languages.default')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className={`border-t border-ink-100 ${selected.has(l.id) ? 'bg-brand-50/40' : ''}`}>
                <td className="px-3 py-2 w-8">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} aria-label={l.code} />
                </td>
                <td className="px-3 py-2 font-mono">{l.flag} {l.code}</td>
                <td className="px-3 py-2">{l.label}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => save.mutate({ ...l, active: !l.active })}
                          className={`btn btn-xs btn-circle ${l.active ? 'btn-success' : 'btn-ghost'}`}
                          title={l.active ? t('admin.languages.active') : t('admin.languages.inactive')}>
                    <FontAwesomeIcon icon={l.active ? faCheck : faXmark} />
                  </button>
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="radio" name="defaultLang" className="radio radio-xs" checked={l.isDefault}
                         onChange={() => save.mutate({ ...l, isDefault: true })} title={t('admin.languages.default')} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => dialog.confirm({ message: t('admin.languages.delete_confirm') }).then((ok) => ok && del.mutate(l.id))}
                          className="btn btn-ghost btn-xs btn-square text-error" title={t('actions.delete')}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
