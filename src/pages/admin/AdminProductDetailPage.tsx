import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { admin } from '../../api/admin'
import { sanitizeHtml } from '../../lib/sanitize'
import type { ProductDetail } from '../../api/catalog'
import { adminUpdateStatus } from '../../api/catalog'
import { useT, useLocaleStore } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faPen, faPause, faPlay, faCopy, faBoxArchive,
  faMagnifyingGlassPlus, faImage, faTrash, faPlus, faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'
import { VariantsManager } from '../../components/VariantsManager'

type Tab = 'overview' | 'description' | 'seo' | 'inventory' | 'pricing'

export default function AdminProductDetailPage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const format = useCurrencyStore((s) => s.format)
  const current = useCurrencyStore((s) => s.current)
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [zoom, setZoom] = useState<string | null>(null)
  // DROP-695: selector de idioma del detalle — previsualiza/edita el contenido en cada idioma sin
  // cambiar el idioma de toda la app. Por defecto, el idioma activo.
  const [detailLang, setDetailLang] = useState(lang)
  const { data: detailLangs } = useQuery({ queryKey: ['admin-languages'], queryFn: () => admin.languages(), staleTime: 60_000 })
  const langOptions = (detailLangs && detailLangs.length ? detailLangs.filter((l) => l.active) : [{ code: 'es', label: 'ES' }, { code: 'en', label: 'EN' }]) as Array<{ code: string; label: string }>

  const { data, isLoading } = useQuery({
    queryKey: ['admin-product', id, detailLang],
    queryFn: async () => (await api.get<ProductDetail>(`/admin/catalog/products/${id}`, { params: { lang: detailLang } })).data,
    enabled: !!id,
  })
  // DROP-622: raw variant prices (no margin) so the Pricing tab matches the base price + the editor.
  const { data: rawVariants = [] } = useQuery<any[]>({
    queryKey: ['admin-variants', id],
    queryFn: async () => (await api.get(`/admin/catalog/products/${id}/variants`)).data,
    enabled: !!id,
  })
  const statusMut = useMutation({
    mutationFn: (st: string) => adminUpdateStatus(id, st),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', id] }),
  })
  // Edición inline del precio por variante (en la moneda canónica CNY).
  const [vPrice, setVPrice] = useState<Record<string, string>>({})
  const updVariantMut = useMutation({
    mutationFn: ({ vid, price }: { vid: string; price: number }) => admin.updateVariantPrice(vid, price),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-variants', id] })
      qc.invalidateQueries({ queryKey: ['admin-product', id] })
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.edit.error') }),
  })
  // Renombrar etiquetas de color/estampado (cuando "Blanco 2" no comunica que es otro diseño).
  const [valLabel, setValLabel] = useState<Record<string, string>>({})
  const renameValMut = useMutation({
    mutationFn: ({ vid, value }: { vid: string; value: string }) => admin.renameVariantValue(vid, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', id] }),
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.edit.error') }),
  })
  // DROP-674: imagen real por color/valor de variación.
  const [valImg, setValImg] = useState<Record<string, string>>({})
  const setValImgMut = useMutation({
    mutationFn: ({ vid, imageUrl }: { vid: string; imageUrl: string }) => admin.setVariantValueImage(vid, imageUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', id] }),
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.edit.error') }),
  })
  function commitVariantPrice(vid: string, current: number) {
    const raw = vPrice[vid]
    if (raw == null || raw.trim() === '') return
    const n = Number(raw)
    if (!isFinite(n) || n < 0 || n === current) { setVPrice((s) => { const x = { ...s }; delete x[vid]; return x }); return }
    updVariantMut.mutate({ vid, price: n })
    setVPrice((s) => { const x = { ...s }; delete x[vid]; return x })
  }
  // Product images: add by URL and remove.
  const [newImgUrl, setNewImgUrl] = useState('')
  // Añade VARIAS imágenes a la vez: una por línea o separadas por coma/espacios. Se suben en secuencia
  // (preserva el orden) y se reportan los fallos parciales sin perder las que sí entraron.
  const addImgMut = useMutation({
    mutationFn: async (urls: string[]) => {
      let ok = 0
      const failed: string[] = []
      for (const u of urls) {
        try { await admin.addProductImage(id, u); ok++ } catch { failed.push(u) }
      }
      return { ok, failed }
    },
    onSuccess: ({ ok, failed }: { ok: number; failed: string[] }) => {
      qc.invalidateQueries({ queryKey: ['admin-product', id] })
      setNewImgUrl('')
      if (failed.length) {
        dialog.alert({ variant: 'error', message: t('admin.catalog.images.partial').replace('{ok}', String(ok)).replace('{fail}', String(failed.length)) })
      }
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.images.error') }),
  })
  const delImgMut = useMutation({
    mutationFn: (imageId: string) => admin.deleteProductImage(imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', id] }),
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.images.error') }),
  })
  // DROP-688: edición manual del SEO (meta título/descripción) del idioma del detalle.
  const [seoForm, setSeoForm] = useState({ metaTitle: '', metaDescription: '' })
  useEffect(() => {
    setSeoForm({ metaTitle: (data as any)?.metaTitle ?? '', metaDescription: (data as any)?.metaDescription ?? '' })
  }, [data, detailLang])
  const seoMut = useMutation({
    mutationFn: () => api.put(`/admin/catalog/products/${id}`, { metaTitle: seoForm.metaTitle, metaDescription: seoForm.metaDescription }, { params: { lang: detailLang } }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-product', id] }); dialog.alert({ variant: 'success', message: t('admin.catalog.edit.ok') }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.edit.error') }),
  })

  // DROP-499: edit + duplicate reales.
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', brand: '', basePrice: '', currency: '', moq: '', videoUrl: '' })
  const editMut = useMutation({
    mutationFn: (body: any) => api.put(`/admin/catalog/products/${id}`, body, { params: { lang: detailLang } }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product', id] })
      setEditOpen(false)
      dialog.alert({ variant: 'success', message: t('admin.catalog.edit.ok') })
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.edit.error') }),
  })
  const duplicateMut = useMutation({
    mutationFn: () => api.post(`/admin/catalog/products/${id}/duplicate`, null, { params: { lang: detailLang } }).then((r) => r.data),
    onSuccess: (newProduct: any) => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      dialog.alert({ variant: 'success', message: t('admin.catalog.duplicate.ok').replace('{id}', newProduct.externalId ?? newProduct.id) })
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.duplicate.error') }),
  })
  // DROP-589: inline description editor (replaces the "comes next release" placeholder).
  const [descEditing, setDescEditing] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const descMut = useMutation({
    mutationFn: (description: string) => api.put(`/admin/catalog/products/${id}`, { description }, { params: { lang: detailLang } }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product', id] })
      setDescEditing(false)
      dialog.alert({ variant: 'success', message: t('admin.catalog.detail.desc_saved') })
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.edit.error') }),
  })
  function startDescEdit() {
    setDescDraft((data as any)?.description ?? (data as any)?.shortDescription ?? '')
    setDescEditing(true)
  }

  function openEdit() {
    setEditForm({
      title: (data as any)?.title ?? '',
      brand: (data as any)?.brand ?? '',
      basePrice: data?.basePrice ? String(data.basePrice) : '',
      currency: data?.currency ?? 'CNY',
      moq: data?.moq ? String(data.moq) : '1',
      videoUrl: (data as any)?.videoUrl ?? '',
    })
    setEditOpen(true)
  }

  if (isLoading || !data) return <p className="text-ink-500 text-sm">{t('common.loading')}</p>

  // DROP-105: prefer the localized title; only show the Chinese subtitle in the zh locale.
  const titleByLang: any = (data as any).translations ?? {}
  const title = titleByLang[detailLang]?.title ?? (data as any).title ?? data.titleZh
  const showZhSubtitle = detailLang === 'zh'

  // DROP-110: gallery with several images, alt-text and click-to-zoom.
  const gallery = (data.images ?? []).filter((i) => i.cdnUrl || i.sourceUrl)

  // DROP-106: align variant prices with the main price by showing both in the active currency.
  const mainCcy = data.currency ?? 'CNY'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/admin/catalog" className="text-brand-700 text-[12px]"><FontAwesomeIcon icon={faArrowLeft} /> {t('admin.catalog.title')}</Link>
        <div className="flex gap-1">
          {data.status === 'ACTIVE' ? (
            <button onClick={() => statusMut.mutate('PAUSED')} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faPause} /> {t('admin.catalog.actions.pause')}
            </button>
          ) : (
            <button onClick={() => statusMut.mutate('ACTIVE')} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faPlay} /> {t('admin.catalog.actions.publish')}
            </button>
          )}
          <button onClick={() => duplicateMut.mutate()} disabled={duplicateMut.isPending}
                  className="btn btn-outline text-[12px]">
            <FontAwesomeIcon icon={faCopy} /> {t('admin.catalog.actions.duplicate')}
          </button>
          <button onClick={() => statusMut.mutate('ARCHIVED')} className="btn btn-outline text-[12px]">
            <FontAwesomeIcon icon={faBoxArchive} /> {t('admin.catalog.actions.archive')}
          </button>
          <button onClick={openEdit} className="btn btn-primary text-[12px]">
            <FontAwesomeIcon icon={faPen} /> {t('admin.catalog.actions.edit')}
          </button>
        </div>
      </div>

      <header>
        <h1>{title}</h1>
        {showZhSubtitle && data.titleZh && <p className="text-ink-500 text-sm">{data.titleZh}</p>}
        <div className="text-[12px] text-ink-500 mt-1">
          {data.source} · {data.externalId} · MOQ {data.moq}
        </div>
      </header>

      <nav className="flex gap-1 border-b border-ink-100 items-center">
        {(['overview', 'description', 'seo', 'inventory', 'pricing'] as Tab[]).map((tk) => (
          <button key={tk} onClick={() => setTab(tk)}
                  className={`px-3 py-2 text-[12px] -mb-px border-b-2 ${
                    tab === tk ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-ink-500 hover:text-ink-700'
                  }`}>
            {t(`admin.catalog.detail.tab.${tk}`)}
          </button>
        ))}
        {/* DROP-695: selector de idioma — previsualiza/edita el contenido (título, descripción, SEO)
            en cada idioma sin cambiar el idioma de toda la app. */}
        <div className="ml-auto flex items-center gap-1 pb-1">
          <span className="text-[11px] text-ink-400">{t('picker.language')}:</span>
          <select className="select select-bordered select-xs" value={detailLang} onChange={(e) => setDetailLang(e.target.value)}>
            {langOptions.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.code.toUpperCase()})</option>)}
          </select>
        </div>
      </nav>

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card p-4 space-y-1 text-sm">
            {/* DROP-639/629: el Resumen muestra el PRECIO DE VENTA (derivado de la variante, ya
                con margen) — se recalcula al editar variantes — y el coste base como referencia. */}
            <Row label={t('admin.catalog.col.price')} value={(data as any).displayPrice != null ? format(Number((data as any).displayPrice), (data as any).displayCurrency ?? mainCcy) : (data.basePrice != null ? format(Number(data.basePrice), mainCcy) : '—')} />
            <Row label={t('admin.catalog.detail.base_cost')} value={data.basePrice != null ? format(Number(data.basePrice), mainCcy) : '—'} />
            <Row label={t('admin.catalog.col.sales')} value={String(data.monthlySales ?? 0)} />
            <Row label={t('admin.catalog.detail.trend_label')} value={data.trendScore != null ? `${Math.round(Number(data.trendScore) * 100)}/100` : '—'} />
            <Row label={t('admin.catalog.detail.moq')} value={String(data.moq)} />
            <Row label={t('admin.catalog.detail.source')} value={data.source ?? '—'} />
          </div>
          <div className="card p-4 lg:col-span-2">
            <h3 className="font-medium mb-2 text-sm">{t('admin.catalog.detail.images')}</h3>
            {gallery.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {gallery.map((img, i) => (
                  <div key={img.id} className="aspect-square relative group">
                    <button onClick={() => setZoom(img.cdnUrl || img.sourceUrl)} className="w-full h-full">
                      <img src={img.cdnUrl || img.sourceUrl} alt={`${title} — ${i + 1}`}
                           className="w-full h-full object-cover rounded border border-ink-100" />
                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <FontAwesomeIcon icon={faMagnifyingGlassPlus} className="text-white" />
                      </span>
                    </button>
                    <button onClick={() => dialog.confirm({ message: t('admin.catalog.images.delete_confirm'), variant: 'error' }).then((ok) => ok && delImgMut.mutate(img.id))}
                            className="absolute top-1 right-1 btn btn-error btn-xs btn-square opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t('admin.catalog.images.delete')}>
                      <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-ink-400">
                <FontAwesomeIcon icon={faImage} className="text-3xl mb-2" />
                <span className="text-[12px]">{t('admin.catalog.detail.gallery_empty')}</span>
              </div>
            )}
            {/* Add images: paste one or MANY URLs (one per line or comma/space-separated) */}
            <div className="mt-3 pt-3 border-t border-ink-100">
              <textarea value={newImgUrl} onChange={(e) => setNewImgUrl(e.target.value)}
                        placeholder={t('admin.catalog.images.url_ph')} rows={3}
                        className="textarea textarea-bordered w-full text-[12px] leading-snug" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-ink-400">{t('admin.catalog.images.multi_hint')}</span>
                <button onClick={() => { const urls = parseImageUrls(newImgUrl); if (urls.length) addImgMut.mutate(urls) }}
                        disabled={parseImageUrls(newImgUrl).length === 0 || addImgMut.isPending}
                        className="btn btn-outline btn-sm text-[12px]">
                  <FontAwesomeIcon icon={faPlus} /> {t('admin.catalog.images.add_url')}
                  {parseImageUrls(newImgUrl).length > 1 ? ` (${parseImageUrls(newImgUrl).length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'description' && (
        <div className="card p-5">
          {descEditing ? (
            <div className="space-y-3">
              <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)}
                        className="textarea textarea-bordered w-full h-56 text-[13px]"
                        placeholder={t('admin.catalog.detail.write_description')} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setDescEditing(false)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
                <button onClick={() => descMut.mutate(descDraft)} disabled={descMut.isPending} className="btn btn-primary btn-sm">
                  {t('admin.catalog.detail.save_description')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {(data as any).descriptionHtml ? (
                <div className="prose prose-sm max-w-none text-ink-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml((data as any).descriptionHtml) }} />
              ) : (data as any).description ? (
                <p className="text-ink-700 whitespace-pre-wrap text-[13px]">{(data as any).description}</p>
              ) : (
                <p className="text-ink-400 text-center py-6">{t('admin.catalog.detail.no_description')}</p>
              )}
              <div className="flex justify-end">
                <button onClick={startDescEdit} className="btn btn-primary btn-sm text-[12px]">
                  <FontAwesomeIcon icon={faPen} /> {t('admin.catalog.detail.edit_description')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'seo' && (
        <div className="card p-5 space-y-3 text-sm">
          <Row label={t('admin.catalog.detail.seo.slug')} value={normalizeSlug(data.slug)} mono />
          {/* DROP-688: meta editables manualmente (por idioma del detalle). */}
          <div>
            <label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.catalog.detail.seo.meta_title')} ({detailLang.toUpperCase()})</label>
            <input className="input input-bordered input-sm w-full" maxLength={200}
                   value={seoForm.metaTitle} placeholder={title}
                   onChange={(e) => setSeoForm({ ...seoForm, metaTitle: e.target.value })} />
          </div>
          <div>
            <label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.catalog.detail.seo.meta_description')} ({detailLang.toUpperCase()})</label>
            <textarea className="textarea textarea-bordered textarea-sm w-full h-20" maxLength={400}
                      value={seoForm.metaDescription}
                      onChange={(e) => setSeoForm({ ...seoForm, metaDescription: e.target.value })} />
            <div className="text-[11px] text-ink-400 mt-0.5">{seoForm.metaDescription.length}/400</div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => seoMut.mutate()} disabled={seoMut.isPending} className="btn btn-primary btn-sm">
              {seoMut.isPending ? <FontAwesomeIcon icon={faSpinner} className="fa-spin" /> : null} {t('actions.save')}
            </button>
          </div>
          <p className="text-ink-500 text-[12px]">{t('admin.catalog.detail.seo.hint')}</p>
        </div>
      )}

      {tab === 'inventory' && (
        <VariantsManager productId={id} />
      )}

      {tab === 'pricing' && (
        <div className="space-y-4">
        {/* DROP-669: tramos de precio reales por cantidad (price breaks) que declara el proveedor en
            1688. Si no hay tramos no se inventa ninguno: la ficha usa solo el precio unitario. */}
        {(() => {
          const tiers = ((data as any).priceTiers ?? []) as Array<{ minQty: number; maxQty?: number | null; unitPrice: number; currency?: string }>
          if (!tiers.length) return null
          return (
            <div className="card overflow-hidden p-4 space-y-2">
              <h3 className="text-[13px] font-semibold text-ink-700">{t('admin.catalog.detail.tiers.title')}</h3>
              <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead className="text-ink-500 text-left text-[12px]">
                  <tr>
                    <th className="font-medium">{t('admin.catalog.detail.tiers.qty')}</th>
                    <th className="font-medium text-right">{t('admin.catalog.detail.tiers.unit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tr, i) => (
                    <tr key={i} className="border-t border-ink-100">
                      <td>{tr.maxQty != null ? `${tr.minQty}–${tr.maxQty}` : `≥${tr.minQty}`}</td>
                      <td className="text-right font-mono">{Number(tr.unitPrice).toFixed(2)} {tr.currency ?? 'CNY'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )
        })()}
        {/* DROP — etiquetas de variación editables: cuando el origen trae nombres ambiguos
            ("Blanco 2", "Negro 2") que en realidad son estampados distintos, el operador puede
            renombrar la etiqueta visible sin tocar el valor canónico (value_zh). */}
        {(() => {
          const opts = ((data as any).variantOptions ?? []) as Array<{ id: string; name?: string; nameZh?: string; values: Array<{ id: string; value?: string; valueZh?: string; imageUrl?: string }> }>
          if (!opts.length) return null
          const isColor = (o: { name?: string; nameZh?: string }) => /color|colour|颜色/i.test(`${o.name ?? ''} ${o.nameZh ?? ''}`)
          return (
            <div className="card overflow-hidden p-4 space-y-3">
              <h3 className="text-[13px] font-semibold text-ink-700">{t('admin.catalog.detail.labels.title')}</h3>
              <p className="text-[11px] text-ink-400">{t('admin.catalog.detail.labels.hint')}</p>
              {opts.map((opt) => (
                <div key={opt.id} className="space-y-1.5">
                  <div className="text-[12px] font-medium text-ink-500">{opt.name || opt.nameZh}</div>
                  <div className="grid gap-2">
                    {opt.values.map((val) => (
                      <div key={val.id} className="flex items-center gap-2">
                        {val.imageUrl && <img src={val.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                        <span className="text-[11px] text-ink-400 w-20 shrink-0 truncate" title={val.valueZh}>{val.valueZh}</span>
                        {/* DROP-699: distinguir visualmente un valor GUARDADO (texto firme + punto verde) de un
                            placeholder vacío (texto suave). El placeholder muestra el valor de origen. */}
                        {(() => {
                          const saved = (val.value ?? '').trim() !== ''
                          return (
                          <div className="flex-1 min-w-32 relative">
                            <input
                              className={`input input-xs w-full ${saved ? 'text-ink-800 font-medium border-emerald-300' : 'text-ink-500'}`}
                              placeholder={val.valueZh}
                              value={valLabel[val.id] ?? val.value ?? ''}
                              onChange={(e) => setValLabel((s) => ({ ...s, [val.id]: e.target.value }))}
                              onBlur={() => {
                                const next = (valLabel[val.id] ?? val.value ?? '').trim()
                                if (next !== (val.value ?? '')) renameValMut.mutate({ vid: val.id, value: next })
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            />
                            {saved && <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" title={t('admin.catalog.detail.labels.saved')} />}
                          </div>
                          )
                        })()}
                        {/* DROP-674: URL de la imagen real de este color (solo para ejes de color). */}
                        {isColor(opt) && (
                          <input
                            className="input input-xs flex-1 min-w-40"
                            placeholder={t('admin.catalog.detail.labels.image_url')}
                            value={valImg[val.id] ?? val.imageUrl ?? ''}
                            onChange={(e) => setValImg((s) => ({ ...s, [val.id]: e.target.value }))}
                            onBlur={() => {
                              const next = (valImg[val.id] ?? val.imageUrl ?? '').trim()
                              if (next !== (val.imageUrl ?? '')) setValImgMut.mutate({ vid: val.id, imageUrl: next })
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin.catalog.detail.inv.sku')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.catalog.detail.inv.variant')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('admin.catalog.col.price')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('admin.catalog.detail.pricing.delta')}</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // DROP-629: the delta is measured against the representative (cheapest) variant —
                // the one that sets the product's headline price — so a single variant reads 0%
                // and multi-variant deltas are traceable to the real "from" price (not base_price).
                const vlist = (rawVariants.length ? rawVariants : data.variants) as any[]
                const prices = vlist
                  .map((v) => (v.price != null ? Number(v.price) : (data.basePrice != null ? Number(data.basePrice) : 0)))
                  .filter((n) => n > 0)
                const refPrice = prices.length ? Math.min(...prices) : (data.basePrice != null ? Number(data.basePrice) : 0)
                return vlist.map((v: any) => {
                const variantPrice = v.price != null ? Number(v.price) : (data.basePrice != null ? Number(data.basePrice) : 0)
                const main = refPrice
                const delta = main > 0 ? ((variantPrice - main) / main) * 100 : 0
                return (
                  <tr key={v.id} className="border-t border-ink-100">
                    <td className="px-3 py-2 font-mono text-[11px]">{v.sku ?? '—'}</td>
                    <td className="px-3 py-2">{translateOptions(v.title ?? '', lang)}</td>
                    {/* DROP — precio por variante editable, en la moneda canónica (CNY). El equivalente
                        en la moneda activa se muestra al lado y se recalcula con la tasa diaria. */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <input type="number" step="0.01" min="0"
                               value={vPrice[v.id] ?? String(variantPrice)}
                               onChange={(e) => setVPrice((s) => ({ ...s, [v.id]: e.target.value }))}
                               onBlur={() => commitVariantPrice(v.id, variantPrice)}
                               onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                               className="input input-xs w-24 text-right font-mono" title={mainCcy} />
                        <span className="text-[10px] text-ink-400">{mainCcy}</span>
                      </div>
                      {mainCcy !== current && (
                        <div className="text-[10px] text-ink-400 mt-0.5">≈ {format(variantPrice, mainCcy)}</div>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right text-[12px] ${delta > 0 ? 'text-amber-600' : delta < 0 ? 'text-emerald-600' : 'text-ink-500'}`}>
                      {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                    </td>
                  </tr>
                )
              })
              })()}
            </tbody>
          </table>
          </div>
        </div>
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setZoom(null)}>
          <img src={zoom} alt={title} className="max-w-full max-h-full rounded shadow-2xl" />
        </div>
      )}

      {/* DROP-499: modal quick-edit. */}
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card bg-base-100 p-5 w-full max-w-md space-y-3">
            <h3 className="font-medium">{t('admin.catalog.edit.title')}</h3>
            <label className="text-xs text-ink-500">{t('admin.catalog.fields.title')}</label>
            <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="input" />
            <label className="text-xs text-ink-500">{t('admin.catalog.fields.brand')}</label>
            <input type="text" value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} className="input" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-500">{t('admin.catalog.fields.basePrice')}</label>
                <input type="number" step="0.01" value={editForm.basePrice} onChange={(e) => setEditForm({ ...editForm, basePrice: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.catalog.fields.currency')}</label>
                <select value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} className="select">
                  {['CNY','USD','EUR','GBP','BRL','MXN','JPY'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <label className="text-xs text-ink-500">{t('admin.catalog.fields.moq')}</label>
            <input type="number" min={1} value={editForm.moq} onChange={(e) => setEditForm({ ...editForm, moq: e.target.value })} className="input" />
            {/* DROP-673: URL del vídeo real del producto (vacío lo elimina). */}
            <label className="text-xs text-ink-500">{t('admin.catalog.fields.video_url')}</label>
            <input type="url" value={editForm.videoUrl} placeholder="https://…" onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })} className="input" />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditOpen(false)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
              <button onClick={() => editMut.mutate({
                        title: editForm.title || undefined,
                        brand: editForm.brand || undefined,
                        basePrice: editForm.basePrice ? parseFloat(editForm.basePrice) : undefined,
                        currency: editForm.currency || undefined,
                        moq: editForm.moq ? parseInt(editForm.moq, 10) : undefined,
                        videoUrl: editForm.videoUrl,
                      })}
                      disabled={editMut.isPending}
                      className="btn btn-primary text-[12px]">{t('actions.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span className={`font-medium text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// DROP-104: lightweight inline glossary so Chinese variant labels read in the active locale.
const OPTION_KEYS: Record<string, Record<string, string>> = {
  es: { 颜色: 'Color', 尺码: 'Talla', 尺寸: 'Tamaño', 规格: 'Especificación', 套餐: 'Pack' },
  en: { 颜色: 'Color', 尺码: 'Size',  尺寸: 'Size',   规格: 'Spec',           套餐: 'Pack' },
  pt: { 颜色: 'Cor',   尺码: 'Tam.',  尺寸: 'Tamanho', 规格: 'Especificação',  套餐: 'Pack' },
  zh: {},
}
const OPTION_VALUES: Record<string, Record<string, string>> = {
  es: { 驼色: 'Camel', 墨绿: 'Verde musgo', 炭黑: 'Negro carbón', 白色: 'Blanco', 黑色: 'Negro', 红色: 'Rojo', 蓝色: 'Azul' },
  en: { 驼色: 'Camel', 墨绿: 'Moss green',  炭黑: 'Charcoal',     白色: 'White',  黑色: 'Black', 红色: 'Red',  蓝色: 'Blue' },
  pt: { 驼色: 'Camel', 墨绿: 'Verde-musgo', 炭黑: 'Carvão',       白色: 'Branco', 黑色: 'Preto', 红色: 'Vermelho', 蓝色: 'Azul' },
  zh: {},
}
function translateOptionKey(k: string, lang: string)   { return OPTION_KEYS[lang]?.[k]   ?? k }
function translateOptionValue(v: string, lang: string) { return OPTION_VALUES[lang]?.[v] ?? v }
function translateOptions(title: string, lang: string) {
  if (lang === 'zh' || !title) return title
  return title.split(/[\s,;]/).map((tok) => OPTION_VALUES[lang]?.[tok] ?? OPTION_KEYS[lang]?.[tok] ?? tok).join(' ')
}
// DROP-162 / DROP-195: trim leading/trailing dashes from slugs imported from external feeds.
function normalizeSlug(slug?: string | null): string {
  if (!slug) return '—'
  return slug.replace(/^[-_/]+/, '').replace(/[-_/]+$/, '')
}

// Extrae todas las URLs http(s) de un texto: una por línea, o separadas por coma/espacios. Deduplica.
function parseImageUrls(raw: string): string[] {
  const urls = raw.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s))
  return Array.from(new Set(urls))
}
