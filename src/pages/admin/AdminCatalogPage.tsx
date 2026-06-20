import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { adminListProducts, adminUpdateStatus, listCategories } from '../../api/catalog'
import { useT } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { SearchInput } from '../../components/SearchInput'
import { FilterBar, SelectFilter } from '../../components/FilterBar'
import { Pagination } from './AdminOrdersPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faPlus, faCopy, faBoxArchive, faTrash, faPlay, faPause, faPen, faFileExport, faRotateRight } from '@fortawesome/free-solid-svg-icons'
import { CatalogBulkTools } from '../../components/CatalogBulkTools'
import { CreateProductModal } from '../../components/CreateProductModal'
import { ProductExportModal } from './ProductExportModal'
import { admin } from '../../api/admin'
import { dialog } from '../../store/dialog'

const STATUSES = ['ALL', 'DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']
const PAGE_SIZE = 30

export default function AdminCatalogPage() {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<string>(params.get('status') ?? 'ALL')
  const [categoryId, setCategoryId] = useState<string | null>(params.get('categoryId'))
  const [q, setQ] = useState(params.get('q') ?? '')
  // Ordenación por columna (precio). undefined = orden natural del backend.
  const [sort, setSort] = useState<string | undefined>(params.get('sort') ?? undefined)
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const qc = useQueryClient()

  // Persist filters in the URL so deep-links (e.g. from the mega-menu) work.
  // DROP-468: el default ahora es 'ALL' (no 'ACTIVE'), así que excluimos 'ALL'
  // del query-string para no ensuciar la URL canónica con ?status=ALL al cargar.
  useEffect(() => {
    const next = new URLSearchParams()
    if (status && status !== 'ALL') next.set('status', status)
    if (categoryId) next.set('categoryId', categoryId)
    if (q) next.set('q', q)
    setParams(next, { replace: true })
  }, [status, categoryId, q, setParams])

  const { data } = useQuery({
    queryKey: ['admin-products', status, categoryId, page, sort],
    // Backend accepts undefined to mean "all statuses"; category is filtered server-side
    // so paging/totals are correct across the whole catalog (not just the current page).
    queryFn: () => adminListProducts(status === 'ALL' ? undefined : status, page, PAGE_SIZE, 'es', categoryId ?? undefined, sort),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories-flat'],
    queryFn: () => listCategories('en'),
  })

  // Category is filtered server-side now; only the free-text box stays client-side.
  const allRows = data?.items ?? []
  const rows = q
    ? allRows.filter((p) => {
        const needle = q.toLowerCase()
        return (p.title ?? '').toLowerCase().includes(needle)
            || (p.slug ?? '').toLowerCase().includes(needle)
      })
    : allRows

  const mutation = useMutation({
    mutationFn: ({ id, st }: { id: string; st: string }) => adminUpdateStatus(id, st),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  })
  // DROP-624: duplicar y eliminar desde el listado (antes solo en el detalle).
  const duplicateMut = useMutation({
    mutationFn: (id: string) => admin.duplicateProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); dialog.alert({ variant: 'success', message: t('admin.catalog.actions.duplicated') }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.actions.error') }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => admin.deleteProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); dialog.alert({ variant: 'success', message: t('admin.catalog.actions.deleted') }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.actions.error') }),
  })
  async function onDelete(p: any) {
    if (await dialog.confirm({ variant: 'error', message: t('admin.catalog.actions.delete_confirm').replace('{title}', p.title ?? p.slug) })) deleteMut.mutate(p.id)
  }

  // Selección + borrado masivo (sobre la página actual). El backend rechaza por id los que tengan órdenes.
  const pageIds = rows.map((p) => p.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id))
    return n
  })
  // Cambio masivo de estado de los productos seleccionados (publicar/pausar/archivar).
  async function bulkStatus(status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    const ids = [...selected]
    if (!ids.length) return
    setBulkBusy(true)
    try {
      const r = await admin.bulkProductStatus(ids, status)
      setSelected(new Set())
      await qc.invalidateQueries({ queryKey: ['admin-products'] })
      dialog.alert({
        variant: r.failed ? 'warning' : 'success',
        message: t('admin.bulk.done').replace('{ok}', String(r.succeeded)).replace('{fail}', String(r.failed))
          + (r.failed ? '\n' + r.errors.slice(0, 8).join('\n') : ''),
      })
    } finally {
      setBulkBusy(false)
    }
  }

  async function deleteSelected() {
    const ids = [...selected]
    if (!ids.length) return
    if (!await dialog.confirm({
      variant: 'error',
      message: t('admin.catalog.bulk_delete_confirm').replace('{n}', String(ids.length)),
    })) return
    setBulkBusy(true)
    try {
      const r = await admin.bulkDeleteProducts(ids)
      setSelected(new Set())
      await qc.invalidateQueries({ queryKey: ['admin-products'] })
      dialog.alert({
        variant: r.failed ? 'warning' : 'success',
        message: t('admin.catalog.bulk_delete_done').replace('{ok}', String(r.deleted)).replace('{fail}', String(r.failed))
          + (r.failed ? '\n' + r.errors.slice(0, 8).join('\n') : ''),
      })
    } finally {
      setBulkBusy(false)
    }
  }

  const statusLabel = (s: string) => {
    if (s === 'ALL') return t('filters.all')
    const k = `admin.catalog.status.${s}`
    const v = t(k)
    return v === k ? humanize(s) : v
  }

  // Fallback humano-amigable: "AWAITING_PAYMENT" -> "Awaiting payment"
  function humanize(s: string): string {
    if (!s) return s
    const lower = s.replace(/_/g, ' ').toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>{t('admin.catalog.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.catalog.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              <button onClick={() => bulkStatus('ACTIVE')} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px] border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <FontAwesomeIcon icon={faPlay} /> {t('admin.catalog.actions.publish')} ({selected.size})
              </button>
              <button onClick={() => bulkStatus('PAUSED')} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]">
                <FontAwesomeIcon icon={faPause} /> {t('admin.catalog.actions.pause')} ({selected.size})
              </button>
              <button onClick={() => bulkStatus('ARCHIVED')} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]">
                <FontAwesomeIcon icon={faBoxArchive} /> {t('admin.catalog.actions.archive')} ({selected.size})
              </button>
              <button onClick={deleteSelected} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px] border-red-300 text-red-700 hover:bg-red-50">
                <FontAwesomeIcon icon={bulkBusy ? faRotateRight : faTrash} className={bulkBusy ? 'fa-spin' : ''} />
                {t('admin.catalog.bulk_delete')} ({selected.size})
              </button>
            </>
          )}
          <CatalogBulkTools kind="products" onDone={() => qc.invalidateQueries({ queryKey: ['admin-products'] })} />
          <button onClick={() => setExportOpen(true)} className="btn btn-outline btn-sm text-[12px]">
            <FontAwesomeIcon icon={faFileExport} /> {t('admin.export.title')}
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm text-[12px]">
            <FontAwesomeIcon icon={faPlus} /> {t('admin.create_product.btn')}
          </button>
        </div>
      </header>

      {exportOpen && <ProductExportModal onClose={() => setExportOpen(false)} />}
      {createOpen && (
        <CreateProductModal categories={categories as any} onClose={() => setCreateOpen(false)}
                            onCreated={() => qc.invalidateQueries({ queryKey: ['admin-products'] })} />
      )}

      <FilterBar onClear={() => { setQ(''); setStatus('ALL'); setCategoryId(null); setPage(0) }}
                 hasActive={!!q || status !== 'ALL' || !!categoryId}>
        <SearchInput value={q} onChange={setQ}
                     placeholder={t('admin.catalog.search_placeholder')} className="min-w-[260px]" />
        {/* DROP-591: SelectFilter ya provee la opción "Todos" (null); no la dupliquemos con 'ALL'. */}
        <SelectFilter label={t('admin.catalog.col.status')}
                      value={status === 'ALL' ? null : status}
                      options={STATUSES.filter((s) => s !== 'ALL').map((s) => ({ value: s, label: statusLabel(s) }))}
                      onChange={(v) => { setStatus(v ?? 'ALL'); setPage(0) }} />
        <SelectFilter label={t('filters.category')}
                      value={categoryId}
                      options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
                      onChange={(v) => { setCategoryId(v); setPage(0) }}
                      placeholder={t('filters.all')} />
        {data && <span className="text-[11px] text-ink-400 ml-auto">{t('pagination.showing')} <strong>{rows.length}</strong> / {data.totalElements}</span>}
      </FilterBar>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="checkbox checkbox-xs" checked={allSelected} onChange={toggleAll} aria-label={t('admin.categories.select_all')} />
              </th>
              <th className="px-4 py-2 font-medium">{t('admin.catalog.col.product')}</th>
              <th className="px-4 py-2 font-medium text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 ml-auto hover:text-primary transition-colors"
                  onClick={() => {
                    // Ciclo: natural → ascendente → descendente → natural
                    setSort(s => (s === 'price_asc' ? 'price_desc' : s === 'price_desc' ? undefined : 'price_asc'))
                    setPage(0)
                  }}
                  title={t('admin.catalog.sort.byPrice')}
                >
                  {t('admin.catalog.col.price')}
                  <i className={`fas fa-xs ${sort === 'price_asc' ? 'fa-arrow-up-short-wide text-primary' : sort === 'price_desc' ? 'fa-arrow-down-wide-short text-primary' : 'fa-sort text-base-content/30'}`} />
                </button>
              </th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.catalog.col.sales')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.catalog.col.trend')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.catalog.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.catalog.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const monthly = Number(p.monthlySales ?? 0)
              const monthlyDisplay = monthly > 9999 ? `${(monthly / 1000).toFixed(1)}k` : String(monthly)
              return (
              <tr key={p.id} className={`border-t border-ink-100 hover:bg-ink-50/50 ${selected.has(p.id) ? 'bg-brand-50/40' : ''}`}>
                <td className="px-3 py-2 w-8">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} aria-label={p.title} />
                </td>
                <td className="px-4 py-2">
                  <Link to={`/admin/catalog/${p.id}`} className="flex items-center gap-2 hover:text-brand-700">
                    {p.mainImage ? (
                      <img src={p.mainImage} className="w-10 h-10 object-cover rounded" alt={p.title}
                           onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div className="w-10 h-10 rounded bg-ink-50 flex items-center justify-center">
                        <FontAwesomeIcon icon={faImage} className="text-ink-300 text-[14px]" />
                      </div>
                    )}
                    <span className="line-clamp-1 text-[13px]">{p.title}</span>
                  </Link>
                </td>
                <td className="px-4 py-2 text-right font-medium">{p.basePrice != null ? format(Number(p.basePrice), p.currency ?? 'CNY') : '—'}</td>
                <td className="px-4 py-2 text-right text-[12px]">{monthly > 0 ? monthlyDisplay : '—'}</td>
                <td className="px-4 py-2 text-right text-[12px]" title={t('admin.catalog.detail.trend_tooltip')}>
                  {p.trendScore != null ? `${Math.round(Number(p.trendScore) * 100)}/100` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span className="badge bg-ink-100 text-ink-700">{statusLabel(p.status)}</span>
                </td>
                <td className="px-4 py-2">
                  {/* Acciones solo-icono: el tooltip (title) describe la acción en el idioma activo. */}
                  <div className="flex gap-1">
                    {p.status === 'DRAFT' && (
                      <button onClick={() => mutation.mutate({ id: p.id, st: 'ACTIVE' })} className="btn btn-outline btn-square text-[11px]" title={t('admin.catalog.actions.publish')} aria-label={t('admin.catalog.actions.publish')}>
                        <FontAwesomeIcon icon={faPlay} />
                      </button>
                    )}
                    {p.status === 'ACTIVE' && (
                      <button onClick={() => mutation.mutate({ id: p.id, st: 'PAUSED' })} className="btn btn-outline btn-square text-[11px]" title={t('admin.catalog.actions.pause')} aria-label={t('admin.catalog.actions.pause')}>
                        <FontAwesomeIcon icon={faPause} />
                      </button>
                    )}
                    {p.status === 'PAUSED' && (
                      <button onClick={() => mutation.mutate({ id: p.id, st: 'ACTIVE' })} className="btn btn-outline btn-square text-[11px]" title={t('admin.catalog.actions.publish')} aria-label={t('admin.catalog.actions.publish')}>
                        <FontAwesomeIcon icon={faPlay} />
                      </button>
                    )}
                    <Link to={`/admin/catalog/${p.id}`} className="btn btn-outline btn-square text-[11px]" title={t('admin.catalog.actions.edit')} aria-label={t('admin.catalog.actions.edit')}>
                      <FontAwesomeIcon icon={faPen} />
                    </Link>
                    <button onClick={() => duplicateMut.mutate(p.id)} className="btn btn-outline btn-square text-[11px]" title={t('admin.catalog.actions.duplicate')} aria-label={t('admin.catalog.actions.duplicate')}>
                      <FontAwesomeIcon icon={faCopy} />
                    </button>
                    {p.status !== 'ARCHIVED' && (
                      <button onClick={() => mutation.mutate({ id: p.id, st: 'ARCHIVED' })} className="btn btn-outline btn-square text-[11px]" title={t('admin.catalog.actions.archive')} aria-label={t('admin.catalog.actions.archive')}>
                        <FontAwesomeIcon icon={faBoxArchive} />
                      </button>
                    )}
                    <button onClick={() => onDelete(p)} className="btn btn-outline btn-square text-[11px] hover:border-red-300 hover:text-red-700" title={t('admin.catalog.actions.delete')} aria-label={t('admin.catalog.actions.delete')}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </td>
              </tr>
            )})}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-500 text-[13px]">{t('filters.no_results')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} pages={Math.max(1, data?.totalPages ?? 1)} onPage={setPage} />
    </div>
  )
}
