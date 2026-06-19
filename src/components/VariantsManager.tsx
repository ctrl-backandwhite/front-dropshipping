import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPen, faTrash, faCheck, faXmark, faUpload, faSpinner, faImage, faPenToSquare } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../api/admin'
import { dialog } from '../store/dialog'
import { useT } from '../store/locale'

interface Variant {
  id: string
  sku?: string
  title?: string
  price?: number
  stock?: number
  imageUrl?: string
  options?: Record<string, string>
  active?: boolean
}

type Draft = { sku: string; title: string; price: string; stock: string; options: string; imageUrl: string }

const EMPTY: Draft = { sku: '', title: '', price: '', stock: '0', options: '', imageUrl: '' }

function optionsToText(o?: Record<string, string>): string {
  return Object.entries(o ?? {}).map(([k, v]) => `${k}:${v}`).join(', ')
}
function textToOptions(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  s.split(',').map((p) => p.trim()).filter(Boolean).forEach((pair) => {
    const i = pair.indexOf(':')
    if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim()
  })
  return out
}
function toBody(d: Draft) {
  return {
    sku: d.sku.trim(),
    title: d.title.trim() || d.sku.trim(),
    price: d.price ? Number(d.price) : null,
    stock: d.stock ? Number(d.stock) : 0,
    imageUrl: d.imageUrl.trim() || null,
    options: textToOptions(d.options),
    active: true,
  }
}
function draftOf(v: Variant): Draft {
  return { sku: v.sku ?? '', title: v.title ?? '', price: v.price != null ? String(v.price) : '',
    stock: String(v.stock ?? 0), options: optionsToText(v.options), imageUrl: v.imageUrl ?? '' }
}

/** Inline manager for a product's variants: list + create + edit (one row or ALL at once) + delete.
 *  DROP-622: reads RAW variant prices from the admin endpoint (not the margin-priced product detail). */
export function VariantsManager({ productId }: { productId: string }) {
  const t = useT()
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [uploading, setUploading] = useState(false)
  // Edición MASIVA: todas las variantes editables a la vez (drafts por id) + subida por fila.
  const [bulk, setBulk] = useState(false)
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, Draft>>({})
  const [bulkUploadId, setBulkUploadId] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  async function uploadFor(file: File) {
    setUploading(true)
    try {
      const { url } = await admin.uploadImage(file)
      setDraft((d) => ({ ...d, imageUrl: url }))
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.variants.error') })
    } finally { setUploading(false) }
  }
  async function uploadForBulk(id: string, file: File) {
    setBulkUploadId(id)
    try {
      const { url } = await admin.uploadImage(file)
      setBulkDrafts((m) => ({ ...m, [id]: { ...m[id], imageUrl: url } }))
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.variants.error') })
    } finally { setBulkUploadId(null) }
  }

  const { data: variants = [] } = useQuery<Variant[]>({
    queryKey: ['admin-variants', productId],
    queryFn: () => admin.listVariants(productId),
  })

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ['admin-variants', productId] })
    qc.invalidateQueries({ queryKey: ['admin-product', productId] })
  }

  const createMut = useMutation({
    mutationFn: (body: any) => admin.createVariant(productId, body),
    onSuccess: () => { refetch(); setAdding(false); setDraft(EMPTY); dialog.alert({ variant: 'success', message: t('admin.variants.created') }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.variants.error') }),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => admin.updateVariant(id, body),
    onSuccess: () => { refetch(); setEditingId(null); dialog.alert({ variant: 'success', message: t('admin.variants.updated') }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.variants.error') }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => admin.deleteVariant(id),
    onSuccess: () => { refetch(); dialog.alert({ variant: 'success', message: t('admin.variants.deleted') }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.variants.error') }),
  })

  function startEdit(v: Variant) { setAdding(false); setEditingId(v.id); setDraft(draftOf(v)) }
  function startAdd() { setEditingId(null); setDraft(EMPTY); setAdding(true) }
  async function confirmDelete(v: Variant) {
    const ok = await dialog.confirm({ message: t('admin.variants.delete_confirm').replace('{sku}', v.sku ?? v.id) })
    if (ok) deleteMut.mutate(v.id)
  }

  // ---- edición masiva ----
  function startBulk() {
    setEditingId(null); setAdding(false)
    setBulkDrafts(Object.fromEntries(variants.map((v) => [v.id, draftOf(v)])))
    setBulk(true)
  }
  function patchBulk(id: string, patch: Partial<Draft>) {
    setBulkDrafts((m) => ({ ...m, [id]: { ...m[id], ...patch } }))
  }
  async function saveAll() {
    setBulkSaving(true)
    try {
      // Guarda solo las variantes que cambiaron, en paralelo.
      const changed = variants.filter((v) => JSON.stringify(draftOf(v)) !== JSON.stringify(bulkDrafts[v.id]))
      await Promise.all(changed.map((v) => admin.updateVariant(v.id, toBody(bulkDrafts[v.id]))))
      refetch(); setBulk(false)
      dialog.alert({ variant: 'success', message: (t('admin.variants.saved_all') ?? 'Variantes guardadas') + ` (${changed.length})` })
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.variants.error') })
    } finally { setBulkSaving(false) }
  }

  const cell = 'px-3 py-2'
  const inputCls = 'input input-bordered input-xs w-full'

  /** Celdas editables (imagen, sku, título, precio, stock, opciones) reutilizadas en edición simple y masiva. */
  const inputCells = (d: Draft, upd: (patch: Partial<Draft>) => void, onUpload: (f: File) => void, uploadingThis: boolean) => (
    <>
      <td className={cell}>
        <div className="flex items-center gap-1">
          {d.imageUrl
            ? <img src={d.imageUrl} alt="" className="w-8 h-8 rounded object-cover border border-ink-200 shrink-0" />
            : <span className="w-8 h-8 rounded border border-dashed border-ink-200 grid place-items-center text-ink-300 shrink-0"><FontAwesomeIcon icon={faImage} className="text-[11px]" /></span>}
          <input className={inputCls} placeholder={t('admin.variants.image_ph')} value={d.imageUrl} onChange={(e) => upd({ imageUrl: e.target.value })} />
          <label className="btn btn-ghost btn-xs btn-square cursor-pointer shrink-0" title={t('admin.variants.upload')}>
            <FontAwesomeIcon icon={uploadingThis ? faSpinner : faUpload} className={uploadingThis ? 'fa-spin' : ''} />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = '' }} />
          </label>
        </div>
      </td>
      <td className={cell}><input className={inputCls} placeholder="SKU" value={d.sku} onChange={(e) => upd({ sku: e.target.value })} /></td>
      <td className={cell}><input className={inputCls} placeholder={t('admin.variants.title_ph')} value={d.title} onChange={(e) => upd({ title: e.target.value })} /></td>
      <td className={cell}><input className={inputCls + ' text-right'} type="number" step="0.01" placeholder="0.00" value={d.price} onChange={(e) => upd({ price: e.target.value })} /></td>
      <td className={cell}><input className={inputCls + ' text-right'} type="number" placeholder="0" value={d.stock} onChange={(e) => upd({ stock: e.target.value })} /></td>
      <td className={cell}><input className={inputCls} placeholder="Color:Rojo, Talla:M" value={d.options} onChange={(e) => upd({ options: e.target.value })} /></td>
    </>
  )

  // DROP-621: render as a plain function call (no <DraftRow/>) so inputs keep focus across re-renders.
  const renderDraftRow = ({ onSave, onCancel, saving, rowKey }: { onSave: () => void; onCancel: () => void; saving: boolean; rowKey?: string }) => (
    <tr key={rowKey} className="border-t border-ink-100 bg-base-200/40">
      {inputCells(draft, (p) => setDraft({ ...draft, ...p }), uploadFor, uploading)}
      <td className={cell + ' text-right whitespace-nowrap'}>
        <button onClick={onSave} disabled={saving || !draft.sku.trim()} className="btn btn-success btn-xs btn-square mr-1"><FontAwesomeIcon icon={faCheck} /></button>
        <button onClick={onCancel} className="btn btn-ghost btn-xs btn-square"><FontAwesomeIcon icon={faXmark} /></button>
      </td>
    </tr>
  )

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-ink-100 flex-wrap">
        <span className="text-[12px] text-ink-500">{variants.length} {t('admin.variants.count')}</span>
        <div className="flex items-center gap-1">
          {!bulk && variants.length > 0 && (
            <button onClick={startBulk} className="btn btn-outline btn-xs text-[11px]"><FontAwesomeIcon icon={faPenToSquare} /> {t('admin.variants.edit_all') ?? 'Editar todas'}</button>
          )}
          {bulk ? (
            <>
              <button onClick={saveAll} disabled={bulkSaving} className="btn btn-success btn-xs text-[11px]">
                <FontAwesomeIcon icon={bulkSaving ? faSpinner : faCheck} className={bulkSaving ? 'fa-spin' : ''} /> {t('admin.variants.save_all') ?? 'Guardar todo'}
              </button>
              <button onClick={() => setBulk(false)} disabled={bulkSaving} className="btn btn-ghost btn-xs text-[11px]"><FontAwesomeIcon icon={faXmark} /> {t('common.cancel') ?? 'Cancelar'}</button>
            </>
          ) : (
            <button onClick={startAdd} className="btn btn-primary btn-xs text-[11px]"><FontAwesomeIcon icon={faPlus} /> {t('admin.variants.add')}</button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
          <tr>
            <th className={cell + ' font-medium w-12'}>{t('admin.variants.image')}</th>
            <th className={cell + ' font-medium'}>{t('admin.catalog.detail.inv.sku')}</th>
            <th className={cell + ' font-medium'}>{t('admin.catalog.detail.inv.variant')}</th>
            <th className={cell + ' font-medium text-right'}>{t('admin.catalog.col.price')}</th>
            <th className={cell + ' font-medium text-right'}>{t('admin.catalog.detail.inv.stock')}</th>
            <th className={cell + ' font-medium'}>{t('admin.catalog.detail.inv.options')}</th>
            <th className={cell + ' font-medium text-right'}>{t('admin.variants.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {adding && !bulk && renderDraftRow({ onSave: () => createMut.mutate(toBody(draft)), onCancel: () => setAdding(false), saving: createMut.isPending })}
          {variants.map((v) => bulk ? (
            <tr key={v.id} className="border-t border-ink-100 bg-base-200/30">
              {inputCells(bulkDrafts[v.id] ?? draftOf(v), (p) => patchBulk(v.id, p), (f) => uploadForBulk(v.id, f), bulkUploadId === v.id)}
              <td className={cell + ' text-right text-ink-300 text-[11px] font-mono'}>{v.sku ?? ''}</td>
            </tr>
          ) : editingId === v.id ? (
            renderDraftRow({ rowKey: v.id, onSave: () => updateMut.mutate({ id: v.id, body: toBody(draft) }), onCancel: () => setEditingId(null), saving: updateMut.isPending })
          ) : (
            <tr key={v.id} className="border-t border-ink-100">
              <td className={cell}>
                {v.imageUrl
                  ? <img src={v.imageUrl} alt={v.sku ?? ''} className="w-9 h-9 rounded object-cover border border-ink-100" />
                  : <span className="w-9 h-9 rounded border border-dashed border-ink-200 grid place-items-center text-ink-300"><FontAwesomeIcon icon={faImage} className="text-xs" /></span>}
              </td>
              <td className={cell + ' font-mono text-[11px]'}>{v.sku ?? '—'}</td>
              <td className={cell}>{v.title ?? '—'}</td>
              {/* DROP-699: el precio crudo de la variante está en la moneda canónica (CNY). */}
              <td className={cell + ' text-right font-mono'}>{v.price != null ? `${Number(v.price).toFixed(2)} CNY` : '—'}</td>
              <td className={cell + ' text-right'}>{v.stock ?? 0}</td>
              <td className={cell + ' text-xs'}>{optionsToText(v.options) || '—'}</td>
              <td className={cell + ' text-right whitespace-nowrap'}>
                <button onClick={() => startEdit(v)} className="btn btn-ghost btn-xs btn-square mr-1" title={t('admin.variants.edit')}><FontAwesomeIcon icon={faPen} /></button>
                <button onClick={() => confirmDelete(v)} className="btn btn-ghost btn-xs btn-square text-error" title={t('admin.variants.delete')}><FontAwesomeIcon icon={faTrash} /></button>
              </td>
            </tr>
          ))}
          {variants.length === 0 && !adding && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-400 text-[13px]">{t('admin.variants.empty')}</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
