import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { admin, PriceRule } from '../../api/admin'
import { listCategories, listSuppliers, listStorefrontProducts } from '../../api/catalog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrashCan, faPencil, faCircleCheck, faBan } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { dialog } from '../../store/dialog'

const emptyRule: Partial<PriceRule> = {
  scope: 'GLOBAL', marginType: 'PERCENTAGE', marginValue: 30, active: true, position: 0, description: '',
}

export default function AdminPricingPage() {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  const qc = useQueryClient()
  const { data: rules } = useQuery({ queryKey: ['admin-rules'], queryFn: admin.priceRules })
  // DROP-696: para elegir el ámbito sin escribir un UUID, se cargan las entidades del scope.
  const { data: scopeCats = [] } = useQuery({ queryKey: ['cats', 'es'], queryFn: () => listCategories('es'), staleTime: 60_000 })
  const { data: scopeSups = [] } = useQuery({ queryKey: ['sups'], queryFn: listSuppliers, staleTime: 60_000 })
  const { data: scopeProds } = useQuery({ queryKey: ['scope-prods'], queryFn: () => listStorefrontProducts(0, 200, 'es'), staleTime: 60_000 })
  const { data: scopeGroups = [] } = useQuery({ queryKey: ['scope-groups'], queryFn: admin.productGroups, staleTime: 60_000 })

  // DROP-126: highlight duplicate rules so admins can clean them up.
  const seen = new Map<string, number>()
  const dupKeys = new Set<string>()
  rules?.forEach((r) => {
    const key = `${r.scope}|${r.scopeId ?? ''}|${r.marginType}|${r.marginValue}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
    if (seen.get(key)! > 1) dupKeys.add(key)
  })
  const [editing, setEditing] = useState<Partial<PriceRule> | null>(null)

  // DROP-630: warn when the rule being edited overlaps an existing active rule of the SAME
  // scope+scopeId on the cost range — the source of non-deterministic resolution.
  const rangesOverlap = (aMin?: number | null, aMax?: number | null, bMin?: number | null, bMax?: number | null) => {
    const lo1 = aMin ?? -Infinity, hi1 = aMax ?? Infinity
    const lo2 = bMin ?? -Infinity, hi2 = bMax ?? Infinity
    return lo1 <= hi2 && lo2 <= hi1
  }
  const overlappingRules = editing
    ? (rules ?? []).filter((r) =>
        r.id !== editing.id && r.active && editing.active !== false &&
        r.scope === editing.scope && (r.scopeId ?? '') === (editing.scopeId ?? '') &&
        rangesOverlap(editing.minCostUsd, editing.maxCostUsd, r.minCostUsd, r.maxCostUsd))
    : []

  // Una regla de margen afecta a TODOS los precios mostrados. Tras crear/editar/activar/eliminar
  // hay que invalidar también las queries del catálogo, home, fichas y pickers de producto para que
  // el cambio se refleje al instante en el front (el backend ya recalcula; era la caché de TanStack).
  const invalidatePrices = () => {
    ['admin-rules', 'catalog', 'product', 'product-specs', 'product-attrs',
     'home-sections', 'storefront-products', 'scope-prods'].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }))
  }

  const save = useMutation({
    mutationFn: (r: Partial<PriceRule>) =>
      r.id ? admin.updateRule(r.id, r) : admin.createRule(r),
    onSuccess: () => { invalidatePrices(); setEditing(null) },
  })
  const remove = useMutation({
    mutationFn: (id: string) => admin.deleteRule(id),
    onSuccess: () => invalidatePrices(),
  })
  const toggle = useMutation({
    mutationFn: (id: string) => admin.toggleRule(id),
    onSuccess: () => invalidatePrices(),
  })

  // Selección + acciones masivas sobre las reglas.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allIds = (rules ?? []).map((r) => r.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) allIds.forEach((id) => n.delete(id)); else allIds.forEach((id) => n.add(id))
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
      invalidatePrices()
      dialog.alert({
        variant: r.failed ? 'warning' : 'success',
        message: t('admin.bulk.done').replace('{ok}', String(r.succeeded)).replace('{fail}', String(r.failed))
          + (r.failed ? '\n' + r.errors.slice(0, 8).join('\n') : ''),
      })
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1>{t('admin.pricing.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.pricing.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <div className="flex items-center gap-1 flex-wrap mr-1">
              <span className="text-[11px] text-ink-500 mr-1">{t('admin.bulk.selected').replace('{n}', String(selected.size))}</span>
              <button onClick={() => runBulk((ids) => admin.bulkToggleRules(ids, true))} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.pricing.activate')}>
                <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.pricing.activate')}
              </button>
              <button onClick={() => runBulk((ids) => admin.bulkToggleRules(ids, false))} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.pricing.deactivate')}>
                <FontAwesomeIcon icon={faBan} /> {t('admin.pricing.deactivate')}
              </button>
              <button onClick={() => runBulk(admin.bulkDeleteRules, {
                        confirm: { variant: 'error', title: t('admin.pricing.delete_title'), message: t('admin.bulk.delete_confirm').replace('{n}', String(selected.size)) },
                      })} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px] border-red-300 text-red-700 hover:bg-red-50" title={t('actions.delete')}>
                <FontAwesomeIcon icon={faTrashCan} /> {t('actions.delete')}
              </button>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setEditing({ ...emptyRule })}>
            <FontAwesomeIcon icon={faPlus} /> {t('admin.pricing.add')}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="checkbox checkbox-xs" checked={allSelected} onChange={toggleAll} aria-label={t('admin.categories.select_all')} />
              </th>
              <th className="px-4 py-2 font-medium">{t('admin.pricing.col.scope')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.pricing.col.type')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.pricing.col.value')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.pricing.col.range')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.pricing.col.active')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.pricing.col.description')}</th>
              <th className="px-4 py-2 font-medium w-24">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rules?.map((r) => {
              const key = `${r.scope}|${r.scopeId ?? ''}|${r.marginType}|${r.marginValue}`
              const isDup = dupKeys.has(key)
              const hasRange = r.minCostUsd != null || r.maxCostUsd != null
              return (
              <tr key={r.id} className={`${isDup ? 'bg-warning/10' : ''} ${selected.has(r.id) ? 'bg-brand-50/40' : ''}`}>
                <td className="px-3 py-2 w-8">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} aria-label={r.description ?? r.scope} />
                </td>
                <td className="px-4 py-2 font-medium text-[13px]">
                  {t(`admin.pricing.scope.${r.scope}`)}
                  {/* DROP-630: concrete scoped entity name so the scope is traceable. */}
                  {r.scope !== 'GLOBAL' && (
                    r.scopeName
                      ? <span className="ml-1 font-normal opacity-70">· {r.scopeName}</span>
                      : r.scopeId && <span className="ml-1 font-normal opacity-40 italic">· {t('admin.pricing.scope_unknown')}</span>
                  )}
                  {isDup && <span className="ml-1 badge badge-warning badge-sm">{t('admin.pricing.duplicate')}</span>}
                </td>
                <td className="px-4 py-2 text-[12px]">{t(`admin.pricing.type.${r.marginType}`)}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {r.marginType === 'PERCENTAGE' ? `${r.marginValue}%` : `+${format(Number(r.marginValue), 'USD')}`}
                </td>
                <td className="px-4 py-2 text-[12px] opacity-70">
                  {hasRange
                    ? `${r.minCostUsd != null ? format(r.minCostUsd, 'USD') : t('admin.pricing.any')} → ${r.maxCostUsd != null ? format(r.maxCostUsd, 'USD') : t('admin.pricing.unbounded')}`
                    : <span className="opacity-50">{t('admin.pricing.any_range')}</span>}
                </td>
                <td className="px-4 py-2">
                  {/* Toggle rápido activar/desactivar — impacta los precios al instante (evicta cachés). */}
                  <button onClick={() => toggle.mutate(r.id)} disabled={toggle.isPending}
                          title={r.active ? t('admin.pricing.deactivate') : t('admin.pricing.activate')}
                          aria-label={r.active ? t('admin.pricing.deactivate') : t('admin.pricing.activate')}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.active ? 'bg-success' : 'bg-ink-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${r.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-4 py-2 opacity-70 text-[12px]">{r.description}</td>
                <td className="px-4 py-2 flex gap-1">
                  <button onClick={() => setEditing(r)} className="btn btn-ghost btn-xs btn-square" aria-label={t('actions.edit')}><FontAwesomeIcon icon={faPencil} /></button>
                  {/* DROP-502: usar clave específica de "regla" en lugar de "address". */}
                  <button onClick={() => dialog.confirm({
                            title: t('admin.pricing.delete_title'),
                            message: t('admin.pricing.delete_confirm'),
                            variant: 'error',
                            confirmLabel: t('actions.delete'),
                          }).then((ok) => ok && remove.mutate(r.id))}
                          className="btn btn-ghost btn-xs btn-square text-error" aria-label={t('actions.delete')}><FontAwesomeIcon icon={faTrashCan} /></button>
                </td>
              </tr>
            )})}
            {(!rules || rules.length === 0) && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-500 text-[13px]">{t('filters.no_results')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-lg space-y-3">
            <h2 className="text-lg font-medium">{editing.id ? t('common.edit') : t('admin.pricing.add')}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs text-ink-500">{t('admin.pricing.col.scope')}</label>
                <select className="input" value={editing.scope}
                        onChange={(e) => setEditing({ ...editing, scope: e.target.value as PriceRule['scope'] })}>
                  <option value="GLOBAL">{t('admin.pricing.scope.GLOBAL')}</option>
                  <option value="CATEGORY">{t('admin.pricing.scope.CATEGORY')}</option>
                  <option value="SUPPLIER">{t('admin.pricing.scope.SUPPLIER')}</option>
                  <option value="PRODUCT">{t('admin.pricing.scope.PRODUCT')}</option>
                  <option value="PRODUCT_GROUP">{t('admin.pricing.scope.PRODUCT_GROUP')}</option>
                  <option value="VARIANT">{t('admin.pricing.scope.VARIANT')}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.pricing.col.type')}</label>
                <select className="input" value={editing.marginType}
                        onChange={(e) => setEditing({ ...editing, marginType: e.target.value as any })}>
                  <option value="PERCENTAGE">{t('admin.pricing.type.PERCENTAGE')}</option>
                  <option value="FIXED">{t('admin.pricing.type.FIXED')}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.pricing.col.value')}</label>
                <input type="number" step="0.01" className="input" value={editing.marginValue ?? 0}
                       onChange={(e) => setEditing({ ...editing, marginValue: Number(e.target.value) })} />
              </div>
              {/* DROP-696: el ámbito se elige por nombre (desplegable), no por UUID técnico. */}
              {editing.scope === 'GLOBAL' ? null : (
              <div>
                <label className="text-xs text-ink-500">
                  {editing.scope === 'CATEGORY' ? t('admin.pricing.scope.CATEGORY')
                    : editing.scope === 'SUPPLIER' ? t('admin.pricing.scope.SUPPLIER')
                    : editing.scope === 'PRODUCT' ? t('admin.pricing.scope.PRODUCT')
                    : editing.scope === 'PRODUCT_GROUP' ? t('admin.pricing.scope.PRODUCT_GROUP')
                    : t('admin.pricing.scope.VARIANT')}
                </label>
                {editing.scope === 'PRODUCT_GROUP' ? (
                  <select className="input" value={editing.scopeId ?? ''} onChange={(e) => setEditing({ ...editing, scopeId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {scopeGroups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.memberCount})</option>)}
                  </select>
                ) : editing.scope === 'CATEGORY' ? (
                  <select className="input" value={editing.scopeId ?? ''} onChange={(e) => setEditing({ ...editing, scopeId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {scopeCats.map((c: any) => <option key={c.id} value={c.id}>{c.name ?? c.slug}</option>)}
                  </select>
                ) : editing.scope === 'SUPPLIER' ? (
                  <select className="input" value={editing.scopeId ?? ''} onChange={(e) => setEditing({ ...editing, scopeId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {scopeSups.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : editing.scope === 'PRODUCT' ? (
                  <select className="input" value={editing.scopeId ?? ''} onChange={(e) => setEditing({ ...editing, scopeId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {(scopeProds?.items ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                ) : (
                  // VARIANT: el listado de variantes es muy amplio; se mantiene el id (UUID) como avanzado.
                  <input className="input font-mono text-xs" placeholder="UUID de variante" value={editing.scopeId ?? ''}
                         onChange={(e) => setEditing({ ...editing, scopeId: e.target.value || undefined })} />
                )}
              </div>
              )}
              <div>
                <label className="text-xs text-ink-500">{t('admin.pricing.min_cost_usd')}</label>
                <input type="number" step="0.01" className="input" value={editing.minCostUsd ?? ''}
                       onChange={(e) => setEditing({ ...editing, minCostUsd: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.pricing.max_cost_usd')}</label>
                <input type="number" step="0.01" className="input" value={editing.maxCostUsd ?? ''}
                       onChange={(e) => setEditing({ ...editing, maxCostUsd: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div className="col-span-2 text-[11px] text-ink-500">
                {t('admin.pricing.cost_hint')}
              </div>
              {overlappingRules.length > 0 && (
                <div className="col-span-2 text-[12px] rounded-box bg-warning/15 border border-warning/40 p-2">
                  <span className="font-medium">{t('admin.pricing.overlap_warning').replace('{n}', String(overlappingRules.length))}</span>
                  <span className="opacity-70"> {t('admin.pricing.overlap_hint')}</span>
                </div>
              )}
              <div className="col-span-2">
                <label className="text-xs text-ink-500">{t('admin.pricing.col.description')}</label>
                <input className="input" value={editing.description ?? ''}
                       onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={editing.active}
                         onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                  {t('admin.users.active')}
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button onClick={() => setEditing(null)} className="btn btn-outline">{t('common.cancel')}</button>
              <button onClick={() => save.mutate(editing)} disabled={save.isPending} className="btn btn-primary">
                {save.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
