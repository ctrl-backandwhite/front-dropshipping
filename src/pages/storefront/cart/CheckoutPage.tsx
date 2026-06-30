import { useState, useEffect, useRef, useMemo, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCartStore } from '../../../store/cart'
import { useCurrencyStore } from '../../../store/currency'
import { useCartQuote } from '../../../hooks/useCartQuote'
import { addresses, AddressInput } from '../../../api/addresses'
import { wallet } from '../../../api/wallet'
import AddressFields from '../../../components/AddressFields'
import { orders, CheckoutRequest } from '../../../api/orders'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faLocationDot, faPlus, faCircleCheck, faTriangleExclamation, faWallet, faCreditCard,
} from '@fortawesome/free-solid-svg-icons'
import { faPaypal, faBitcoin } from '@fortawesome/free-brands-svg-icons'
import { useT } from '../../../store/locale'
import { api } from '../../../api/client'

const EMPTY_ADDRESS: AddressInput = {
  fullName: '', line1: '', city: '', country: '', phone: '', line2: '', state: '', postalCode: '',
}

export default function CheckoutPage() {
  const t = useT()
  // DROP-514: consolidamos cualquier duplicado residual del carrito persistido
  // (legacy: misma productId + variantId con precios distintos por currency
  // mixto). Sumamos quantity y nos quedamos con el precio más reciente
  // (último al final del array, que en zustand es el más recientemente añadido).
  const rawLines = useCartStore((s) => s.lines)
  const lines = (() => {
    const map = new Map<string, typeof rawLines[number]>()
    for (const l of rawLines) {
      const key = `${l.productId}::${l.variantId ?? ''}`
      const prev = map.get(key)
      if (prev) {
        map.set(key, { ...prev, ...l, quantity: prev.quantity + l.quantity })
      } else {
        map.set(key, l)
      }
    }
    return Array.from(map.values())
  })()
  const subtotalCents = useCartStore((s) => s.subtotalUsdCents())
  const clear = useCartStore((s) => s.clear)
  const format = useCurrencyStore((s) => s.format)
  const navigate = useNavigate()
  const qc = useQueryClient()

  // DROP-637: precio EN VIVO re-cotizado y FORMATEADO por el backend (margen + tasa del día) = EXACTAMENTE
  // lo que se factura y se cobra. Mismo hook que el drawer y el carrito → idéntico precio en todas las vistas.
  // El front solo PINTA los strings ya formateados por el backend (precio, subtotal, envío, IVA y total).
  const { unitText, lineTotalText, subtotalText, activeCurrency } = useCartQuote(lines)

  const { data: addrList, isLoading: addrLoading, isError: addrError } = useQuery({
    queryKey: ['addresses'], queryFn: addresses.list, retry: 1,
  })
  const { data: walletInfo } = useQuery({ queryKey: ['wallet'], queryFn: wallet.get })

  const [selectedAddressId, setSelectedAddressId] = useState<string | 'NEW' | undefined>(undefined)
  const [newAddress, setNewAddress] = useState<AddressInput>(EMPTY_ADDRESS)

  // Cotización de envío Cainiao por destino: tarifa real + ETA, y aviso si el país no está cubierto.
  // Incluimos también el estado/provincia para que el IVA se calcule por región (US/CA/BR).
  const shipCountry = selectedAddressId === 'NEW'
    ? newAddress.country
    : (addrList?.find((a) => a.id === selectedAddressId) as any)?.country
  const shipRegion = selectedAddressId === 'NEW'
    ? newAddress.state
    : (addrList?.find((a) => a.id === selectedAddressId) as any)?.state
  const { data: shipQuote } = useQuery({
    queryKey: ['ship-quote', shipCountry, shipRegion, lines.map((l) => `${l.productId}:${l.quantity}`).join(',')],
    queryFn: () => orders.shippingQuote(shipCountry!, lines.map((l) => ({
      productId: l.productId, variantId: l.variantId, quantity: l.quantity,
    })), shipRegion || undefined),
    enabled: !!shipCountry && lines.length > 0,
  })
  // Tasa de IVA (bps) solo para la etiqueta "(X%)". Los importes (envío/IVA/total) los calcula y
  // formatea el backend en el shipping-quote; aquí no se calcula nada.
  const taxRateBps = shipQuote?.supported ? (shipQuote.taxRateBps ?? 0) : 0
  const [saveAsAddress, setSaveAsAddress] = useState(true)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  // DROP-442: método de pago elegible
  type PayMethod = 'WALLET' | 'CARD' | 'PAYPAL' | 'USDT'
  // Orden y preselección: Tarjeta primero (luego PayPal, Wallet, USDT).
  const [payMethod, setPayMethod] = useState<PayMethod>('CARD')
  const [paymentResult, setPaymentResult] = useState<any>(null)
  // DROP-551: estado del form de tarjeta. Stripe en mock-mode acepta cualquier
  // input válido; en modo real (STRIPE_ENABLED=true) se confirma vía Stripe.js
  // usando el clientSecret devuelto por el backend.

  // DROP-552: auto-selección robusta de dirección. Anti-patrón previo (inline
  // setState durante render + dependencia en query resuelta) dejaba el botón
  // permanentemente deshabilitado si la query fallaba o tardaba. Ahora:
  //  - cuando hay direcciones → selecciona la default o la primera
  //  - cuando no hay (o la query falló) → activa el formulario 'NEW'
  useEffect(() => {
    if (selectedAddressId !== undefined) return
    if (addrLoading) return
    if (addrError || !addrList || addrList.length === 0) {
      setSelectedAddressId('NEW')
      return
    }
    const def = addrList.find((a) => a.default) ?? addrList[0]
    setSelectedAddressId(def.id)
  }, [addrList, addrLoading, addrError, selectedAddressId])

  // Anti multi-submit: el `disabled` por estado (isPending) tiene un tick de
  // retraso, así que un triple-clic rápido podía crear 3 órdenes. Un ref síncrono
  // bloquea reentradas; `idemRef` mantiene una Idempotency-Key estable por intento.
  const submittingRef = useRef(false)
  const idemRef = useRef('')
  // Idempotency-Key ESTABLE por contenido del carrito: si el usuario abandona la
  // pasarela y reintenta el mismo carrito, el backend reutiliza la orden sin pagar en
  // vez de crear un duplicado. Cambia solo si cambia el carrito (productos/qty).
  const cartIdem = useMemo(() => {
    const sig = lines.map((l) => `${l.productId}:${l.variantId ?? ''}:${l.quantity}`).sort().join('|')
    let h = 0
    for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0
    return `cart-${(h >>> 0).toString(36)}-${lines.length}`
  }, [lines])

  const placeOrder = useMutation({
    mutationFn: async () => {
      let body: CheckoutRequest = {
        items: lines.map((l) => ({
          productId: l.productId, variantId: l.variantId, quantity: l.quantity,
        })),
        notes: notes || undefined,
        // DROP-549: el backend sólo cobra el wallet si paymentMethod=WALLET.
        paymentMethod: payMethod,
      }
      if (selectedAddressId === 'NEW') {
        if (saveAsAddress) {
          const created = await addresses.create({ ...newAddress, isDefault: (addrList?.length ?? 0) === 0 })
          body.shippingAddressId = created.id
        } else {
          body.shippingAddressInline = {
            fullName: newAddress.fullName, phone: newAddress.phone, line1: newAddress.line1,
            line2: newAddress.line2, city: newAddress.city, state: newAddress.state,
            postalCode: newAddress.postalCode, country: newAddress.country,
          }
        }
      } else if (selectedAddressId) {
        body.shippingAddressId = selectedAddressId
      }
      return orders.checkout(body, idemRef.current || undefined)
    },
    onSuccess: async (o) => {
      try {
        // DROP-442: tras crear la orden, dispara el payment-intent según método
        const res = await api.post(`/me/orders/${o.id}/payment-intent`, { method: payMethod },
          { headers: { 'Idempotency-Key': `checkout-${o.id}-${payMethod}` } })
        setPaymentResult(res.data)
        // OJO: NO vaciamos el carrito aquí. Para CARD/PAYPAL el pago ocurre en la
        // pasarela externa y el usuario puede volver atrás SIN pagar; si vaciáramos
        // ahora, al volver vería "Nada para checkout". El carrito se vacía solo cuando
        // el pago se CONFIRMA: WALLET / confirm directo (abajo), USDT confirmado, o en
        // /checkout/return tras el retorno del proveedor.
        qc.invalidateQueries({ queryKey: ['wallet'] })
        qc.invalidateQueries({ queryKey: ['orders'] })

        if (payMethod === 'WALLET') {
          clear()
          navigate(`/orders/${o.id}?placed=1`)
          return
        }
        if (payMethod === 'CARD' || payMethod === 'PAYPAL') {
          // CARD → Stripe Checkout Session (hospedado); PAYPAL → aprobación PayPal.
          // Ambos devuelven una URL de aprobación: en real es absoluta (checkout.stripe.com
          // / paypal.com) y redirigimos; el proveedor vuelve a /checkout/return que confirma
          // del lado servidor. En mock-mode la URL es relativa a /checkout/return.
          const url = res.data?.approveUrl as string | undefined
          if (url && /^https?:\/\//i.test(url)) { window.location.href = url; return }
          if (url) { navigate(url.replace(/^.*\/checkout\/return/, '/checkout/return')); return }
          // Fallback sin URL: confirmamos directo contra el proveedor.
          await api.post(`/me/orders/${o.id}/payments/${res.data.id}/confirm`)
          clear()
          navigate(`/orders/${o.id}?placed=1&paid=1`)
          return
        }
        // USDT: se queda en pantalla mostrando la dirección + QR. El usuario
        // hace el envío externo y un admin confirma vía webhook/manual.
      } catch (err: any) {
        const raw = err?.response?.data?.message ?? err?.message ?? t('checkout.error_default')
        const msg = /insufficient wallet balance/i.test(raw) ? t('checkout.insufficient_long') : raw
        setError(msg)
      }
    },
    onError: (e: any) => {
      // DROP-550: traducir mensajes conocidos del backend al locale activo.
      const raw = e?.response?.data?.message ?? e?.message ?? t('checkout.error_default')
      const msg = /insufficient wallet balance/i.test(raw) ? t('checkout.insufficient_long') : raw
      setError(msg)
    },
    // Tras fallar, liberamos el guard y renovamos la key para permitir un reintento limpio.
    // Solo liberamos el guard de reentrada; el idem se mantiene estable por carrito
    // (lo recalcula submit() desde cartIdem) para que un reintento reutilice la orden.
    onSettled: () => { submittingRef.current = false },
  })

  if (lines.length === 0 && !paymentResult) {
    return (
      <div className="max-w-2xl mx-auto card p-10 text-center">
        <h1>{t('checkout.empty.title')}</h1>
        <p className="text-sm text-ink-500 mt-2">{t('checkout.empty.desc')}</p>
        <Link to="/catalog" className="btn btn-primary inline-flex mt-5">{t('cart.see_catalog')}</Link>
      </div>
    )
  }

  const insufficient = walletInfo && walletInfo.availableUsdCents < subtotalCents
  const newAddrValid = newAddress.fullName.trim() && newAddress.line1.trim() && newAddress.city.trim() && newAddress.country.trim()
  // Saldo insuficiente sólo bloquea cuando el método es WALLET. Para CARD/PAYPAL/USDT
  // el partner paga externamente; el wallet check no aplica.
  const blockedByWallet = payMethod === 'WALLET' && insufficient
  // DROP-551: cuando el método es CARD, validamos formato mínimo del form de
  // La tarjeta ya no se introduce en nuestro frontend: CARD redirige a la página
  // hospedada de Stripe Checkout, así que no hay validación de tarjeta que hacer aquí.
  const canSubmit = selectedAddressId !== undefined &&
    (selectedAddressId !== 'NEW' || newAddrValid) &&
    !(shipQuote && !shipQuote.supported) && // país no soportado por Cainiao
    !blockedByWallet && !placeOrder.isPending

  function submit(e: FormEvent) {
    e.preventDefault()
    // Guard síncrono: ignora reentradas mientras hay un envío en curso (evita
    // que un triple-clic rápido cree varias órdenes antes de que React desactive el botón).
    if (submittingRef.current || placeOrder.isPending) return
    submittingRef.current = true
    idemRef.current = cartIdem
    setError(null)
    placeOrder.mutate()
  }

  return (
    <form onSubmit={submit} className="max-w-5xl mx-auto space-y-4">
      <h1>{t('checkout.title')}</h1>
      {/* DROP-555: grid items-start para que ambas columnas comiencen alineadas
          desde el tope. Sin items-start, una columna más alta hace que la otra
          se centre verticalmente en algunos breakpoints. */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
      <div className="lg:col-span-2 space-y-4">

        <section className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FontAwesomeIcon icon={faLocationDot} className="text-brand-600" /> {t('checkout.shipping')}
          </div>

          {addrLoading && (
            <div className="text-xs text-ink-500 py-3 flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-brand-500 animate-pulse" />
              {t('common.loading')}…
            </div>
          )}

          {(addrList?.length ?? 0) > 0 && (
            <div className="grid sm:grid-cols-2 gap-2">
              {addrList!.map((a) => (
                <label key={a.id}
                       className={`card p-3 text-sm cursor-pointer transition-colors ${
                         selectedAddressId === a.id ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-ink-300'
                       }`}>
                  <div className="flex items-start gap-2">
                    <input type="radio" name="addr" checked={selectedAddressId === a.id}
                           onChange={() => setSelectedAddressId(a.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{a.label || a.fullName}</span>
                        {a.default && <span className="badge bg-brand-50 text-brand-700">{t('checkout.default')}</span>}
                      </div>
                      <div className="text-xs text-ink-500 mt-1">
                        {a.fullName} · {a.line1}{a.line2 ? `, ${a.line2}` : ''}
                      </div>
                      <div className="text-xs text-ink-500">
                        {a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode} · {a.country}
                      </div>
                      {a.phone && <div className="text-xs text-ink-500">{t('checkout.phone')}: {a.phone}</div>}
                    </div>
                  </div>
                </label>
              ))}
              <label className={`card p-3 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
                selectedAddressId === 'NEW' ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-ink-300'
              }`}>
                <input type="radio" name="addr" checked={selectedAddressId === 'NEW'}
                       onChange={() => setSelectedAddressId('NEW')} />
                <FontAwesomeIcon icon={faPlus} className="text-brand-600" />
                {t('checkout.use_other_address')}
              </label>
            </div>
          )}

          {selectedAddressId === 'NEW' && (
            <div className="pt-2 space-y-3">
              <AddressFields value={newAddress} onChange={setNewAddress} />
              <label className="text-xs text-ink-600 flex items-center gap-2">
                <input type="checkbox" checked={saveAsAddress} onChange={(e) => setSaveAsAddress(e.target.checked)} />
                {t('checkout.save_address')}
              </label>
            </div>
          )}

          <div className="pt-1 text-xs text-ink-500">
            <Link to="/addresses" className="hover:underline inline-flex items-center gap-1">
              <FontAwesomeIcon icon={faLocationDot} /> {t('addresses.manage_link')}
            </Link>
          </div>
        </section>

        <section className="card p-5 space-y-3">
          <h3>{t('checkout.products')} ({lines.length})</h3>
          <ul className="divide-y divide-ink-100 text-sm">
            {lines.map((l) => (
              <li key={l.productId + (l.variantId ?? '')} className="py-3 flex gap-3">
                {/* DROP-514: filtrar imágenes placeholder antes de renderizar para
                    no mostrar "800 × 800" en checkout. Si la URL es placeholder
                    o vacía, escondemos onError. */}
                {l.image && !/via\.placeholder|placehold\.co|dummyimage|fakeimg|picsum/i.test(l.image)
                  ? <img src={l.image} className="w-14 h-14 object-cover rounded" alt=""
                         onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  : <div className="w-14 h-14 rounded bg-ink-100 flex items-center justify-center text-ink-400 text-xs">—</div>}
                <div className="flex-1 min-w-0">
                  <div className="font-medium line-clamp-1">{l.title}</div>
                  {/* Variante seleccionada (color / talla) visible en el checkout. */}
                  {l.variantLabel && <div className="text-xs text-ink-500">{l.variantLabel}</div>}
                  <div className="text-xs text-ink-500">{l.quantity} × {unitText(l)}</div>
                </div>
                <div className="text-sm font-medium">{lineTotalText(l)}</div>
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <label className="text-xs text-ink-500">{t('checkout.notes')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('checkout.notes_placeholder')}
                      rows={2} className="input mt-1 w-full text-sm" />
          </div>
        </section>
      </div>

      <aside className="lg:col-span-1">
        {/* DROP-555: quitamos sticky top-20 para que la columna del resumen
            quede alineada con el card de envío del checkout (la primera
            sección de la columna izquierda empieza en la misma top que el
            card del resumen). */}
        <div className="card p-5 space-y-4">
          <h3>{t('checkout.summary')}</h3>
          <div className="text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-500">{t('cart.subtotal')}</span><span>{subtotalText}</span></div>
            <div className="flex justify-between text-ink-500">
              <span>{t('order.detail.shipping')}{shipQuote?.supported && <span className="block text-[11px] opacity-70">{t('tracking.carrier_default')} · {shipQuote.etaMinDays}–{shipQuote.etaMaxDays} {t('checkout.ship_days')}</span>}</span>
              <span>{!shipCountry ? '—' : shipQuote ? (shipQuote.supported ? shipQuote.shippingFormatted : t('checkout.ship_unsupported_short')) : '…'}</span>
            </div>
            {taxRateBps > 0 && shipQuote?.supported && (
              <div className="flex justify-between text-ink-500">
                <span>{t('order.detail.tax')} ({taxRateBps / 100}%)</span>
                <span>{shipQuote.taxFormatted}</span>
              </div>
            )}
            <div className="border-t border-ink-100 pt-2 mt-2 flex justify-between font-medium text-base">
              <span>{t('checkout.total')}</span><span>{shipQuote?.supported ? shipQuote.totalFormatted : subtotalText}</span>
            </div>
          </div>
          {shipCountry && shipQuote && !shipQuote.supported && (
            <div className="mt-2 text-[12px] text-warning-content/90 bg-warning/10 border border-warning/30 rounded p-2">
              {t('checkout.ship_unsupported')}
            </div>
          )}

          {/* DROP-442: selector de método de pago */}
          <div className="space-y-2">
            <div className="text-xs font-medium opacity-70">{t('checkout.payment_method')}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {([
                { id: 'CARD',   icon: faCreditCard, label: t('checkout.pay_card') },
                { id: 'PAYPAL', icon: faPaypal,     label: 'PayPal' },
                { id: 'WALLET', icon: faWallet,     label: t('checkout.pay_wallet') },
                { id: 'USDT',   icon: faBitcoin,    label: 'USDT' },
              ] as const).map((m) => (
                <button key={m.id} type="button" onClick={() => setPayMethod(m.id)}
                        className={`border rounded-md p-2 flex items-center gap-1.5 ${payMethod === m.id ? 'border-primary bg-primary/10 text-primary-content' : 'border-base-300'}`}>
                  <FontAwesomeIcon icon={m.icon} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {payMethod === 'WALLET' && (
            <div className="bg-base-200/50 rounded-md p-3 text-xs space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <FontAwesomeIcon icon={faWallet} /> {t('checkout.pay_wallet')}
              </div>
              {walletInfo ? (
                <>
                  {/* DROP-464: muestra el saldo convertido a la divisa activa para coherencia
                      con el total del carrito que también se renderiza convertido. */}
                  <div className="opacity-80">{t('checkout.available')}: <strong>{format(walletInfo.availableUsdCents / 100, 'USD')}</strong></div>
                  {insufficient && (
                    <div className="text-warning-content mt-1 flex items-start gap-1">
                      <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
                      {t('checkout.insufficient')} <Link to="/wallet/recharge" className="link link-primary ml-1">{t('checkout.recharge_link')}</Link>
                    </div>
                  )}
                </>
              ) : <div className="opacity-60">{t('checkout.loading_balance')}</div>}
            </div>
          )}

          {/* CARD → Stripe Checkout (hospedado): la tarjeta se introduce en la página
              segura de Stripe, no en nuestro frontend (sin datos PCI en el cliente). */}
          {payMethod === 'CARD' && (
            <div className="bg-base-200/50 rounded-md p-3 text-xs space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <FontAwesomeIcon icon={faCreditCard} /> {t('checkout.pay_card')}
              </div>
              <div className="opacity-80">{t('checkout.stripe_redirect_note')}</div>
            </div>
          )}
          {payMethod === 'PAYPAL' && (
            <div className="bg-base-200/50 rounded-md p-3 text-xs space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <FontAwesomeIcon icon={faPaypal} /> PayPal
              </div>
              <div className="opacity-80">{t('checkout.paypal_redirect_note')}</div>
            </div>
          )}
          {paymentResult && payMethod === 'USDT' && (
            <div className="alert alert-info text-xs flex-col items-start gap-2">
              <div className="flex items-center gap-1"><FontAwesomeIcon icon={faBitcoin} /> {t('checkout.send_usdt')}</div>
              <code className="font-mono text-[11px] break-all">{paymentResult.cryptoAddress}</code>
              <div className="opacity-70">{t('checkout.chain')}: {paymentResult.cryptoChain} · {t('checkout.expires')}: {new Date(paymentResult.cryptoExpiresAt).toLocaleTimeString()}</div>
              {/* DROP-553: en mock-mode permitimos cerrar el flujo desde la UI
                  con "ya envié". En producción, un webhook de Coinbase Commerce
                  marcará el pago como SUCCEEDED automáticamente. */}
              <button type="button"
                      className="btn btn-xs btn-primary mt-1"
                      onClick={async () => {
                        try {
                          await api.post(`/me/orders/${paymentResult.orderId}/payments/${paymentResult.id}/confirm-mock`)
                          clear()
                          navigate(`/orders/${paymentResult.orderId}?placed=1&paid=1`)
                        } catch (e: any) {
                          setError(e?.response?.data?.message ?? e?.message ?? 'USDT confirm failed')
                        }
                      }}>
                {t('checkout.usdt_sent') ?? 'I have sent the payment'}
              </button>
            </div>
          )}

          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          {/* DROP-552: pista visual cuando el botón está deshabilitado para que
              el usuario sepa exactamente qué falta. Antes el botón quedaba
              grisáceo sin explicación. */}
          {!canSubmit && !placeOrder.isPending && (
            <div className="text-[11px] text-warning-content/80 bg-warning/10 border border-warning/30 rounded p-2 space-y-0.5">
              {selectedAddressId === undefined && <div>• {t('checkout.shipping')}</div>}
              {selectedAddressId === 'NEW' && !newAddrValid && <div>• {t('checkout.full_name')} / {t('checkout.line1')} / {t('checkout.city')} / {t('checkout.country_iso')}</div>}
                {blockedByWallet && <div>• {t('checkout.insufficient')}</div>}
            </div>
          )}

          <button type="submit" disabled={!canSubmit}
                  className="btn btn-primary w-full">
            {placeOrder.isPending ? t('common.processing') : (
              <><FontAwesomeIcon icon={faCircleCheck} /> {t('checkout.confirm_order')}</>
            )}
          </button>
          <Link to="/cart" className="btn btn-ghost block text-center text-sm">{t('checkout.back_to_cart')}</Link>
        </div>
      </aside>
      </div>
    </form>
  )
}
