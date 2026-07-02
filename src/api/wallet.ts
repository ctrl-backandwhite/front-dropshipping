import { api } from './client'

export interface Wallet {
  id: string
  balanceUsdCents: number
  holdUsdCents: number
  availableUsdCents: number
  currencyDefault: string
  status: string
  balanceDisplay: number
  displayCurrency: string
  displaySymbol: string
  // Importes ya formateados por el backend (convención del país). El front solo pinta.
  balanceFormatted?: string
  balanceUsdFormatted?: string
  holdUsdFormatted?: string
}

export interface WalletTx {
  id: string
  kind: 'DEPOSIT' | 'WITHDRAW' | 'PAYMENT' | 'REFUND' | 'HOLD' | 'RELEASE' | 'ADJUSTMENT'
  amountUsdCents: number
  balanceAfterCents: number
  status: string
  description?: string
  paymentId?: string
  orderId?: string
  createdAt: string
  // Importes ya formateados por el backend (convención del país), con signo. El front solo pinta.
  amountFormatted?: string
  balanceAfterFormatted?: string
}

export interface RechargeResponse {
  paymentId: string
  method: 'CARD' | 'PAYPAL' | 'USDT'
  status: string
  amountUsdCents: number
  /** Moneda de cobro real (EUR/USD/USDT) e importe formateado por el backend. */
  chargeCurrency?: string
  chargeFormatted?: string
  provider: string
  providerRef: string
  clientSecret?: string
  approveUrl?: string
  cryptoAddress?: string
  cryptoChain?: string
  qrUrl?: string
  expiresAt?: string
}

export interface RechargePreset {
  /** Importe en la divisa activa (lo que se envía como amountDisplay). */
  amount: number
  /** Texto ya formateado por el backend, p.ej. "50,00 €" o "$50.00". */
  formatted: string
}
export interface RechargeOptions {
  currency: string
  symbol: string
  presets: RechargePreset[]
}

function randomKey() {
  return crypto?.randomUUID?.() ?? 'k-' + Date.now() + '-' + Math.random().toString(36).slice(2)
}

export const wallet = {
  get: () => api.get<Wallet>('/me/wallet').then((r) => r.data),
  transactions: (page = 0, size = 20) =>
    api.get<{ items: WalletTx[]; totalElements: number; totalPages: number; page: number; size: number }>(
      '/me/wallet/transactions', { params: { page, size } }
    ).then((r) => r.data),
  recharge: (body: { method: 'CARD' | 'PAYPAL' | 'USDT'; amountUsdCents?: number; currencyDisplay?: string; amountDisplay?: number; cryptoChain?: string }, idem?: string) =>
    api.post<RechargeResponse>('/me/wallet/recharge', body, {
      headers: { 'Idempotency-Key': idem ?? randomKey() },
    }).then((r) => r.data),
  // Presets de recarga redondeados por el backend en la divisa activa (el front solo los pinta).
  rechargeOptions: (currency: string) =>
    api.get<RechargeOptions>('/me/wallet/recharge/options', { params: { currency } }).then((r) => r.data),
  confirmMock: (paymentId: string) =>
    api.post(`/me/wallet/confirm-mock?paymentId=${paymentId}`).then((r) => r.data),
  // Confirmación al volver de la pasarela (Stripe Checkout / PayPal): valida el cobro y acredita el wallet.
  confirmRecharge: (paymentId: string) =>
    api.post(`/me/wallet/recharge/${paymentId}/confirm`).then((r) => r.data),
  paypalCapture: (paymentId: string) =>
    api.post(`/me/wallet/paypal/capture?paymentId=${paymentId}`).then((r) => r.data),
}
