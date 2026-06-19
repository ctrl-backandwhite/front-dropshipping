import { create } from 'zustand'
import { api } from '../api/client'

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
      const { data } = await api.get<CurrentUser>('/me')
      set({ user: data ?? null })
    } catch {
      set({ user: null })
    } finally {
      set({ initialized: true, loading: false })
    }
  },

  async login(email, password) {
    set({ loading: true })
    try {
      const { data } = await api.post<CurrentUser>('/auth/login', { email, password })
      set({ user: data, initialized: true })
      return data
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
    set({ user: null })
  },

  hasRole(...roles) {
    const u = get().user
    return !!u && roles.includes(u.role)
  },
}))
