import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { admin, type AdminCreateOrderBody, type AdminOrderItemBody } from '../../api/admin'
import { listStorefrontProducts } from '../../api/catalog'
import { dialog } from '../../store/dialog'
import { useT } from '../../store/locale'

const inp = 'input input-bordered input-sm w-full'
const lbl = 'text-[12px] font-medium text-ink-600 mb-1 block'

type Line = AdminOrderItemBody & { title: string }

/** DROP-690: modal de alta manual de orden (cliente por email opcional, líneas de producto, dirección). */
export function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [customerEmail, setCustomerEmail] = useState('')
  const [externalOrderId, setExternalOrderId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [search, setSearch] = useState('')
  const [addr, setAddr] = useState({ fullName: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: '' })

  const { data: products } = useQuery({
    queryKey: ['order-product-pick', search],
    queryFn: () => listStorefrontProducts(0, 20, 'es', search ? { q: search } : {}),
    staleTime: 30_000,
  })

  const save = useMutation({
    mutationFn: (body: AdminCreateOrderBody) => admin.createOrder(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-orders'] }); onClose() },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? 'Error' }),
  })

  function addLine(p: { id: string; title: string }) {
    setLines((ls) => ls.some((l) => l.productId === p.id)
      ? ls.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)
      : [...ls, { productId: p.id, title: p.title, quantity: 1 }])
  }
  function setQty(id: string, q: number) { setLines((ls) => ls.map((l) => l.productId === id ? { ...l, quantity: Math.max(1, q) } : l)) }
  function removeLine(id: string) { setLines((ls) => ls.filter((l) => l.productId !== id)) }

  function submit() {
    if (lines.length === 0) { dialog.alert({ variant: 'error', message: t('admin.orders.create.no_items') }); return }
    if (!addr.fullName.trim() || !addr.line1.trim() || !addr.city.trim() || !addr.country.trim()) {
      dialog.alert({ variant: 'error', message: t('admin.orders.create.addr_required') }); return
    }
    save.mutate({
      customerEmail: customerEmail.trim() || undefined,
      externalOrderId: externalOrderId.trim() || undefined,
      shippingAddress: { ...addr },
      items: lines.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-2xl p-5 max-h-[92vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{t('admin.orders.create.title')}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-square"><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl}>{t('admin.orders.create.customer_email')}</label><input className={inp} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="cliente@ejemplo.com" /></div>
          <div><label className={lbl}>{t('admin.orders.create.external_id')}</label><input className={inp} value={externalOrderId} onChange={(e) => setExternalOrderId(e.target.value)} placeholder="#1234" /></div>
        </div>

        {/* Líneas de producto */}
        <div>
          <label className={lbl}>{t('admin.orders.create.items')}</label>
          <input className={inp} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.orders.create.search_product')} />
          {search && (products?.items?.length ?? 0) > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto border border-ink-100 rounded-md divide-y divide-ink-100">
              {products!.items.map((p) => (
                <button key={p.id} onClick={() => addLine({ id: p.id, title: p.title })} className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-ink-50 flex items-center gap-2">
                  <FontAwesomeIcon icon={faPlus} className="text-ink-400" /> {p.title}
                </button>
              ))}
            </div>
          )}
          {lines.length > 0 && (
            <div className="mt-2 space-y-1">
              {lines.map((l) => (
                <div key={l.productId} className="flex items-center gap-2 text-[12px] bg-ink-50 rounded-md px-2 py-1">
                  <span className="flex-1 truncate">{l.title}</span>
                  <input type="number" min={1} value={l.quantity} onChange={(e) => setQty(l.productId, Number(e.target.value))} className="input input-bordered input-xs w-16" />
                  <button onClick={() => removeLine(l.productId)} className="btn btn-ghost btn-xs btn-square text-error"><FontAwesomeIcon icon={faTrash} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dirección de envío */}
        <div>
          <label className={lbl}>{t('admin.orders.create.shipping')}</label>
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} value={addr.fullName} onChange={(e) => setAddr({ ...addr, fullName: e.target.value })} placeholder={t('admin.orders.create.full_name') + ' *'} />
            <input className={inp} value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} placeholder={t('admin.orders.create.phone')} />
            <input className={inp} value={addr.email} onChange={(e) => setAddr({ ...addr, email: e.target.value })} placeholder={t('admin.orders.create.email')} />
            <input className={inp} value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} placeholder={t('admin.orders.create.line1') + ' *'} />
            <input className={inp} value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} placeholder={t('admin.orders.create.line2')} />
            <input className={inp} value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder={t('admin.orders.create.city') + ' *'} />
            <input className={inp} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} placeholder={t('admin.orders.create.state')} />
            <input className={inp} value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} placeholder={t('admin.orders.create.postal')} />
            <input className={inp} value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} placeholder={t('admin.orders.create.country') + ' * (ES)'} />
          </div>
        </div>

        <div><label className={lbl}>{t('admin.orders.create.notes')}</label><textarea className="textarea textarea-bordered textarea-sm w-full h-16" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
          <button onClick={submit} disabled={save.isPending} className="btn btn-primary btn-sm">{t('actions.save')}</button>
        </div>
      </div>
    </div>
  )
}

const EXAMPLE = JSON.stringify([{
  customerEmail: 'cliente@ejemplo.com',
  externalOrderId: '#1001',
  shippingAddress: { fullName: 'Juan Pérez', phone: '+34600000000', email: 'cliente@ejemplo.com', line1: 'C/ Mayor 1', city: 'Madrid', state: 'M', postalCode: '28001', country: 'ES' },
  items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 2 }],
  notes: 'Importada desde CSV',
}], null, 2)

/** DROP-690: modal de importación masiva de órdenes (JSON, reporte por fila). */
export function ImportOrdersModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null)

  const run = useMutation({
    mutationFn: (orders: AdminCreateOrderBody[]) => admin.importOrders(orders),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ['admin-orders'] }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? 'Error' }),
  })

  function submit() {
    let parsed: any
    try { parsed = JSON.parse(text) } catch { dialog.alert({ variant: 'error', message: t('admin.orders.import.bad_json') }); return }
    if (!Array.isArray(parsed) || parsed.length === 0) { dialog.alert({ variant: 'error', message: t('admin.orders.import.empty') }); return }
    run.mutate(parsed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-[95vw] max-w-6xl h-[90vh] max-h-[92vh] p-5 border border-base-200 flex flex-col overflow-hidden space-y-3">
        <div className="flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-lg">{t('admin.orders.import.title')}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-square"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        <p className="text-[12px] text-ink-500 shrink-0">{t('admin.orders.import.help')}</p>
        <textarea className="textarea textarea-bordered textarea-sm w-full flex-1 min-h-0 resize-none overflow-auto font-mono text-[11px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} />
        <button onClick={() => setText(EXAMPLE)} className="btn btn-ghost btn-xs shrink-0 self-start">{t('admin.orders.import.load_example')}</button>

        {result && (
          <div className="text-[12px] border border-ink-100 rounded-md p-3 space-y-1 max-h-40 overflow-auto shrink-0">
            <div className="text-success font-medium">{t('admin.orders.import.imported')}: {result.imported}</div>
            {result.failed > 0 && <div className="text-error font-medium">{t('admin.orders.import.failed')}: {result.failed}</div>}
            {result.errors.map((er, i) => <div key={i} className="text-ink-500">• {er}</div>)}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1 shrink-0">
          <button onClick={onClose} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
          <button onClick={submit} disabled={run.isPending} className="btn btn-primary btn-sm">{t('admin.orders.import.run')}</button>
        </div>
      </div>
    </div>
  )
}
