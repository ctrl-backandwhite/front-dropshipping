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
