import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { authToken } from '../lib/authToken'

// Base del API. En local queda vacío → baseURL '/api' (mismo origen, nginx/vite proxy).
// En Railway (SPA estático + API en otro dominio) se define VITE_API_BASE_URL al dominio
// del backend en build time → baseURL 'https://back-….up.railway.app/api'.
export const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

function readCurrency(): string {
  try {
    return localStorage.getItem('nx036-currency') || 'USD'
  } catch {
    return 'USD'
  }
}

function readLocale(): string {
  try {
    const stored = localStorage.getItem('nx036-locale')
    if (stored) return stored
    const browser = navigator.language?.split('-')[0]
    if (browser && ['en', 'es', 'pt', 'zh'].includes(browser)) return browser
    return 'en'
  } catch {
    return 'en'
  }
}

export const api = axios.create({
  baseURL: API_BASE + '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((cfg) => {
  // Auth por token: adjuntamos el access token SOLO si el destino es el backend.
  // Una URL absoluta en cfg.url anularía la baseURL; sin este guard, un futuro
  // api.get('https://tercero/…') filtraría el Bearer a un tercero.
  const url = cfg.url ?? ''
  const isAbsolute = /^https?:\/\//i.test(url)
  const sameApi = !isAbsolute || (!!API_BASE && url.startsWith(API_BASE))
  const token = authToken.access
  if (token && sameApi) cfg.headers.set('Authorization', `Bearer ${token}`)
  // Multi-currency + multi-language
  cfg.headers.set('X-Currency', readCurrency())
  cfg.headers.set('Accept-Language', readLocale())
  return cfg
})

// --- Refresh de token automático (single-flight) -----------------------------------
let refreshing: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const rt = authToken.refresh
  if (!rt) return null
  try {
    // axios "crudo" para no recursar por el interceptor.
    const { data } = await axios.post(
      `${API_BASE}/api/auth/refresh`,
      { refreshToken: rt },
      { headers: { 'Content-Type': 'application/json' } },
    )
    authToken.set(data.token, data.refreshToken)
    return data.token as string
  } catch {
    authToken.clear()
    return null
  }
}

function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

api.interceptors.response.use(
  (r) => {
    // En el despliegue remoto, si el backend no está accesible el proxy/host puede responder
    // con HTML (index.html del SPA o página de error). Sin esto, un componente que espera JSON
    // recibiría un string HTML (truthy) y reventaría al hacer `data.campo` → ErrorBoundary global.
    // Lo tratamos como error para que TanStack Query degrade a vacío y los guards pinten vacío.
    const looksHtml = typeof r.data === 'string' && /^\s*<(?:!doctype|html)\b/i.test(r.data)
    if (looksHtml) {
      return Promise.reject(new Error('API no disponible (respuesta no-JSON)'))
    }
    return r
  },
  async (err: AxiosError) => {
    const cfg = err.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const status = err.response?.status
    const url = cfg?.url ?? ''
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh')

    // Access token expirado: intentamos renovar UNA vez con el refresh token y reintentamos.
    if (status === 401 && cfg && !cfg._retried && !isAuthCall) {
      const newToken = await refreshOnce()
      if (newToken) {
        cfg._retried = true
        cfg.headers.set('Authorization', `Bearer ${newToken}`)
        return api(cfg)
      }
      // No se pudo renovar: sesión caída. Limpiamos y mandamos a login (salvo el probe /me).
      authToken.clear()
      if (!url.endsWith('/me') && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)
