import { api } from './client'

export interface ReferralCode {
  id: string
  code: string
  label?: string
  active: boolean
  clicks: number
  url: string
}

export interface AffiliateCommission {
  id: string
  amountCents: number
  currency: string
  percentage: number
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'
  createdAt?: string
  approvedAt?: string
  paidAt?: string
  orderId?: string
  baseAmountCents: number
}

export interface AffiliateStats {
  clicks: number
  conversions: number
  pendingCents: number
  approvedCents: number
  paidCents: number
  currency: string
}

export interface AffiliateDashboard {
  id: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  commissionPercent: number
  joined: boolean
  canRequestPayout: boolean
  minPayoutCents: number
  payoutRequested: boolean
  codes: ReferralCode[]
  stats: AffiliateStats
  recentCommissions: AffiliateCommission[]
}

const REF_KEY = 'nx036-aff-ref'
const TOKEN_KEY = 'nx036-aff-visitor'

/** Customer + public affiliate API (DROP-645/649). */
export const affiliate = {
  dashboard: () => api.get<AffiliateDashboard>('/me/affiliate').then((r) => r.data),
  join:      () => api.post<AffiliateDashboard>('/me/affiliate/join').then((r) => r.data),
  addCode:   (label?: string) => api.post<ReferralCode>('/me/affiliate/codes', { label }).then((r) => r.data),
  toggleCode:(codeId: string, active: boolean) =>
               api.post<ReferralCode>(`/me/affiliate/codes/${codeId}/toggle`, null, { params: { active } }).then((r) => r.data),
  bind:      (visitorToken: string) => api.post('/me/affiliate/bind', { visitorToken }).then((r) => r.status),
  requestPayout: () => api.post<{ id: string; amountCents: number; status: string }>('/me/affiliate/payout-request').then((r) => r.data),
  track:     (ref: string, visitorToken?: string) =>
               api.post<{ visitorToken: string; attributed: boolean }>('/storefront/affiliate/track', { ref, visitorToken })
                 .then((r) => r.data),
}

/* ---- referral-capture cookie helpers (DROP-645, client side) ---- */

/** Newsletter (public) + email preferences (DROP email feature). */
export const newsletter = {
  subscribe: (email: string) =>
    api.post<{ status: string; alreadySubscribed: boolean }>('/storefront/newsletter/subscribe', { email })
      .then((r) => r.data),
  unsubscribe: (token: string) => api.post('/storefront/newsletter/unsubscribe', { token }).then((r) => r.data),
  getEmailPrefs: () => api.get<{ marketingOptOut: boolean }>('/me/email-preferences').then((r) => r.data),
  setEmailPrefs: (marketingOptOut: boolean) =>
    api.put<{ marketingOptOut: boolean }>('/me/email-preferences', { marketingOptOut }).then((r) => r.data),
}

export function rememberRef(code: string) {
  try { localStorage.setItem(REF_KEY, code) } catch { /* ignore */ }
}
export function pendingRef(): string | null {
  try { return localStorage.getItem(REF_KEY) } catch { return null }
}
export function visitorToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY)
    if (!t) { t = crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, t) }
    return t
  } catch {
    return crypto.randomUUID()
  }
}
