import { api } from './client'

export interface OrderListItem {
  id: string
  orderNumber: string
  status: string
  totalCents: number
  /** Total ya formateado por el backend en la moneda activa (igual que el detalle). El front lo pinta. */
  totalFormatted?: string
  currency: string
  itemCount: number
  placedAt: string
  shippedAt?: string
  deliveredAt?: string
}

export interface OrderAddress {
  fullName: string
  phone?: string
  email?: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode?: string
  country: string
}

export interface OrderItemView {
  id: string
  productId: string
  variantId?: string
  productTitle: string
  variantName?: string
  imageUrl?: string
  quantity: number
  unitPrice: string
  lineTotal: string
  // DROP-637: strings ya formateados por el backend en la moneda mostrada (el front solo pinta).
  unitPriceFormatted?: string
  lineTotalFormatted?: string
  supplierName?: string
  supplierExternalId?: string
}

export interface OrderView {
  id: string
  orderNumber: string
  externalOrderId?: string
  status: string
  /** Método de pago original (CARD/PAYPAL/USDT/WALLET) — decide a dónde ofrecer el reembolso al cancelar. */
  paymentMethod?: string
  currency: string
  subtotal: string
  shipping: string
  tax: string
  total: string
  // DROP-637: importes ya formateados por el backend en la moneda mostrada (el front solo pinta).
  subtotalFormatted?: string
  shippingFormatted?: string
  taxFormatted?: string
  totalFormatted?: string
  shippingAddress?: OrderAddress
  billingAddress?: OrderAddress
  notes?: string
  trackingCarrier?: string
  trackingNumber?: string
  placedAt?: string
  shippedAt?: string
  deliveredAt?: string
  cancelledAt?: string
  items: OrderItemView[]
}

export interface CheckoutItem {
  productId: string
  variantId?: string
  quantity: number
}

export interface CheckoutRequest {
  shippingAddressId?: string
  shippingAddressInline?: OrderAddress
  items: CheckoutItem[]
  notes?: string
  // DROP-549: el backend respeta este campo para decidir si cobra el wallet
  // o deja la orden PENDING para pago externo (CARD/PAYPAL/USDT).
  paymentMethod?: 'WALLET' | 'CARD' | 'PAYPAL' | 'USDT'
}

function randomKey() {
  return crypto?.randomUUID?.() ?? 'k-' + Date.now() + '-' + Math.random().toString(36).slice(2)
}

export interface TrackingEvent {
  status: string
  description?: string
  location?: string
  source?: string
  occurredAt?: string
}
export interface TrackingView {
  status?: string
  carrier?: string
  trackingNumber?: string
  estimatedDeliveryAt?: string
  lastTrackedAt?: string
  events: TrackingEvent[]
}
export interface ShippingQuote {
  supported: boolean
  countryCode?: string
  amountUsdCents: number
  carrier?: string
  serviceName?: string
  etaMinDays: number
  etaMaxDays: number
  zone?: string
  /** Tasa de IVA del país de envío en puntos básicos (2100 = 21%); solo para la etiqueta "X%". */
  taxRateBps?: number
  /** Importes YA formateados por el backend en la moneda activa (el front solo los pinta). */
  shippingFormatted?: string
  taxFormatted?: string
  totalFormatted?: string
}

/** Región (estado/provincia) de un país para el dropdown de direcciones. */
export interface Region { code: string; name: string }

export interface CartQuoteLine {
  productId: string; variantId?: string; unit: number; lineTotal: number
  // DROP-637: strings ya formateados por el backend ("28,26 €"). El front solo los pinta.
  unitFormatted?: string; lineTotalFormatted?: string
}
export interface CartQuote {
  currency: string; symbol: string; items: CartQuoteLine[]; subtotal: number; subtotalFormatted?: string
}

export const orders = {
  list: () => api.get<OrderListItem[]>('/me/orders').then((r) => r.data),
  // Cotización del carrito con el precio ACTUAL (el que se factura/cobra), en la moneda activa (X-Currency).
  // Evita el desfase "veo X en el checkout y me cobran Y" cuando el precio cambió tras añadir al carrito.
  cartQuote: (items: CheckoutItem[]) =>
    api.post<CartQuote>('/storefront/catalog/cart-quote', items).then((r) => r.data),
  // DROP-537: pasar lang para que el backend devuelva el título del producto
  // traducido en lugar del titleSnapshot chino.
  detail: (id: string, lang = 'es') =>
    api.get<OrderView>(`/me/orders/${id}`, { params: { lang } }).then((r) => r.data),
  // Cancelación por el cliente (solo si el pedido está PAGADO y aún no enviado a proveedor): reembolsa y cancela.
  // refundToWallet=true → a la billetera (inmediato); false → al método original (tarjeta/PayPal, con sus tiempos).
  cancel: (id: string, lang = 'es', refundToWallet = true) =>
    api.post<OrderView>(`/me/orders/${id}/cancel`, null, { params: { lang, refundToWallet } }).then((r) => r.data),
  checkout: (body: CheckoutRequest, idem?: string) =>
    api.post<OrderView>('/me/orders/checkout', body, {
      headers: { 'Idempotency-Key': idem ?? randomKey() },
    }).then((r) => r.data),
  tracking: (id: string) =>
    api.get<TrackingView>(`/me/orders/${id}/tracking`).then((r) => r.data),
  // Cotización de envío Cainiao + IVA (según país/región) + total, ya formateado por el backend.
  shippingQuote: (country: string, items: CheckoutItem[], region?: string) =>
    api.post<ShippingQuote>('/storefront/shipping/quote', { country, region, items }).then((r) => r.data),
  // Regiones (estado/provincia) de un país para el dropdown de direcciones/checkout.
  regions: (country: string) =>
    api.get<Region[]>('/storefront/shipping/regions', { params: { country } }).then((r) => r.data),
  // Países a los que se puede enviar (cobertura real de Cainiao) — para el banner de la home.
  shippingCountries: () =>
    api.get<ShippingCountry[]>('/storefront/shipping/countries').then((r) => r.data),
}

export interface ShippingCountry { countryCode: string; countryName: string }
