import { api } from './client'

export interface UserAddress {
  id: string
  label?: string
  fullName: string
  phone?: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode?: string
  country: string
  default: boolean
  createdAt: string
}

export interface AddressInput {
  label?: string
  fullName: string
  phone?: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode?: string
  country: string
  isDefault?: boolean
}

export const addresses = {
  list: () => api.get<UserAddress[]>('/me/addresses').then((r) => r.data),
  create: (body: AddressInput) => api.post<UserAddress>('/me/addresses', body).then((r) => r.data),
  update: (id: string, body: AddressInput) =>
    api.put<UserAddress>(`/me/addresses/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/me/addresses/${id}`).then((r) => r.data),
}
