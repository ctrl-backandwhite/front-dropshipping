import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faSpinner, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../api/admin'
import { dialog } from '../store/dialog'
import { useT } from '../store/locale'

interface Cat { slug: string; name?: string }

// Idiomas por defecto si el registro aún no carga (luego se sustituyen por los configurados).
const FALLBACK_LANGS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文' },
]

// Campos escalares (los arrays se gestionan en su propio estado).
const EMPTY: Record<string, string> = {
  categorySlug: '', category1688Id: '', category1688Name: '',
  manufacturer: '', supplierName: '', supplierExternalId: '',
  price: '', moq: '1', monthlySales: '', rating: '', status: 'DRAFT',
  imageUrls: '', videoUrl: '', videoUrls: '',
  weightGrams: '', packageWeightGrams: '', lengthMm: '', widthMm: '', heightMm: '',
  countryOfOrigin: '', hsCode: '', certifications: '', shipFrom: '', leadTimeDays: '',
  salesRegions: '', ratingBreakdown: '', dropshipShipped30d: '', dropshipPickupRate48h: '',
}

type Tier = { minQty: string; maxQty: string; unitPrice: string; currency: string }
type Axis = { name: string; values: string; valueImages: string; valueTranslations: string }
type Variant = { sku: string; optionValues: string; price: string; stock: string; imageUrl: string;
                 weightGrams: string; packageWeightGrams: string; lengthMm: string; widthMm: string; heightMm: string }
type Attr = { key: string; value: string; locale: string }
type Spec = { locale: string; key: string; value: string; position: string }
type Review = { authorName: string; authorCountry: string; rating: string; title: string; body: string; language: string }

const num = (v: string) => (v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined)
const int = (v: string) => (v.trim() !== '' && Number.isInteger(Number(v)) ? Number(v) : (v.trim() !== '' ? Math.trunc(Number(v)) : undefined))
const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean)
const csv = (v: string) => v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)

/** Parsea "Color:Rojo, Talla:M" → {Color:"Rojo", Talla:"M"} */
function parsePairs(v: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of v.split(',')) {
    const i = part.indexOf(':')
    if (i > 0) {
      const k = part.slice(0, i).trim()
      const val = part.slice(i + 1).trim()
      if (k && val) out[k] = val
    }
  }
  return out
}

/** Parsea líneas "valor=url" → {valor:url} (imágenes por color). */
function parseValueImages(v: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const ln of v.split('\n')) {
    const i = ln.indexOf('=')
    if (i > 0) {
      const k = ln.slice(0, i).trim()
      const val = ln.slice(i + 1).trim()
      if (k && val) out[k] = val
    }
  }
  return out
}

/** Parsea líneas "valor=es:Blanco, en:White" → {valor:{es:Blanco, en:White}} (traducción por color). */
function parseValueTranslations(v: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const ln of v.split('\n')) {
    const i = ln.indexOf('=')
    if (i <= 0) continue
    const key = ln.slice(0, i).trim()
    if (!key) continue
    const map: Record<string, string> = {}
    for (const part of ln.slice(i + 1).split(',')) {
      const j = part.indexOf(':')
      if (j > 0) {
        const lang = part.slice(0, j).trim().toLowerCase()
        const label = part.slice(j + 1).trim()
        if (lang && label) map[lang] = label
      }
    }
    if (Object.keys(map).length) out[key] = map
  }
  return out
}

/** Parsea "5:120, 4:30, 3:5" → {"5":120,...} (desglose de estrellas). */
function parseBreakdown(v: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const part of v.split(',')) {
    const i = part.indexOf(':')
    if (i > 0) {
      const k = part.slice(0, i).trim()
      const val = Number(part.slice(i + 1).trim())
      if (k && !Number.isNaN(val)) out[k] = val
    }
  }
  return out
}

/**
 * Modal para crear un producto desde cero con TODOS los datos que admite el catálogo (los mismos del
 * import masivo): categoría/mapeo 1688, multi-idioma, proveedor, imágenes/vídeo, logística y
 * dimensiones, tramos de precio, ejes y variantes (con imagen por color), atributos y ficha técnica,
 * y valoración. Las secciones son plegables para no saturar. Al crear, navega a su detalle.
 */
export function CreateProductModal({ categories, onClose, onCreated }: { categories: Cat[]; onClose: () => void; onCreated?: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const [f, setF] = useState<Record<string, string>>({ ...EMPTY, categorySlug: categories[0]?.slug ?? '' })
  const [tiers, setTiers] = useState<Tier[]>([])
  const [axes, setAxes] = useState<Axis[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [attrs, setAttrs] = useState<Attr[]>([])
  const [specs, setSpecs] = useState<Spec[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [busy, setBusy] = useState(false)
  // Idiomas configurados (ilimitados) + contenido por idioma {code: {title, description}}.
  const { data: langData } = useQuery({ queryKey: ['admin-languages'], queryFn: () => admin.languages(), staleTime: 60_000 })
  const langs = (langData && langData.length ? langData.filter((l) => l.active) : FALLBACK_LANGS) as Array<{ code: string; label: string }>
  const defaultLang = (langData?.find((l: any) => l.isDefault)?.code) || langs[0]?.code || 'es'
  const [lang, setLang] = useState<string>('')
  const activeLangCode = lang || defaultLang
  const [content, setContent] = useState<Record<string, { title: string; description: string }>>({})
  const setContentField = (code: string, k: 'title' | 'description') => (e: any) =>
    setContent((s) => ({ ...s, [code]: { title: s[code]?.title ?? '', description: s[code]?.description ?? '', [k]: e.target.value } }))

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })

  async function submit() {
    if (!f.categorySlug && !f.category1688Id.trim() && !f.category1688Name.trim()) {
      dialog.alert({ variant: 'error', message: 'Indica una categoría (slug o id/nombre de origen).' })
      return
    }
    const anyTitle = Object.values(content).some((c) => c.title.trim())
    if (!anyTitle) {
      dialog.alert({ variant: 'error', message: t('admin.create_product.required') })
      return
    }
    if (!f.price.trim() && tiers.every((tr) => !tr.unitPrice.trim())) {
      dialog.alert({ variant: 'error', message: 'El precio es obligatorio (campo Precio o al menos un tramo).' })
      return
    }
    setBusy(true)
    try {
      const body: any = {
        categorySlug: f.categorySlug || undefined,
        category1688Id: f.category1688Id.trim() || undefined,
        category1688Name: f.category1688Name.trim() || undefined,
        manufacturer: f.manufacturer.trim() || undefined,
        supplierName: f.supplierName.trim() || undefined,
        supplierExternalId: f.supplierExternalId.trim() || undefined,
        price: num(f.price),
        moq: int(f.moq) ?? 1,
        monthlySales: int(f.monthlySales),
        rating: num(f.rating),
        status: f.status || undefined,
        imageUrls: lines(f.imageUrls),
        videoUrl: f.videoUrl.trim() || undefined,
        videoUrls: lines(f.videoUrls),
        weightGrams: int(f.weightGrams),
        packageWeightGrams: int(f.packageWeightGrams),
        lengthMm: int(f.lengthMm), widthMm: int(f.widthMm), heightMm: int(f.heightMm),
        countryOfOrigin: f.countryOfOrigin.trim() || undefined,
        hsCode: f.hsCode.trim() || undefined,
        certifications: csv(f.certifications),
        shipFrom: f.shipFrom.trim() || undefined,
        leadTimeDays: int(f.leadTimeDays),
        salesRegions: csv(f.salesRegions),
        ratingBreakdown: f.ratingBreakdown.trim() ? parseBreakdown(f.ratingBreakdown) : undefined,
        dropshipShipped30d: int(f.dropshipShipped30d),
        dropshipPickupRate48h: num(f.dropshipPickupRate48h),
      }
      // Contenido por idioma (ilimitado): se envía el mapa `translations` con todos los idiomas
      // que el operador rellenó. El backend rellena los campos canónicos (es/en/pt/zh) desde el mapa.
      const translations: Record<string, { title: string; description?: string }> = {}
      for (const [code, c] of Object.entries(content)) {
        const ti = c.title?.trim()
        if (ti) translations[code] = { title: ti, description: c.description?.trim() || undefined }
      }
      if (Object.keys(translations).length) body.translations = translations
      // Tramos de precio (DROP-669).
      const tt = tiers.filter((tr) => tr.unitPrice.trim()).map((tr) => ({
        minQty: int(tr.minQty) ?? 1, maxQty: int(tr.maxQty), unitPrice: num(tr.unitPrice),
        currency: tr.currency.trim() || 'CNY',
      }))
      if (tt.length) body.tieredPricing = tt
      // Ejes de variación (Color/Talla) con imagen por valor (DROP-674).
      const ax = axes.filter((a) => a.name.trim() && a.values.trim()).map((a) => {
        const o: any = { name: a.name.trim(), values: csv(a.values) }
        const vi = parseValueImages(a.valueImages)
        if (Object.keys(vi).length) o.valueImages = vi
        const vtr = parseValueTranslations(a.valueTranslations)
        if (Object.keys(vtr).length) o.valueTranslations = vtr
        return o
      })
      if (ax.length) body.variantAxes = ax
      // Variantes / SKU (DROP-674/675).
      const vs = variants.filter((v) => v.sku.trim() || v.optionValues.trim()).map((v) => ({
        sku: v.sku.trim() || undefined,
        optionValues: v.optionValues.trim() ? parsePairs(v.optionValues) : undefined,
        price: num(v.price), stock: int(v.stock), imageUrl: v.imageUrl.trim() || undefined,
        weightGrams: int(v.weightGrams), packageWeightGrams: int(v.packageWeightGrams),
        lengthMm: int(v.lengthMm), widthMm: int(v.widthMm), heightMm: int(v.heightMm),
      }))
      if (vs.length) body.variants = vs
      // Atributos (facetas / DROP-672 locale).
      const at = attrs.filter((a) => a.key.trim() && a.value.trim()).map((a) => ({
        key: a.key.trim(), value: a.value.trim(), locale: a.locale.trim() || undefined,
      }))
      if (at.length) body.attributes = at
      // Ficha técnica por idioma.
      const sp = specs.filter((s) => s.key.trim() && s.value.trim()).map((s, i) => ({
        locale: s.locale.trim() || 'es', key: s.key.trim(), value: s.value.trim(),
        position: int(s.position) ?? i,
      }))
      if (sp.length) body.specifications = sp
      // Reseñas reales (cada una con su idioma).
      const rv = reviews.filter((r) => r.body.trim() || r.title.trim()).map((r) => ({
        authorName: r.authorName.trim() || undefined, authorCountry: r.authorCountry.trim() || undefined,
        rating: int(r.rating) ?? 5, title: r.title.trim() || undefined, body: r.body.trim() || undefined,
        language: r.language.trim() || 'es',
      }))
      if (rv.length) body.reviews = rv

      const id = await admin.createProduct(body)
      dialog.alert({ variant: 'success', message: t('admin.create_product.ok') })
      onCreated?.()
      onClose()
      if (id) navigate(`/admin/catalog/${id}`)
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.create_product.error') })
    } finally {
      setBusy(false)
    }
  }

  const label = 'text-[12px] font-medium text-ink-600 mb-1 block'
  const inp = 'input input-bordered input-sm w-full'
  const activeLabel = langs.find((l) => l.code === activeLangCode)?.label ?? activeLangCode

  // Encabezado de sección plegable.
  const Section = ({ title, children, open = false }: { title: string; children: any; open?: boolean }) => (
    <details open={open} className="rounded-box border border-base-200 group">
      <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-semibold text-ink-700 marker:content-none flex items-center justify-between">
        <span>{title}</span>
        <span className="text-ink-400 text-[11px] group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="p-3 pt-1 space-y-3 border-t border-base-200">{children}</div>
    </details>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-2xl p-5 border border-base-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sticky -top-5 bg-base-100 py-2 z-10">
          <h3 className="font-semibold text-lg">{t('admin.create_product.title')}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-square"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        <div className="space-y-3">
          {/* ===== Categoría ===== */}
          <Section title={'1 · ' + t('admin.create_product.category')} open>
            <div>
              <label className={label}>{t('admin.create_product.category')}</label>
              <select className="select select-bordered select-sm w-full" value={f.categorySlug} onChange={set('categorySlug')}>
                <option value="">— (resolver por categoría de origen) —</option>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={label}>Categoría de origen (id)</label><input className={inp} value={f.category1688Id} onChange={set('category1688Id')} placeholder="opcional · mapeo automático" /></div>
              <div><label className={label}>Categoría de origen (nombre)</label><input className={inp} value={f.category1688Name} onChange={set('category1688Name')} placeholder="opcional" /></div>
            </div>
          </Section>

          {/* ===== Idioma: título + descripción (idiomas ilimitados desde el registro) ===== */}
          <Section title={'2 · ' + t('admin.create_product.title_field') + ' / ' + t('admin.create_product.desc')} open>
            <div className="flex flex-wrap gap-1 border-b border-ink-100 mb-1">
              {langs.map((l) => {
                const filled = !!content[l.code]?.title?.trim()
                return (
                  <button key={l.code} type="button" onClick={() => setLang(l.code)}
                          className={`px-3 py-1.5 text-[12px] -mb-px border-b-2 transition-colors ${activeLangCode === l.code ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-ink-500'}`}>
                    {l.label}{filled ? <span className="text-emerald-500"> •</span> : ''}
                  </button>
                )
              })}
            </div>
            <div>
              <label className={label}>{t('admin.create_product.title_field')} ({activeLabel}){activeLangCode === defaultLang ? ' *' : ''}</label>
              <input className={inp} value={content[activeLangCode]?.title ?? ''} onChange={setContentField(activeLangCode, 'title')}
                     placeholder={activeLangCode === defaultLang ? 'Auriculares Bluetooth Pro' : ''} />
            </div>
            <div>
              <label className={label}>{t('admin.create_product.desc')} ({activeLabel})</label>
              <textarea className="textarea textarea-bordered textarea-sm w-full h-20" value={content[activeLangCode]?.description ?? ''} onChange={setContentField(activeLangCode, 'description')} />
            </div>
            <p className="text-[11px] text-ink-400">{t('admin.create_product.multilang_hint')} · {langs.length} {langs.length === 1 ? 'idioma' : 'idiomas'} · gestiona el listado en Idiomas.</p>
          </Section>

          {/* ===== Datos básicos ===== */}
          <Section title="3 · Precio, marca y estado" open>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={label}>Precio (CNY) *</label><input type="number" step="0.01" className={inp} value={f.price} onChange={set('price')} placeholder="29.90" /></div>
              <div><label className={label}>{t('admin.create_product.moq')}</label><input type="number" className={inp} value={f.moq} onChange={set('moq')} placeholder="1" /></div>
            </div>
            <div><label className={label}>Marca / Fabricante</label><input className={inp} value={f.manufacturer} onChange={set('manufacturer')} placeholder="Acme Manufacturing Co." /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className={label}>Ventas/mes</label><input type="number" className={inp} value={f.monthlySales} onChange={set('monthlySales')} /></div>
              <div><label className={label}>Valoración (0-5)</label><input type="number" step="0.1" min="0" max="5" className={inp} value={f.rating} onChange={set('rating')} /></div>
              <div><label className={label}>Estado</label>
                <select className="select select-bordered select-sm w-full" value={f.status} onChange={set('status')}>
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activo</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-ink-400">El precio se interpreta en CNY (moneda de origen). La valoración/desglose son opcionales y reales; si no los pones, el producto sale sin valoración.</p>
          </Section>

          {/* ===== Proveedor ===== */}
          <Section title="4 · Proveedor">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={label}>Nombre del proveedor</label><input className={inp} value={f.supplierName} onChange={set('supplierName')} placeholder="se crea/vincula si no existe" /></div>
              <div><label className={label}>ID proveedor</label><input className={inp} value={f.supplierExternalId} onChange={set('supplierExternalId')} placeholder="opcional" /></div>
            </div>
            <p className="text-[11px] text-ink-400">Si no indicas proveedor, se usa el nombre del fabricante. Evita reutilizar un proveedor incorrecto.</p>
          </Section>

          {/* ===== Imágenes y vídeo ===== */}
          <Section title="5 · Imágenes y vídeo" open>
            <div><label className={label}>{t('admin.create_product.images')} (una por línea, la 1ª es la principal)</label>
              <textarea className="textarea textarea-bordered textarea-sm w-full h-16 font-mono text-[11px]" value={f.imageUrls} onChange={set('imageUrls')} placeholder={'https://...\nhttps://...'} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={label}>URL de vídeo principal</label><input className={inp} value={f.videoUrl} onChange={set('videoUrl')} placeholder="https://..." /></div>
              <div><label className={label}>Vídeos extra (uno por línea)</label><textarea className="textarea textarea-bordered textarea-sm w-full h-10 font-mono text-[11px]" value={f.videoUrls} onChange={set('videoUrls')} /></div>
            </div>
          </Section>

          {/* ===== Logística y dimensiones ===== */}
          <Section title="6 · Logística y dimensiones (envío)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={label}>Peso unidad (g)</label><input type="number" className={inp} value={f.weightGrams} onChange={set('weightGrams')} /></div>
              <div><label className={label}>Peso paquete (g)</label><input type="number" className={inp} value={f.packageWeightGrams} onChange={set('packageWeightGrams')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className={label}>Largo (mm)</label><input type="number" className={inp} value={f.lengthMm} onChange={set('lengthMm')} /></div>
              <div><label className={label}>Ancho (mm)</label><input type="number" className={inp} value={f.widthMm} onChange={set('widthMm')} /></div>
              <div><label className={label}>Alto (mm)</label><input type="number" className={inp} value={f.heightMm} onChange={set('heightMm')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={label}>País de origen</label><input className={inp} value={f.countryOfOrigin} onChange={set('countryOfOrigin')} placeholder="CN" /></div>
              <div><label className={label}>Código HS (arancel)</label><input className={inp} value={f.hsCode} onChange={set('hsCode')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={label}>Envío desde</label><input className={inp} value={f.shipFrom} onChange={set('shipFrom')} placeholder="Yiwu, Zhejiang" /></div>
              <div><label className={label}>Plazo de entrega (días)</label><input type="number" className={inp} value={f.leadTimeDays} onChange={set('leadTimeDays')} /></div>
            </div>
            <div><label className={label}>Certificaciones (separadas por coma)</label><input className={inp} value={f.certifications} onChange={set('certifications')} placeholder="CE, RoHS" /></div>
          </Section>

          {/* ===== Tramos de precio ===== */}
          <Section title="7 · Tramos de precio por cantidad">
            {tiers.map((tr, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                <div><label className={label}>Desde</label><input type="number" className={inp} value={tr.minQty} onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, minQty: e.target.value } : x))} placeholder="1" /></div>
                <div><label className={label}>Hasta</label><input type="number" className={inp} value={tr.maxQty} onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, maxQty: e.target.value } : x))} placeholder="∞" /></div>
                <div><label className={label}>Precio</label><input type="number" step="0.01" className={inp} value={tr.unitPrice} onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, unitPrice: e.target.value } : x))} /></div>
                <div><label className={label}>Moneda</label><input className={inp} value={tr.currency} onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, currency: e.target.value } : x))} placeholder="CNY" /></div>
                <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faTrash} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-xs" onClick={() => setTiers([...tiers, { minQty: '', maxQty: '', unitPrice: '', currency: 'CNY' }])}><FontAwesomeIcon icon={faPlus} /> Añadir tramo</button>
          </Section>

          {/* ===== Ejes de variación ===== */}
          <Section title="8 · Ejes de variación (Color / Talla)">
            {axes.map((a, i) => (
              <div key={i} className="rounded border border-base-200 p-2 space-y-2">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <div><label className={label}>Nombre del eje</label><input className={inp} value={a.name} onChange={(e) => setAxes(axes.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Color / Talla" /></div>
                  <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setAxes(axes.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faTrash} /></button>
                </div>
                <div><label className={label}>Valores (separados por coma)</label><input className={inp} value={a.values} onChange={(e) => setAxes(axes.map((x, j) => j === i ? { ...x, values: e.target.value } : x))} placeholder="Rojo, Negro, Blanco" /></div>
                <div><label className={label}>Imagen por valor (una por línea, formato valor=url)</label><textarea className="textarea textarea-bordered textarea-sm w-full h-12 font-mono text-[11px]" value={a.valueImages} onChange={(e) => setAxes(axes.map((x, j) => j === i ? { ...x, valueImages: e.target.value } : x))} placeholder={'Rojo=https://...\nNegro=https://...'} /></div>
                <div><label className={label}>Traducción por valor (una por línea, formato valor=es:Rojo, en:Red)</label><textarea className="textarea textarea-bordered textarea-sm w-full h-12 font-mono text-[11px]" value={a.valueTranslations} onChange={(e) => setAxes(axes.map((x, j) => j === i ? { ...x, valueTranslations: e.target.value } : x))} placeholder={'红色=es:Rojo, en:Red, pt:Vermelho\n黑色=es:Negro, en:Black'} /></div>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-xs" onClick={() => setAxes([...axes, { name: '', values: '', valueImages: '', valueTranslations: '' }])}><FontAwesomeIcon icon={faPlus} /> Añadir eje</button>
          </Section>

          {/* ===== Variantes / SKU ===== */}
          <Section title="9 · Variantes / SKU (precio, stock, peso)">
            {variants.map((v, i) => (
              <div key={i} className="rounded border border-base-200 p-2 space-y-2">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <div><label className={label}>SKU</label><input className={inp} value={v.sku} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} /></div>
                  <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setVariants(variants.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faTrash} /></button>
                </div>
                <div><label className={label}>Opciones (formato Eje:Valor, separadas por coma)</label><input className={inp} value={v.optionValues} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, optionValues: e.target.value } : x))} placeholder="Color:Rojo, Talla:M" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <div><label className={label}>Precio</label><input type="number" step="0.01" className={inp} value={v.price} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} /></div>
                  <div><label className={label}>Stock</label><input type="number" className={inp} value={v.stock} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))} /></div>
                  <div><label className={label}>Peso paquete (g)</label><input type="number" className={inp} value={v.packageWeightGrams} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, packageWeightGrams: e.target.value } : x))} /></div>
                </div>
                <div><label className={label}>Imagen (URL)</label><input className={inp} value={v.imageUrl} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, imageUrl: e.target.value } : x))} /></div>
                <div className="grid grid-cols-4 gap-2">
                  <div><label className={label}>Peso (g)</label><input type="number" className={inp} value={v.weightGrams} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, weightGrams: e.target.value } : x))} /></div>
                  <div><label className={label}>Largo</label><input type="number" className={inp} value={v.lengthMm} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, lengthMm: e.target.value } : x))} /></div>
                  <div><label className={label}>Ancho</label><input type="number" className={inp} value={v.widthMm} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, widthMm: e.target.value } : x))} /></div>
                  <div><label className={label}>Alto</label><input type="number" className={inp} value={v.heightMm} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, heightMm: e.target.value } : x))} /></div>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-xs" onClick={() => setVariants([...variants, { sku: '', optionValues: '', price: '', stock: '', imageUrl: '', weightGrams: '', packageWeightGrams: '', lengthMm: '', widthMm: '', heightMm: '' }])}><FontAwesomeIcon icon={faPlus} /> Añadir variante</button>
          </Section>

          {/* ===== Atributos ===== */}
          <Section title="10 · Atributos (facetas / filtros)">
            {attrs.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_5rem_auto] gap-2 items-end">
                <div><label className={label}>Clave</label><input className={inp} value={a.key} onChange={(e) => setAttrs(attrs.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="material" /></div>
                <div><label className={label}>Valor</label><input className={inp} value={a.value} onChange={(e) => setAttrs(attrs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="algodón" /></div>
                <div><label className={label}>Idioma</label><input className={inp} value={a.locale} onChange={(e) => setAttrs(attrs.map((x, j) => j === i ? { ...x, locale: e.target.value } : x))} placeholder="(neutral)" /></div>
                <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setAttrs(attrs.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faTrash} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-xs" onClick={() => setAttrs([...attrs, { key: '', value: '', locale: '' }])}><FontAwesomeIcon icon={faPlus} /> Añadir atributo</button>
          </Section>

          {/* ===== Ficha técnica ===== */}
          <Section title="11 · Ficha técnica (por idioma)">
            {specs.map((s, i) => (
              <div key={i} className="grid grid-cols-[4rem_1fr_1fr_auto] gap-2 items-end">
                <div><label className={label}>Idioma</label><input className={inp} value={s.locale} onChange={(e) => setSpecs(specs.map((x, j) => j === i ? { ...x, locale: e.target.value } : x))} placeholder="es" /></div>
                <div><label className={label}>Clave</label><input className={inp} value={s.key} onChange={(e) => setSpecs(specs.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="Material" /></div>
                <div><label className={label}>Valor</label><input className={inp} value={s.value} onChange={(e) => setSpecs(specs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="Algodón 100%" /></div>
                <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faTrash} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-xs" onClick={() => setSpecs([...specs, { locale: 'es', key: '', value: '', position: '' }])}><FontAwesomeIcon icon={faPlus} /> Añadir fila</button>
          </Section>

          {/* ===== Reseñas ===== */}
          <Section title="12 · Reseñas de clientes (cada una con su idioma)">
            {reviews.map((r, i) => (
              <div key={i} className="rounded border border-base-200 p-2 space-y-2">
                <div className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2 items-end">
                  <div><label className={label}>Autor</label><input className={inp} value={r.authorName} onChange={(e) => setReviews(reviews.map((x, j) => j === i ? { ...x, authorName: e.target.value } : x))} /></div>
                  <div><label className={label}>País</label><input className={inp} value={r.authorCountry} onChange={(e) => setReviews(reviews.map((x, j) => j === i ? { ...x, authorCountry: e.target.value } : x))} placeholder="ES" /></div>
                  <div><label className={label}>Estrellas</label><input type="number" min="1" max="5" className={inp} value={r.rating} onChange={(e) => setReviews(reviews.map((x, j) => j === i ? { ...x, rating: e.target.value } : x))} /></div>
                  <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setReviews(reviews.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faTrash} /></button>
                </div>
                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <div><label className={label}>Título</label><input className={inp} value={r.title} onChange={(e) => setReviews(reviews.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></div>
                  <div><label className={label}>Idioma</label>
                    <select className="select select-bordered select-sm w-full" value={r.language} onChange={(e) => setReviews(reviews.map((x, j) => j === i ? { ...x, language: e.target.value } : x))}>
                      {langs.map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className={label}>Reseña</label><textarea className="textarea textarea-bordered textarea-sm w-full h-14" value={r.body} onChange={(e) => setReviews(reviews.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} /></div>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-xs" onClick={() => setReviews([...reviews, { authorName: '', authorCountry: '', rating: '5', title: '', body: '', language: 'es' }])}><FontAwesomeIcon icon={faPlus} /> Añadir reseña</button>
          </Section>

          {/* ===== Avanzado ===== */}
          <Section title="13 · Valoración y datos avanzados">
            <div><label className={label}>Desglose de estrellas (formato 5:120, 4:30, ...)</label><input className={inp} value={f.ratingBreakdown} onChange={set('ratingBreakdown')} placeholder="5:120, 4:30, 3:5" /></div>
            <p className="text-[11px] text-ink-400">Del desglose se derivan el nº de reseñas y la media real (si no fijas valoración arriba).</p>
            <div><label className={label}>Regiones de venta (separadas por coma)</label><input className={inp} value={f.salesRegions} onChange={set('salesRegions')} placeholder="EU, US, LATAM" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={label}>Envíos dropship 30d</label><input type="number" className={inp} value={f.dropshipShipped30d} onChange={set('dropshipShipped30d')} /></div>
              <div><label className={label}>% recogida 48h</label><input type="number" step="0.01" className={inp} value={f.dropshipPickupRate48h} onChange={set('dropshipPickupRate48h')} /></div>
            </div>
          </Section>
        </div>

        <div className="flex justify-end gap-2 mt-4 sticky -bottom-5 bg-base-100 py-3 z-10 border-t border-base-200">
          <button onClick={onClose} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
          <button onClick={submit} disabled={busy} className="btn btn-primary btn-sm">
            {busy ? <FontAwesomeIcon icon={faSpinner} className="fa-spin" /> : <FontAwesomeIcon icon={faPlus} />} {t('admin.create_product.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
