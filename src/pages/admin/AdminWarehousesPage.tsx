import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPen, faTrash, faWarehouse, faXmark, faCircleCheck, faBan } from '@fortawesome/free-solid-svg-icons'
import { warehouseApi, type Warehouse } from '../../api/platform'
import { useT } from '../../store/locale'
import { dialog } from '../../store/dialog'

type Draft = { code: string; name: string; country: string; city: string; active: boolean }
const EMPTY: Draft = { code: '', name: '', country: '', city: '', active: true }

/** Admin warehouses — full CRUD (DROP-594, was a read-only list). */
export default function AdminWarehousesPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data: rows = [] } = useQuery({ queryKey: ['admin-warehouses'], queryFn: warehouseApi.adminList })
  const [editing, setEditing] = useState<Warehouse | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)

  const refetch = () => qc.invalidateQueries({ queryKey: ['admin-warehouses'] })
  const onErr = (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.warehouses.error') })

  const saveMut = useMutation({
    mutationFn: () => editing ? warehouseApi.update(editing.id, draft) : warehouseApi.create(draft),
    onSuccess: () => { refetch(); setOpen(false); dialog.alert({ variant: 'success', message: t('admin.warehouses.saved') }) },
    onError: onErr,
  })
  const delMut = useMutation({
    mutationFn: (id: string) => warehouseApi.remove(id),
    onSuccess: () => { refetch(); dialog.alert({ variant: 'success', message: t('admin.warehouses.deleted') }) },
    onError: onErr,
  })

  function startCreate() { setEditing(null); setDraft(EMPTY); setOpen(true) }
  function startEdit(w: Warehouse) {
    setEditing(w)
    setDraft({ code: w.code, name: w.name, country: w.country ?? '', city: w.city ?? '', active: w.active })
    setOpen(true)
  }
  async function confirmDelete(w: Warehouse) {
    if (await dialog.confirm({ variant: 'error', message: t('admin.warehouses.delete_confirm').replace('{name}', w.name) })) delMut.mutate(w.id)
  }

  const set = (k: keyof Draft) => (e: any) => setDraft({ ...draft, [k]: k === 'active' ? e.target.checked : e.target.value })
  const cell = 'px-4 py-2'

  // Selección + acciones masivas. No hay endpoint masivo dedicado: se reutiliza el update/delete por id
  // en un bucle cliente con reporte agregado (OK/fallos).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allIds = rows.map((w) => w.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) allIds.forEach((id) => n.delete(id)); else allIds.forEach((id) => n.add(id))
    return n
  })
  async function bulkActive(active: boolean) {
    const targets = rows.filter((w) => selected.has(w.id))
    if (!targets.length) return
    setBulkBusy(true)
    let ok = 0; const fails: string[] = []
    for (const w of targets) {
      try { await warehouseApi.update(w.id, { code: w.code, name: w.name, country: w.country ?? '', city: w.city ?? '', active }); ok++ }
      catch (e: any) { fails.push(w.code + ': ' + (e?.response?.data?.message ?? '')) }
    }
    setBulkBusy(false); setSelected(new Set()); refetch()
    dialog.alert({ variant: fails.length ? 'warning' : 'success',
      message: t('admin.bulk.done').replace('{ok}', String(ok)).replace('{fail}', String(fails.length)) + (fails.length ? '\n' + fails.slice(0, 8).join('\n') : '') })
  }
  async function bulkDelete() {
    const targets = rows.filter((w) => selected.has(w.id))
    if (!targets.length) return
    if (!await dialog.confirm({ variant: 'error', message: t('admin.bulk.delete_confirm').replace('{n}', String(targets.length)) })) return
    setBulkBusy(true)
    let ok = 0; const fails: string[] = []
    for (const w of targets) {
      try { await warehouseApi.remove(w.id); ok++ }
      catch (e: any) { fails.push(w.code + ': ' + (e?.response?.data?.message ?? '')) }
    }
    setBulkBusy(false); setSelected(new Set()); refetch()
    dialog.alert({ variant: fails.length ? 'warning' : 'success',
      message: t('admin.bulk.done').replace('{ok}', String(ok)).replace('{fail}', String(fails.length)) + (fails.length ? '\n' + fails.slice(0, 8).join('\n') : '') })
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1>{t('admin.warehouses.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.warehouses.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <div className="flex items-center gap-1 flex-wrap mr-1">
              <span className="text-[11px] text-ink-500 mr-1">{t('admin.bulk.selected').replace('{n}', String(selected.size))}</span>
              <button onClick={() => bulkActive(true)} disabled={bulkBusy} className="btn btn-outline btn-sm text-[12px]" title={t('admin.warehouses.active')}>
                <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.warehouses.active')}
              </button>
              <button onClick={() => bulkActive(false)} disabled={bulkBusy} className="btn btn-outline btn-sm text-[12px]" title={t('admin.warehouses.inactive')}>
                <FontAwesomeIcon icon={faBan} /> {t('admin.warehouses.inactive')}
              </button>
              <button onClick={bulkDelete} disabled={bulkBusy} className="btn btn-outline btn-sm text-[12px] border-red-300 text-red-700 hover:bg-red-50" title={t('actions.delete')}>
                <FontAwesomeIcon icon={faTrash} /> {t('actions.delete')}
              </button>
            </div>
          )}
          <button onClick={startCreate} className="btn btn-primary text-[12px]"><FontAwesomeIcon icon={faPlus} /> {t('admin.warehouses.create')}</button>
        </div>
      </header>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="checkbox checkbox-xs" checked={allSelected} onChange={toggleAll} aria-label={t('admin.categories.select_all')} />
              </th>
              <th className={cell + ' font-medium'}>{t('admin.warehouses.field.code')}</th>
              <th className={cell + ' font-medium'}>{t('admin.warehouses.field.name')}</th>
              <th className={cell + ' font-medium'}>{t('admin.warehouses.field.country')}</th>
              <th className={cell + ' font-medium'}>{t('admin.warehouses.field.city')}</th>
              <th className={cell + ' font-medium'}>{t('admin.warehouses.field.status')}</th>
              <th className={cell + ' font-medium text-right'}>{t('admin.warehouses.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className={`border-t border-ink-100 ${selected.has(w.id) ? 'bg-brand-50/40' : ''}`}>
                <td className="px-3 py-2 w-8">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={selected.has(w.id)} onChange={() => toggleSel(w.id)} aria-label={w.code} />
                </td>
                <td className={cell + ' font-mono text-[11px]'}>{w.code}</td>
                <td className={cell}>{w.name}</td>
                <td className={cell}>{w.country || '—'}</td>
                <td className={cell}>{w.city || '—'}</td>
                <td className={cell}>
                  <span className={`badge badge-sm ${w.active ? 'badge-success' : 'badge-ghost'}`}>
                    {w.active ? t('admin.warehouses.active') : t('admin.warehouses.inactive')}
                  </span>
                </td>
                <td className={cell + ' text-right whitespace-nowrap'}>
                  <button onClick={() => startEdit(w)} className="btn btn-ghost btn-xs btn-square mr-1" title={t('admin.warehouses.edit')} aria-label={t('admin.warehouses.edit')}><FontAwesomeIcon icon={faPen} /></button>
                  <button onClick={() => confirmDelete(w)} className="btn btn-ghost btn-xs btn-square text-error" title={t('actions.delete')} aria-label={t('actions.delete')}><FontAwesomeIcon icon={faTrash} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400 text-[13px]">
                <FontAwesomeIcon icon={faWarehouse} className="text-2xl text-ink-300 block mx-auto mb-2" />
                {t('admin.warehouses.empty')}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-md p-5 border border-base-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{editing ? t('admin.warehouses.edit') : t('admin.warehouses.create')}</h3>
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm btn-square"><FontAwesomeIcon icon={faXmark} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-ink-500 mb-1 block">{t('admin.warehouses.field.code')} *</label>
                <input className="input input-bordered input-sm w-full" value={draft.code} onChange={set('code')} placeholder="ES-MAD" />
              </div>
              <div>
                <label className="text-[12px] text-ink-500 mb-1 block">{t('admin.warehouses.field.name')} *</label>
                <input className="input input-bordered input-sm w-full" value={draft.name} onChange={set('name')} placeholder="Madrid Central" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] text-ink-500 mb-1 block">{t('admin.warehouses.field.country')}</label>
                  <input className="input input-bordered input-sm w-full" value={draft.country} onChange={set('country')} placeholder="ES" />
                </div>
                <div>
                  <label className="text-[12px] text-ink-500 mb-1 block">{t('admin.warehouses.field.city')}</label>
                  <input className="input input-bordered input-sm w-full" value={draft.city} onChange={set('city')} placeholder="Madrid" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="checkbox checkbox-sm" checked={draft.active} onChange={set('active')} />
                {t('admin.warehouses.active')}
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
              <button onClick={() => saveMut.mutate()} disabled={!draft.code.trim() || !draft.name.trim() || saveMut.isPending} className="btn btn-primary btn-sm">
                {t('admin.warehouses.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
