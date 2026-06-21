import { api } from './client'

export interface Plan {
  id: string
  code: string
  name: string
  description?: string
  priceMonthlyCents: number
  priceYearlyCents: number
  currency: string
  position: number
  limits: Record<string, number>
}

export async function listPlans() {
  const { data } = await api.get<Plan[]>('/storefront/billing/plans')
  return data
}

export async function subscribe(planCode: string, period: 'MONTHLY' | 'YEARLY') {
  const { data } = await api.post<{ checkoutUrl: string; sessionId: string }>(
    '/storefront/billing/subscribe',
    { planCode, period },
  )
  return data
}

// ---- Métodos de pago (tarjeta guardada en el perfil, Stripe Elements) ----

export interface BillingConfig {
  publishableKey: string
  enabled: boolean
}

export interface PaymentMethod {
  id: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  isDefault: boolean
}

export async function billingConfig() {
  const { data } = await api.get<BillingConfig>('/me/billing/config')
  return data
}

export async function createSetupIntent() {
  const { data } = await api.post<{ clientSecret: string }>('/me/payment-methods/setup-intent')
  return data
}

export async function listPaymentMethods() {
  const { data } = await api.get<PaymentMethod[]>('/me/payment-methods')
  return data
}

export async function setDefaultPaymentMethod(id: string) {
  await api.post(`/me/payment-methods/${id}/default`)
}

export async function deletePaymentMethod(id: string) {
  await api.delete(`/me/payment-methods/${id}`)
}
