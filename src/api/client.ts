import axios from 'axios'

const xsrfCookie = () => {
  const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

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
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((cfg) => {
  const method = (cfg.method ?? 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = xsrfCookie()
    if (token) cfg.headers.set('X-XSRF-TOKEN', token)
  }
  // Multi-currency + multi-language
  cfg.headers.set('X-Currency', readCurrency())
  cfg.headers.set('Accept-Language', readLocale())
  return cfg
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      // Don't redirect for /api/me probes
      const url: string = err?.config?.url ?? ''
      if (!url.endsWith('/me')) window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)
