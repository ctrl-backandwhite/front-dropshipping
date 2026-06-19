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
  // DROP-583: subida multipart del avatar — devuelve MeView con avatarUrl
  // actualizada para que el store de auth re-renderice sin volver a llamar /me.
  // NO seteamos Content-Type manualmente: el navegador agrega el boundary
  // correcto cuando ve un FormData. Forzar "multipart/form-data" sin
  // boundary hace que Spring rechace el request.
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    // Sobre-escribimos Content-Type a undefined para que axios detecte el
    // FormData y arme el boundary correcto. Sin esto, el default JSON del
    // cliente base se cuela y Spring devuelve 415.
    return api.post<CurrentUser>('/me/avatar', form, {
      headers: { 'Content-Type': undefined as any },
    }).then((r) => r.data)
  },
}
