import { api } from './client'
import type { CurrentUser } from '../store/auth'

export interface UpdateProfileInput {
  displayName?: string
  companyName?: string
  country?: string
  language?: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export const profile = {
  update: (body: UpdateProfileInput) => api.put<CurrentUser>('/me', body).then((r) => r.data),
  changePassword: (body: ChangePasswordInput) =>
    api.post('/me/password', body).then((r) => r.data),
}
