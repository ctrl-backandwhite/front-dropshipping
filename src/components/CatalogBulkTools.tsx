import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRotate, faFileImport, faXmark, faSpinner, faCircleInfo, faTriangleExclamation, faWandMagicSparkles, faCopy, faCircleCheck, faPaperclip } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../api/admin'
import { dialog } from '../store/dialog'
import { useT } from '../store/locale'

type FieldType = 'string' | 'number' | 'int' | 'urls' | 'list' | 'objects' | 'map'
/** `descKey` points to the i18n description; the human-readable accepted values live there. */
type FieldDef = { key: string; required?: boolean; type: FieldType; descKey: string }

/**
 * Field reference per import kind — mirrors the backend Bulk*DtoIn validations
 * exactly (required flags + types). The modal renders this as a documented table
 * so every property a product/category accepts is visible, with the optional ones
 * clearly flagged.
 */
const SCHEMAS: Record<'products' | 'categories', FieldDef[]> = {
  products: [
    { key: 'categorySlug', type: 'string', descKey: 'admin.catalog.bulk.fd.categorySlug' },
    { key: 'category1688Id', type: 'string', descKey: 'admin.catalog.bulk.fd.category1688Id' },
    { key: 'category1688Name', type: 'string', descKey: 'admin.catalog.bulk.fd.category1688Name' },
    { key: 'titleEs', required: true, type: 'string', descKey: 'admin.catalog.bulk.fd.titleEs' },
    { key: 'titleEn', type: 'string', descKey: 'admin.catalog.bulk.fd.titleEn' },
    { key: 'titlePt', type: 'string', descKey: 'admin.catalog.bulk.fd.titlePt' },
    { key: 'titleZh', type: 'string', descKey: 'admin.catalog.bulk.fd.titleZh' },
    { key: 'descriptionEs', type: 'string', descKey: 'admin.catalog.bulk.fd.descriptionEs' },
    { key: 'descriptionEn', type: 'string', descKey: 'admin.catalog.bulk.fd.descriptionEn' },
    { key: 'descriptionPt', type: 'string', descKey: 'admin.catalog.bulk.fd.descriptionPt' },
    { key: 'descriptionZh', type: 'string', descKey: 'admin.catalog.bulk.fd.descriptionZh' },
    { key: 'translations', type: 'map', descKey: 'admin.catalog.bulk.fd.translations' },
    { key: 'price', type: 'number', descKey: 'admin.catalog.bulk.fd.price' },
    { key: 'moq', type: 'int', descKey: 'admin.catalog.bulk.fd.moq' },
    { key: 'monthlySales', type: 'int', descKey: 'admin.catalog.bulk.fd.monthlySales' },
    { key: 'rating', type: 'number', descKey: 'admin.catalog.bulk.fd.rating' },
    { key: 'supplierExternalId', type: 'string', descKey: 'admin.catalog.bulk.fd.supplierExternalId' },
    { key: 'supplierName', type: 'string', descKey: 'admin.catalog.bulk.fd.supplierName' },
    { key: 'manufacturer', type: 'string', descKey: 'admin.catalog.bulk.fd.manufacturer' },
    { key: 'imageUrls', type: 'urls', descKey: 'admin.catalog.bulk.fd.imageUrls' },
    { key: 'videoUrl', type: 'string', descKey: 'admin.catalog.bulk.fd.videoUrl' },
    { key: 'tieredPricing', type: 'objects', descKey: 'admin.catalog.bulk.fd.tieredPricing' },
    { key: 'variantAxes', type: 'objects', descKey: 'admin.catalog.bulk.fd.variantAxes' },
    { key: 'variants', type: 'objects', descKey: 'admin.catalog.bulk.fd.variants' },
    { key: 'attributes', type: 'objects', descKey: 'admin.catalog.bulk.fd.attributes' },
    { key: 'specifications', type: 'objects', descKey: 'admin.catalog.bulk.fd.specifications' },
    { key: 'reviews', type: 'objects', descKey: 'admin.catalog.bulk.fd.reviews' },
    { key: 'videoUrls', type: 'urls', descKey: 'admin.catalog.bulk.fd.videoUrls' },
    { key: 'salesRegions', type: 'list', descKey: 'admin.catalog.bulk.fd.salesRegions' },
    { key: 'ratingBreakdown', type: 'map', descKey: 'admin.catalog.bulk.fd.ratingBreakdown' },
    { key: 'crossBorderSupport', type: 'map', descKey: 'admin.catalog.bulk.fd.crossBorderSupport' },
    { key: 'dropshipShipped30d', type: 'int', descKey: 'admin.catalog.bulk.fd.dropshipShipped30d' },
    { key: 'dropshipPickupRate48h', type: 'number', descKey: 'admin.catalog.bulk.fd.dropshipPickupRate48h' },
    { key: 'weightGrams', type: 'int', descKey: 'admin.catalog.bulk.fd.weightGrams' },
    { key: 'packageWeightGrams', type: 'int', descKey: 'admin.catalog.bulk.fd.packageWeightGrams' },
    { key: 'lengthMm', type: 'int', descKey: 'admin.catalog.bulk.fd.lengthMm' },
    { key: 'widthMm', type: 'int', descKey: 'admin.catalog.bulk.fd.widthMm' },
    { key: 'heightMm', type: 'int', descKey: 'admin.catalog.bulk.fd.heightMm' },
    { key: 'countryOfOrigin', type: 'string', descKey: 'admin.catalog.bulk.fd.countryOfOrigin' },
    { key: 'hsCode', type: 'string', descKey: 'admin.catalog.bulk.fd.hsCode' },
    { key: 'certifications', type: 'list', descKey: 'admin.catalog.bulk.fd.certifications' },
    { key: 'shipFrom', type: 'string', descKey: 'admin.catalog.bulk.fd.shipFrom' },
    { key: 'leadTimeDays', type: 'int', descKey: 'admin.catalog.bulk.fd.leadTimeDays' },
    { key: 'status', type: 'string', descKey: 'admin.catalog.bulk.fd.status' },
    { key: 'externalId', type: 'string', descKey: 'admin.catalog.bulk.fd.externalId' },
    { key: 'sourceUrl', type: 'string', descKey: 'admin.catalog.bulk.fd.sourceUrl' },
  ],
  categories: [
    { key: 'slug', required: true, type: 'string', descKey: 'admin.catalog.bulk.fd.slug' },
    { key: 'nameEs', required: true, type: 'string', descKey: 'admin.catalog.bulk.fd.nameEs' },
    { key: 'nameEn', type: 'string', descKey: 'admin.catalog.bulk.fd.nameEn' },
    { key: 'namePt', type: 'string', descKey: 'admin.catalog.bulk.fd.namePt' },
    { key: 'nameZh', type: 'string', descKey: 'admin.catalog.bulk.fd.nameZh' },
    { key: 'icon', type: 'string', descKey: 'admin.catalog.bulk.fd.icon' },
    { key: 'position', type: 'int', descKey: 'admin.catalog.bulk.fd.position' },
    { key: 'parentSlug', type: 'string', descKey: 'admin.catalog.bulk.fd.parentSlug' },
  ],
}

/** Minimal example: only the required fields plus a couple of common ones. */
const EXAMPLES: Record<'products' | 'categories', string> = {
  products: `[
  {
    "categorySlug": "consumer-electronics",
    "titleEs": "Auricular X",
    "titleEn": "Headset X",
    "price": 29.90,
    "moq": 1,
    "imageUrls": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"]
  }
]`,
  categories: `[
  {
    "slug": "mi-categoria",
    "nameEs": "Mi categoría",
    "nameEn": "My category",
    "namePt": "Minha categoria",
    "nameZh": "我的分类",
    "icon": "tag"
  }
]`,
}

/** Full template: every accepted field filled in, so the user can see/copy them all. */
const FULL_EXAMPLES: Record<'products' | 'categories', string> = {
  products: `[
  {
    "categorySlug": "consumer-electronics",
    "category1688Id": "126546700",
    "category1688Name": "蓝牙耳机",
    "titleEs": "Auricular inalámbrico X",
    "titleEn": "Wireless Headset X",
    "titlePt": "Fone de ouvido sem fio X",
    "titleZh": "无线耳机 X",
    "descriptionEs": "Auriculares Bluetooth con cancelación de ruido.",
    "descriptionEn": "Bluetooth headphones with noise cancelling.",
    "descriptionPt": "Fones Bluetooth com cancelamento de ruído.",
    "descriptionZh": "蓝牙降噪耳机。",
    "translations": {
      "fr": { "title": "Casque sans fil X", "description": "Casque Bluetooth à réduction de bruit." },
      "de": { "title": "Kabelloses Headset X", "description": "Bluetooth-Kopfhörer mit Geräuschunterdrückung." },
      "it": { "title": "Cuffie wireless X", "description": "Cuffie Bluetooth con cancellazione del rumore." }
    },
    "price": 29.90,
    "moq": 1,
    "monthlySales": 1200,
    "rating": 4.6,
    "ratingBreakdown": { "5": 120, "4": 30, "3": 5, "2": 1, "1": 0 },
    "supplierName": "Shenzhen Acme Audio Co., Ltd.",
    "supplierExternalId": "1688-supplier-001",
    "manufacturer": "Acme Manufacturing Co.",
    "imageUrls": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"],
    "videoUrl": "https://cdn.example.com/video/headset-x.mp4",
    "videoUrls": ["https://cdn.example.com/video/headset-x-2.mp4"],
    "salesRegions": ["EU", "US", "LATAM"],
    "tieredPricing": [
      { "minQty": 1, "maxQty": 9, "unitPrice": 18.5, "currency": "CNY" },
      { "minQty": 10, "unitPrice": 15.0, "currency": "CNY" }
    ],
    "variantAxes": [
      { "name": "Color", "values": ["Blanco", "Negro"], "valueImages": { "Blanco": "https://img.example.com/x-white.jpg", "Negro": "https://img.example.com/x-black.jpg" }, "valueTranslations": { "Blanco": { "en": "White", "pt": "Branco", "zh": "白色" }, "Negro": { "en": "Black", "pt": "Preto", "zh": "黑色" } } },
      { "name": "Talla", "values": ["M", "L"] }
    ],
    "variants": [
      { "sku": "HX-WH-M", "optionValues": { "Color": "Blanco", "Talla": "M" }, "price": 18.5, "stock": 120, "imageUrl": "https://img.example.com/x-white.jpg", "weightGrams": 450, "packageWeightGrams": 500, "lengthMm": 300, "widthMm": 185, "heightMm": 110, "supplierSkuId": "1688-sku-001" },
      { "sku": "HX-BK-L", "optionValues": { "Color": "Negro", "Talla": "L" }, "price": 18.5, "stock": 80, "imageUrl": "https://img.example.com/x-black.jpg", "weightGrams": 460 }
    ],
    "attributes": [
      { "key": "material", "value": "ABS" },
      { "key": "material", "value": "ABS plastic", "locale": "en" },
      { "key": "connectivity", "value": "Bluetooth 5.3" }
    ],
    "specifications": [
      { "locale": "es", "key": "Material", "value": "Plástico ABS", "position": 0 },
      { "locale": "en", "key": "Material", "value": "ABS plastic", "position": 0 },
      { "locale": "es", "key": "Autonomía", "value": "30 h", "position": 1 }
    ],
    "reviews": [
      { "authorName": "Li Wei", "authorCountry": "CN", "rating": 5, "title": "很好", "body": "音质很好，电池耐用。", "language": "zh", "verifiedPurchase": true },
      { "authorName": "María G.", "authorCountry": "ES", "rating": 5, "title": "Excelentes", "body": "Gran sonido y batería duradera.", "language": "es", "verifiedPurchase": true },
      { "authorName": "John D.", "authorCountry": "US", "rating": 4, "title": "Good value", "body": "Solid sound, comfortable fit.", "language": "en" }
    ],
    "weightGrams": 450,
    "packageWeightGrams": 500,
    "lengthMm": 300,
    "widthMm": 185,
    "heightMm": 110,
    "countryOfOrigin": "CN",
    "hsCode": "8518300000",
    "certifications": ["CE", "RoHS"],
    "shipFrom": "Shenzhen, Guangdong",
    "leadTimeDays": 2,
    "dropshipShipped30d": 3200,
    "dropshipPickupRate48h": 0.98,
    "crossBorderSupport": { "fastShipping": true, "warehouses": ["DE", "US"] },
    "status": "ACTIVE",
    "externalId": "979099339858",
    "sourceUrl": "https://detail.1688.com/offer/979099339858.html"
  }
]`,
  categories: `[
  {
    "slug": "electronica",
    "nameEs": "Electrónica",
    "nameEn": "Electronics",
    "namePt": "Eletrónica",
    "nameZh": "电子产品",
    "icon": "tag",
    "position": 10
  },
  {
    "slug": "auriculares",
    "nameEs": "Auriculares",
    "nameEn": "Headphones",
    "namePt": "Fones de ouvido",
    "nameZh": "耳机",
    "icon": "headphones",
    "position": 1,
    "parentSlug": "electronica"
  }
]`,
}

/**
 * Toolbar for the admin catalog pages: a "Sync to OpenSearch" (reindex) button and a
 * bulk JSON importer (products or categories). The importer documents the accepted
 * fields, validates each row on the client (required fields + types) before sending,
 * and reports per-row results. Calls back `onDone` after a successful import/reindex.
 */
export function CatalogBulkTools({ kind, onDone }: { kind: 'products' | 'categories'; onDone?: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(EXAMPLES[kind])
  const [busy, setBusy] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  // Expanded by default so every accepted property (and which are optional) is visible up-front.
  const [showFields, setShowFields] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  // Importación por ARCHIVO adjunto (para volúmenes grandes que no caben/no se pegan bien en el textarea).
  // Si hay archivo, tiene prioridad sobre el textarea. Se procesa en lotes de BATCH_SIZE.
  const [fileRows, setFileRows] = useState<any[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const BATCH_SIZE = 100

  const schema = SCHEMAS[kind]
  const [copied, setCopied] = useState(false)

  // Live parse status shown above the editor: row count or a parse error.
  const parsed = useMemo(() => {
    try {
      const v = JSON.parse(text)
      if (!Array.isArray(v)) return { ok: false as const, count: 0 }
      return { ok: true as const, count: v.length, rows: v }
    } catch {
      return { ok: false as const, count: 0 }
    }
  }, [text])

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(FULL_EXAMPLES[kind])
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard no disponible */ }
  }

  async function reindex() {
    setReindexing(true)
    try {
      const r = await admin.reindexCatalog()
      dialog.alert({ variant: 'success', message: t('admin.catalog.reindex.ok').replace('{n}', String(r.indexed)) })
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.catalog.reindex.error') })
    } finally {
      setReindexing(false)
    }
  }

  const rowMsg = (n: number, msg: string) => `${t('admin.catalog.bulk.row').replace('{n}', String(n))}: ${msg}`

  /** Client-side per-row validation mirroring the backend DTO constraints. */
  function validate(rows: any[]): string[] {
    const errs: string[] = []
    if (!rows.length) return [t('admin.catalog.bulk.empty')]
    rows.forEach((row, i) => {
      const n = i + 1
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        errs.push(rowMsg(n, t('admin.catalog.bulk.err_object')))
        return
      }
      for (const f of schema) {
        const v = row[f.key]
        const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
        if (f.required && empty) {
          errs.push(rowMsg(n, t('admin.catalog.bulk.err_required').replace('{f}', f.key)))
          continue
        }
        if (empty) continue
        if (f.type === 'number' && (typeof v === 'boolean' || isNaN(Number(v))))
          errs.push(rowMsg(n, t('admin.catalog.bulk.err_number').replace('{f}', f.key)))
        if (f.type === 'int' && (typeof v === 'boolean' || !Number.isInteger(Number(v))))
          errs.push(rowMsg(n, t('admin.catalog.bulk.err_integer').replace('{f}', f.key)))
        if ((f.type === 'urls' || f.type === 'list') && !(Array.isArray(v) && v.every((u) => typeof u === 'string')))
          errs.push(rowMsg(n, t('admin.catalog.bulk.err_array').replace('{f}', f.key)))
        if (f.type === 'objects' && !Array.isArray(v))
          errs.push(rowMsg(n, t('admin.catalog.bulk.err_array').replace('{f}', f.key)))
        if (f.type === 'map' && (typeof v !== 'object' || v === null || Array.isArray(v)))
          errs.push(rowMsg(n, t('admin.catalog.bulk.err_array').replace('{f}', f.key)))
      }
    })
    return errs
  }

  // Validación AUTOMÁTICA en vivo (al pegar/escribir): detecta JSON mal formado con su línea/columna,
  // estructura inválida (no es array) y errores por fila (campos obligatorios/tipos), sin tener que enviar.
  const live = useMemo(() => {
    const txt = text.trim()
    if (!txt) return { kind: 'empty' as const }
    let v: any
    try {
      v = JSON.parse(txt)
    } catch (err: any) {
      const msg = String(err?.message ?? 'JSON inválido')
      const m = msg.match(/position (\d+)/)
      let where = ''
      if (m) {
        const pos = Math.min(Number(m[1]), txt.length)
        const before = txt.slice(0, pos)
        const line = before.split('\n').length
        const col = pos - before.lastIndexOf('\n')
        where = ` — línea ${line}, columna ${col}`
      }
      return { kind: 'syntax' as const, message: msg + where }
    }
    if (!Array.isArray(v)) return { kind: 'notarray' as const }
    const problems = validate(v)
    return problems.length
      ? { kind: 'invalid' as const, count: v.length, problems }
      : { kind: 'valid' as const, count: v.length }
  }, [text])

  /** Adjunta un archivo .json (array de filas). Se parsea una sola vez; el textarea queda ignorado. */
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // permite re-seleccionar el mismo archivo
    if (!f) return
    setErrors([])
    try {
      const content = await f.text()
      const v = JSON.parse(content)
      if (!Array.isArray(v)) {
        setFileRows(null); setFileName('')
        setErrors(['El archivo debe ser un array JSON: [ … ].'])
        return
      }
      setFileRows(v)
      setFileName(f.name)
    } catch (err: any) {
      setFileRows(null); setFileName('')
      setErrors(['Archivo JSON inválido: ' + String(err?.message ?? err)])
    }
  }

  function clearFile() {
    setFileRows(null); setFileName(''); setErrors([])
  }

  async function submit() {
    setErrors([])
    // Origen de las filas: el archivo adjunto tiene prioridad; si no, el textarea.
    let rows: any[]
    if (fileRows) {
      rows = fileRows
    } else {
      try {
        rows = JSON.parse(text)
        if (!Array.isArray(rows)) throw new Error('not array')
      } catch {
        setErrors([t('admin.catalog.bulk.invalid_json')])
        return
      }
    }
    const problems = validate(rows)
    if (problems.length) {
      setErrors(problems)
      return
    }

    // Inserción en LOTES de BATCH_SIZE (100). Un archivo de 10.000 filas → 100 lotes secuenciales.
    setBusy(true)
    let created = 0
    let failed = 0
    const allErrors: string[] = []
    setProgress({ done: 0, total: rows.length })
    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE)
        const from = i + 1
        const to = i + chunk.length
        try {
          const res = kind === 'products' ? await admin.bulkProducts(chunk) : await admin.bulkCategories(chunk)
          created += res.created
          failed += res.failed
          if (res.errors?.length) allErrors.push(...res.errors.map((er) => `[${from}-${to}] ${er}`))
        } catch (e: any) {
          failed += chunk.length
          allErrors.push(`Lote ${from}-${to}: ${e?.response?.data?.message ?? t('admin.catalog.bulk.error')}`)
        }
        setProgress({ done: to, total: rows.length })
      }
      const msg = t('admin.catalog.bulk.result').replace('{ok}', String(created)).replace('{fail}', String(failed))
      if (failed > 0) {
        setErrors(allErrors)
        dialog.alert({ variant: 'warning', message: msg })
      } else {
        dialog.alert({ variant: 'success', message: msg })
        setOpen(false)
        setFileRows(null)
        setFileName('')
      }
      onDone?.()
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <>
      <button onClick={reindex} disabled={reindexing}
              className="btn btn-outline btn-sm text-[12px]" title={t('admin.catalog.reindex.hint')}>
        <FontAwesomeIcon icon={reindexing ? faSpinner : faRotate} className={reindexing ? 'fa-spin' : ''} />
        {t('admin.catalog.reindex.btn')}
      </button>
      <button onClick={() => { setText(EXAMPLES[kind]); setErrors([]); setShowFields(false); setFileRows(null); setFileName(''); setProgress(null); setOpen(true) }} className="btn btn-outline btn-sm text-[12px]">
        <FontAwesomeIcon icon={faFileImport} /> {t('admin.catalog.bulk.btn')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()}
               className="relative bg-base-100 rounded-box shadow-xl w-[95vw] max-w-6xl h-[90vh] max-h-[92vh] p-5 border border-base-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="font-semibold text-lg">{t(kind === 'products' ? 'admin.catalog.bulk.title_products' : 'admin.catalog.bulk.title_categories')}</h3>
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm btn-square"><FontAwesomeIcon icon={faXmark} /></button>
            </div>

            <p className="text-[12px] opacity-70 mb-2 shrink-0">{t('admin.catalog.bulk.help')}</p>

            {/* Field reference (documented template): every accepted property + whether it is optional. */}
            <div className="mb-2 shrink-0">
              <button type="button" onClick={() => setShowFields((s) => !s)}
                      className="btn btn-ghost btn-xs text-[12px] px-1">
                <FontAwesomeIcon icon={faCircleInfo} /> {t('admin.catalog.bulk.fields')}
              </button>
              {showFields && (
                <div className="mt-1 rounded-box bg-base-200/60 border border-base-200 text-[12px] max-h-56 overflow-auto">
                  <table className="w-full">
                    <thead className="text-[11px] uppercase tracking-wide opacity-60 sticky top-0 bg-base-200">
                      <tr>
                        <th className="text-left font-medium px-3 py-1.5">{t('admin.catalog.bulk.col_field')}</th>
                        <th className="text-left font-medium px-2 py-1.5">{t('admin.catalog.bulk.col_req')}</th>
                        <th className="text-left font-medium px-2 py-1.5">{t('admin.catalog.bulk.col_type')}</th>
                        <th className="text-left font-medium px-3 py-1.5">{t('admin.catalog.bulk.col_desc')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schema.map((f) => (
                        <tr key={f.key} className="border-t border-base-300/50 align-top">
                          <td className="px-3 py-1.5 font-mono whitespace-nowrap">{f.key}</td>
                          <td className="px-2 py-1.5">
                            {f.required
                              ? <span className="badge badge-sm bg-error/15 text-error border-0">{t('admin.catalog.bulk.required_badge')}</span>
                              : <span className="badge badge-sm bg-base-300/60 text-ink-500 border-0">{t('admin.catalog.bulk.optional_badge')}</span>}
                          </td>
                          <td className="px-2 py-1.5 font-mono opacity-60 whitespace-nowrap">{f.type}</td>
                          <td className="px-3 py-1.5 opacity-80">{t(f.descKey)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Plantilla completa de ejemplo SIEMPRE visible (read-only) + copiar al portapapeles. */}
            <details className="mb-2 shrink-0 rounded-box border border-base-200 bg-base-200/40" open>
              <summary className="cursor-pointer select-none px-3 py-1.5 text-[12px] font-medium flex items-center justify-between">
                <span><FontAwesomeIcon icon={faFileImport} /> Plantilla de ejemplo completa</span>
                <button type="button" onClick={(e) => { e.preventDefault(); copyTemplate() }}
                        className="btn btn-ghost btn-xs text-[12px]">
                  <FontAwesomeIcon icon={copied ? faCircleCheck : faCopy} className={copied ? 'text-success' : ''} />
                  {copied ? 'Copiado' : 'Copiar JSON'}
                </button>
              </summary>
              <pre className="px-3 pb-2 text-[11px] font-mono max-h-44 overflow-auto whitespace-pre">{FULL_EXAMPLES[kind]}</pre>
            </details>

            {/* Validación AUTOMÁTICA en vivo del JSON pegado. */}
            <div className="flex items-center justify-between mb-1 shrink-0 gap-2">
              <span className={`text-[12px] flex items-center gap-1 ${
                live.kind === 'valid' ? 'text-success' : live.kind === 'empty' ? 'opacity-50' : 'text-error'}`}>
                {live.kind === 'valid' && (<><FontAwesomeIcon icon={faCircleCheck} /> JSON válido · {live.count} fila(s)</>)}
                {live.kind === 'empty' && <span className="opacity-60">Pega aquí tu array JSON…</span>}
                {live.kind === 'syntax' && (<><FontAwesomeIcon icon={faTriangleExclamation} /> JSON mal formado: {live.message}</>)}
                {live.kind === 'notarray' && (<><FontAwesomeIcon icon={faTriangleExclamation} /> El JSON debe ser un array de filas: [ … ]</>)}
                {live.kind === 'invalid' && (<><FontAwesomeIcon icon={faTriangleExclamation} /> {live.count} fila(s), {live.problems.length} error(es) de validación</>)}
              </span>
              <div className="flex items-center gap-1">
                <label className="btn btn-ghost btn-xs text-[12px] cursor-pointer">
                  <FontAwesomeIcon icon={faPaperclip} /> Adjuntar JSON
                  <input type="file" accept=".json,application/json" className="hidden" onChange={onFile} disabled={busy} />
                </label>
                <button type="button" onClick={() => { setText(EXAMPLES[kind]); setErrors([]) }}
                        className="btn btn-ghost btn-xs text-[12px]">
                  <FontAwesomeIcon icon={faWandMagicSparkles} /> {t('admin.catalog.bulk.example')}
                </button>
                <button type="button" onClick={() => { setText(FULL_EXAMPLES[kind]); setErrors([]) }}
                        className="btn btn-ghost btn-xs text-[12px]">
                  <FontAwesomeIcon icon={faFileImport} /> {t('admin.catalog.bulk.template_full')}
                </button>
              </div>
            </div>

            {/* Detalle de errores de validación en vivo (por fila / estructura), antes de enviar. */}
            {(live.kind === 'syntax' || live.kind === 'notarray' || live.kind === 'invalid') && errors.length === 0 && (
              <div className="mb-1 p-2 rounded-box bg-error/10 border border-error/30 text-[12px] max-h-32 overflow-auto shrink-0">
                {live.kind === 'invalid'
                  ? (<ul className="list-disc pl-4 space-y-0.5">{live.problems.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}</ul>)
                  : <span className="text-error">{live.kind === 'syntax' ? live.message : 'El contenido debe ser un array JSON [ … ]'}</span>}
              </div>
            )}

            {/* Archivo adjunto (prioridad sobre el textarea). Para volúmenes grandes (hasta ~10.000 filas). */}
            {fileRows && (
              <div className="mb-1 p-2 rounded-box bg-primary/10 border border-primary/30 text-[12px] flex items-center justify-between gap-2 shrink-0">
                <span className="flex items-center gap-2 min-w-0">
                  <FontAwesomeIcon icon={faPaperclip} className="text-primary" />
                  <span className="truncate"><b>{fileName}</b> · {fileRows.length.toLocaleString()} fila(s) — se importará por lotes de {BATCH_SIZE}. El textarea se ignora.</span>
                </span>
                <button type="button" onClick={clearFile} disabled={busy} className="btn btn-ghost btn-xs shrink-0">
                  <FontAwesomeIcon icon={faXmark} /> Quitar
                </button>
              </div>
            )}

            {/* Progreso de la importación por lotes. */}
            {progress && (
              <div className="mb-1 shrink-0">
                <div className="flex items-center justify-between text-[12px] mb-0.5">
                  <span className="flex items-center gap-1"><FontAwesomeIcon icon={faSpinner} className="fa-spin" /> Importando…</span>
                  <span className="font-mono">{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
                </div>
                <progress className="progress progress-primary w-full" value={progress.done} max={progress.total} />
              </div>
            )}

            <textarea value={text} onChange={(e) => { setText(e.target.value); if (errors.length) setErrors([]) }} spellCheck={false}
                      disabled={!!fileRows}
                      placeholder={fileRows ? 'Usando el archivo adjunto…' : undefined}
                      className={`textarea textarea-bordered w-full font-mono text-[12px] flex-1 min-h-0 resize-none overflow-auto ${fileRows ? 'opacity-40' : ''}`} />

            {/* Validation / server error feedback */}
            {errors.length > 0 && (
              <div className="mt-2 p-3 rounded-box bg-error/10 border border-error/30 text-[12px] max-h-40 overflow-auto shrink-0">
                <div className="font-semibold text-error mb-1">
                  <FontAwesomeIcon icon={faTriangleExclamation} /> {t('admin.catalog.bulk.validation_errors')}
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
                {errors.length > 50 && <div className="opacity-60 mt-1">+{errors.length - 50}…</div>}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3 shrink-0">
              <button onClick={() => setOpen(false)} disabled={busy} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
              <button onClick={submit} disabled={busy || (!fileRows && !parsed.ok)} className="btn btn-primary btn-sm">
                {busy && <FontAwesomeIcon icon={faSpinner} className="fa-spin" />} {t('admin.catalog.bulk.import')}
                {(fileRows || parsed.ok) && !busy && (
                  <span className="opacity-70">· {(fileRows?.length ?? parsed.count).toLocaleString()}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
