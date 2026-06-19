import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { admin, CategoryRow } from '../../api/admin'
import { useT } from '../../store/locale'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus, faFolderPlus, faPen, faTrash, faEye, faEyeSlash, faBoxesStacked, faFileExport, faRotateRight, faCircleCheck, faBan,
} from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'
import { CatalogBulkTools } from '../../components/CatalogBulkTools'
import { SearchInput } from '../../components/SearchInput'
import { Pagination } from './AdminOrdersPage'

const PAGE_SIZES = [25, 50, 100, 200]

/**
 * Listado de categorías PAGINADO en servidor (endpoint indexado /paged): no carga las ~2000
 * categorías de golpe. Búsqueda server-side; el selector de padre del modal carga el árbol completo
 * solo al abrirse.
 */
export default function AdminCategoriesPage() {
  const t = useT()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [hasProducts, setHasProducts] = useState<'' | 'true' | 'false'>('') // '' = todas
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-categories-paged', q, hasProducts, page, size],
    queryFn: () => admin.categoriesPaged({
      q: q || undefined,
      hasProducts: hasProducts === '' ? undefined : hasProducts === 'true',
      page, size,
    }),
  })
  const rows = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.totalElements ?? 0

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-categories-paged'] })

  const toggle = useMutation({
    mutationFn: (id: string) => admin.toggleCategory(id),
    onSuccess: invalidate,
  })
  const createMut = useMutation({
    mutationFn: (body: any) => admin.createCategory(body),
    onSuccess: async () => { await invalidate(); resetForm(); dialog.alert({ variant: 'success', message: t('admin.categories.created_ok') }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => admin.updateCategory(id, body),
    onSuccess: async () => { await invalidate(); resetForm(); dialog.alert({ variant: 'success', message: t('admin.categories.updated_ok') }) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => admin.deleteCategory(id),
    onSuccess: invalidate,
  })
  const reindexMut = useMutation({
    mutationFn: () => admin.reindexCategories(),
    onSuccess: (r) => { invalidate(); dialog.alert({ variant: 'success', message: t('admin.categories.reindex_ok').replace('{n}', String(r.indexed)) }) },
    onError: () => dialog.alert({ variant: 'error', message: t('admin.categories.reindex_error') }),
  })

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ slug: '', nameZh: '', nameEn: '', nameEs: '', namePt: '', parentId: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const showModal = creating || !!editingId

  // El árbol completo SOLO se carga cuando el modal está abierto (para el selector de padre).
  const { data: allCats = [] } = useQuery({
    queryKey: ['admin-categories-all'],
    queryFn: admin.categories,
    enabled: showModal,
    staleTime: 60_000,
  })
  const byId = useMemo(() => new Map(allCats.map((c) => [c.id, c] as const)), [allCats])
  const nameOf = (c: CategoryRow) => c.names?.es ?? c.names?.en ?? c.nameZh ?? c.slug
  const pathLabel = (c: CategoryRow): string => {
    const parts: string[] = []
    const guard = new Set<string>()
    let cur: CategoryRow | undefined = c
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id); parts.unshift(nameOf(cur))
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return parts.join(' › ')
  }
  const descendantIds = (id: string): Set<string> => {
    const childrenOf = new Map<string | null, CategoryRow[]>()
    for (const c of allCats) {
      const k = c.parentId ?? null
      if (!childrenOf.has(k)) childrenOf.set(k, [])
      childrenOf.get(k)!.push(c)
    }
    const acc = new Set<string>(); const stack = [id]
    while (stack.length) {
      for (const ch of childrenOf.get(stack.pop()!) ?? []) if (!acc.has(ch.id)) { acc.add(ch.id); stack.push(ch.id) }
    }
    return acc
  }
  const parentOptions = useMemo(() => {
    if (!showModal) return [] as CategoryRow[]
    const editDesc = editingId ? descendantIds(editingId) : new Set<string>()
    return allCats.filter((c) => c.id !== editingId && !editDesc.has(c.id))
      .sort((a, b) => pathLabel(a).localeCompare(pathLabel(b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, editingId, allCats, byId])

  function resetForm() {
    setCreating(false); setEditingId(null)
    setForm({ slug: '', nameZh: '', nameEn: '', nameEs: '', namePt: '', parentId: '' }); setErrors({})
  }
  function openEdit(c: CategoryRow) {
    setEditingId(c.id)
    setForm({ slug: c.slug ?? '', nameZh: c.nameZh ?? '', nameEn: c.names?.en ?? '', nameEs: c.names?.es ?? '', namePt: c.names?.pt ?? '', parentId: c.parentId ?? '' })
    setErrors({}); setCreating(false)
  }
  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.slug) errs.slug = t('admin.categories.error.slug_required')
    else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(form.slug)) errs.slug = t('admin.categories.error.slug_format')
    if (!form.nameEs) errs.nameEs = t('admin.categories.error.name_required')
    if (!form.nameEn) errs.nameEn = t('admin.categories.error.name_required')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }
  function save() {
    if (!validate()) return
    const body = {
      slug: form.slug,
      nameZh: form.nameZh || form.nameEs,
      names: { en: form.nameEn, es: form.nameEs, pt: form.namePt || undefined },
      parentId: form.parentId || null,
    }
    if (editingId) updateMut.mutate({ id: editingId, body })
    else createMut.mutate(body)
  }
  async function handleDelete(c: CategoryRow) {
    if (await dialog.confirm({
      title: t('admin.categories.delete'),
      message: t('admin.categories.delete_confirm').replace('{slug}', c.slug),
      variant: 'error', confirmLabel: t('admin.categories.delete'),
    })) {
      deleteMut.mutate(c.id, { onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.categories.delete_error') }) })
    }
  }

  // Selección + borrado masivo (sobre la página actual).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const pageIds = rows.map((c) => c.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id))
    return n
  })
  // Activar/desactivar las categorías seleccionadas en lote.
  const bulkActiveMut = useMutation({
    mutationFn: (active: boolean) => admin.bulkActiveCategories([...selected], active),
    onSuccess: (r) => { invalidate(); setSelected(new Set()); dialog.alert({ variant: 'success', message: `${r.updated} ${t('admin.categories.bulk_done') ?? 'categorías actualizadas'}` }) },
    onError: () => dialog.alert({ variant: 'error', message: t('admin.categories.reindex_error') }),
  })
  async function deleteSelected() {
    const ids = [...selected]
    if (!ids.length) return
    if (!await dialog.confirm({
      title: t('admin.categories.delete_selected'),
      message: t('admin.categories.delete_selected_confirm').replace('{n}', String(ids.length)),
      variant: 'error', confirmLabel: t('admin.categories.delete'),
    })) return
    setBulkBusy(true)
    let ok = 0; const fails: string[] = []
    for (const id of ids) {
      try { await admin.deleteCategory(id); ok++ }
      catch (e: any) { fails.push(id + ': ' + (e?.response?.data?.message ?? '')) }
    }
    setBulkBusy(false); setSelected(new Set()); await invalidate()
    dialog.alert({
      variant: fails.length ? 'warning' : 'success',
      message: t('admin.categories.delete_selected_done').replace('{ok}', String(ok)).replace('{fail}', String(fails.length))
        + (fails.length ? '\n' + fails.slice(0, 8).join('\n') : ''),
    })
  }

  // Export: descarga TODAS las categorías (carga el árbol completo bajo demanda) en formato re-importable.
  async function exportJson() {
    const cats = await admin.categories()
    const slugById = new Map(cats.map((c) => [c.id, c.slug] as const))
    const out = cats.map((c) => ({
      slug: c.slug, nameEs: c.names?.es ?? '', nameEn: c.names?.en || undefined, namePt: c.names?.pt || undefined,
      nameZh: c.nameZh || undefined, icon: c.icon || undefined, position: c.position,
      parentSlug: c.parentId ? slugById.get(c.parentId) : undefined,
    }))
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `categorias-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.categories.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('pagination.showing')} {total}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              <button onClick={() => bulkActiveMut.mutate(true)} disabled={bulkActiveMut.isPending}
                      className="btn btn-outline btn-sm text-[12px] border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.categories.activate_selected') ?? 'Activar'} ({selected.size})
              </button>
              <button onClick={() => bulkActiveMut.mutate(false)} disabled={bulkActiveMut.isPending}
                      className="btn btn-outline btn-sm text-[12px]">
                <FontAwesomeIcon icon={faBan} /> {t('admin.categories.deactivate_selected') ?? 'Desactivar'} ({selected.size})
              </button>
              <button onClick={deleteSelected} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px] border-red-300 text-red-700 hover:bg-red-50">
                <FontAwesomeIcon icon={bulkBusy ? faRotateRight : faTrash} className={bulkBusy ? 'fa-spin' : ''} />
                {t('admin.categories.delete_selected')} ({selected.size})
              </button>
            </>
          )}
          <button onClick={exportJson} className="btn btn-outline btn-sm text-[12px]">
            <FontAwesomeIcon icon={faFileExport} /> {t('admin.categories.export')}
          </button>
          <button onClick={() => reindexMut.mutate()} disabled={reindexMut.isPending}
                  className="btn btn-outline btn-sm text-[12px]" title={t('admin.categories.reindex_hint')}>
            <FontAwesomeIcon icon={faRotateRight} className={reindexMut.isPending ? 'fa-spin' : ''} /> {t('admin.categories.reindex')}
          </button>
          <CatalogBulkTools kind="categories" onDone={invalidate} />
          <button onClick={() => setCreating(true)} className="btn btn-primary text-[12px]">
            <FontAwesomeIcon icon={faPlus} /> {t('admin.categories.create')}
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(0) }} placeholder={t('admin.categories.search_placeholder')} className="w-full sm:min-w-[280px]" />
        <select className="select select-bordered select-sm text-[12px]" value={hasProducts}
                onChange={(e) => { setHasProducts(e.target.value as '' | 'true' | 'false'); setPage(0) }}>
          <option value="">{t('admin.categories.filter.all') ?? 'Todas las categorías'}</option>
          <option value="true">{t('admin.categories.filter.with_products') ?? 'Con productos'}</option>
          <option value="false">{t('admin.categories.filter.empty') ?? 'Vacías'}</option>
        </select>
        <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0) }} className="input input-sm w-auto">
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / {t('pagination.page')}</option>)}
        </select>
        <span className="text-[11px] text-ink-400 ml-auto">{t('pagination.showing')} <strong>{rows.length}</strong> / {total}</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="checkbox checkbox-xs" checked={allSelected} onChange={toggleAll} aria-label={t('admin.categories.select_all')} />
              </th>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">{t('admin.categories.col.slug')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.categories.col.zh')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.categories.col.en')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.categories.col.es')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.categories.col.pt')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.categories.col.products')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.categories.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.categories.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-ink-100">
                  {Array.from({ length: 10 }).map((__, j) => <td key={j} className="px-4 py-2"><div className="skeleton h-4 w-full" /></td>)}
                </tr>
              ))
            ) : rows.length ? rows.map((c) => (
              <tr key={c.id} className={`border-t border-ink-100 hover:bg-ink-50/50 ${selected.has(c.id) ? 'bg-brand-50/40' : ''}`}>
                <td className="px-3 py-2 w-8">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={selected.has(c.id)} onChange={() => toggleSel(c.id)} aria-label={c.slug} />
                </td>
                <td className="px-4 py-2 w-10">{c.position}</td>
                <td className="px-4 py-2 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-2">{c.nameZh ?? '—'}</td>
                <td className="px-4 py-2">{c.names?.en ?? '—'}</td>
                <td className="px-4 py-2">{c.names?.es ?? '—'}</td>
                <td className="px-4 py-2">{c.names?.pt ?? '—'}</td>
                <td className="px-4 py-2">{c.productCount}</td>
                <td className="px-4 py-2">
                  {c.active && (c.productCount ?? 0) === 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700" title={t('admin.categories.empty_active_tooltip') ?? 'Activa pero sin productos'}>
                      {t('admin.categories.empty_badge') ?? 'Vacía'}
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-600'}`}>
                      {c.active ? t('admin.categories.active') : t('admin.categories.inactive')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="btn btn-outline btn-square text-[11px]" title={t('admin.categories.edit')} aria-label={t('admin.categories.edit')}>
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button onClick={() => toggle.mutate(c.id)} className="btn btn-outline btn-square text-[11px]"
                            title={c.active ? t('admin.categories.deactivate') : t('admin.categories.activate')} aria-label={c.active ? t('admin.categories.deactivate') : t('admin.categories.activate')}>
                      <FontAwesomeIcon icon={c.active ? faEyeSlash : faEye} />
                    </button>
                    <Link to={`/admin/catalog?categoryId=${c.id}`} className="btn btn-outline btn-square text-[11px]" title={t('admin.categories.view_products')} aria-label={t('admin.categories.view_products')}>
                      <FontAwesomeIcon icon={faBoxesStacked} />
                    </Link>
                    <button onClick={() => handleDelete(c)} className="btn btn-outline btn-square text-[11px] hover:border-red-300 hover:text-red-700" title={t('admin.categories.delete')} aria-label={t('admin.categories.delete')}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={10} className="px-4 py-12 text-center">
                <FontAwesomeIcon icon={faFolderPlus} className="text-3xl text-ink-300 mb-2" />
                <div className="text-ink-600 font-medium">{t('admin.categories.empty.title')}</div>
                <div className="text-ink-500 text-[12px] mb-3">{t('admin.categories.empty.body')}</div>
                <button onClick={() => setCreating(true)} className="btn btn-primary text-[12px]">
                  <FontAwesomeIcon icon={faPlus} /> {t('admin.categories.create')}
                </button>
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} pages={Math.max(1, totalPages)} onPage={setPage} />

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={resetForm}>
          <div onClick={(e) => e.stopPropagation()} className="card bg-base-100 shadow-pastel-lg p-5 w-full max-w-md space-y-3">
            <h2 className="font-medium">{editingId ? t('admin.categories.edit') : t('admin.categories.create')}</h2>
            <div className="space-y-2 text-sm">
              <Input label={t('admin.categories.col.slug')} value={form.slug}
                     onChange={(v) => setForm({ ...form, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} mono error={errors.slug} />
              <div>
                <label className="text-xs text-ink-500">{t('admin.categories.col.parent')}</label>
                <select className="input" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">{t('admin.categories.parent_none')}</option>
                  {parentOptions.map((p) => <option key={p.id} value={p.id}>{pathLabel(p)}</option>)}
                </select>
              </div>
              <Input label={t('admin.categories.col.es')} value={form.nameEs} onChange={(v) => setForm({ ...form, nameEs: v })} error={errors.nameEs} />
              <Input label={t('admin.categories.col.en')} value={form.nameEn} onChange={(v) => setForm({ ...form, nameEn: v })} error={errors.nameEn} />
              <Input label={t('admin.categories.col.pt')} value={form.namePt} onChange={(v) => setForm({ ...form, namePt: v })} />
              <Input label={t('admin.categories.col.zh')} value={form.nameZh} onChange={(v) => setForm({ ...form, nameZh: v })} />
            </div>
            {(createMut.isError || updateMut.isError) && (
              <div role="alert" className="alert alert-error text-xs py-2">
                <span>{(createMut.error as any)?.response?.data?.message ?? (updateMut.error as any)?.response?.data?.message ?? t('admin.categories.error.generic')}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
              <button onClick={save} className="btn btn-primary text-[12px]" disabled={!form.slug || !form.nameEs || createMut.isPending || updateMut.isPending}>
                <FontAwesomeIcon icon={faPlus} /> {editingId ? t('actions.save') : t('admin.categories.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Input({ label, value, onChange, mono, error }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; error?: string }) {
  return (
    <div>
      <label className="text-xs text-ink-500">{label}</label>
      <input className={`input ${mono ? 'font-mono' : ''} ${error ? 'border-red-300' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />
      {error && <div className="text-[11px] text-red-600 mt-0.5">{error}</div>}
    </div>
  )
}
