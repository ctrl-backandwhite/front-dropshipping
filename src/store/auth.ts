import { create } from 'zustand'
import { api } from '../api/client'
import { authToken } from '../lib/authToken'

/** Respuesta del login/refresh por token: par de tokens + perfil. */
interface LoginResponse {
  token: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: CurrentUser
}

export interface CurrentUser {
  id: string
  email: string
  role: 'ADMIN' | 'OPERATOR' | 'PARTNER' | 'USER'
  active: boolean
  displayName?: string
  companyName?: string
  country?: string
  language?: string
  // DROP-583: URL pública del avatar subido por el usuario (MinIO/S3).
  avatarUrl?: string
  createdAt: string
  lastLogin?: string
  authorities: string[]
}

interface AuthState {
  user: CurrentUser | null
  loading: boolean
  initialized: boolean
  init: () => Promise<void>
  // Carga /me con el token actual (usado por el callback de Google tras guardar el token).
  fetchMe: () => Promise<void>
  login: (email: string, password: string) => Promise<CurrentUser>
  register: (data: RegisterPayload) => Promise<{ userId: string; message: string }>
  activate: (code: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: CurrentUser['role'][]) => boolean
  // DROP-544: refresca el user en el store tras un PUT /me sin re-llamar a init().
  setUser: (u: CurrentUser | null) => void
}

export interface RegisterPayload {
  email: string
  password: string
  displayName?: string
  companyName?: string
  country?: string
  language?: string
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  // DROP-544
  setUser(u) { set({ user: u }) },

  async init() {
    if (get().initialized) return
    set({ loading: true })
    try {
      // Sin token no llamamos a /me (evita un 401 → refresh inútil en el arranque en frío).
      const { data } = authToken.access ? await api.get<CurrentUser>('/me') : { data: null }
      set({ user: data ?? null })
    } catch {
      set({ user: null })
    } finally {
      set({ initialized: true, loading: false })
    }
  },

  async fetchMe() {
    set({ loading: true })
    try {
      const { data } = await api.get<CurrentUser>('/me')
      set({ user: data ?? null, initialized: true })
    } catch {
      set({ user: null, initialized: true })
    } finally {
      set({ loading: false })
    }
  },

  async login(email, password) {
    set({ loading: true })
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
      authToken.set(data.token, data.refreshToken)
      set({ user: data.user, initialized: true })
      return data.user
    } finally {
      set({ loading: false })
    }
  },

  async register(payload) {
    const { data } = await api.post<{ userId: string; message: string }>('/auth/register', payload)
    return data
  },

  async activate(code) {
    await api.post('/auth/activate', { code })
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignored — we'll clear state anyway
    }
    authToken.clear()
    set({ user: null })
  },

  hasRole(...roles) {
    const u = get().user
    return !!u && roles.includes(u.role)
  },
}))
