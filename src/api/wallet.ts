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
}

export interface RechargeResponse {
  paymentId: string
  method: 'CARD' | 'PAYPAL' | 'USDT'
  status: string
  amountUsdCents: number
  provider: string
  providerRef: string
  clientSecret?: string
  approveUrl?: string
  cryptoAddress?: string
  cryptoChain?: string
  qrUrl?: string
  expiresAt?: string
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
  recharge: (body: { method: 'CARD' | 'PAYPAL' | 'USDT'; amountUsdCents: number; cryptoChain?: string }, idem?: string) =>
    api.post<RechargeResponse>('/me/wallet/recharge', body, {
      headers: { 'Idempotency-Key': idem ?? randomKey() },
    }).then((r) => r.data),
  confirmMock: (paymentId: string) =>
    api.post(`/me/wallet/confirm-mock?paymentId=${paymentId}`).then((r) => r.data),
  paypalCapture: (paymentId: string) =>
    api.post(`/me/wallet/paypal/capture?paymentId=${paymentId}`).then((r) => r.data),
}
