/**
 * Almacén del par de tokens Bearer (access + refresh) en localStorage.
 *
 * Auth por token para despliegue cross-origin (SPA estático + API en otro dominio):
 * el SPA guarda los tokens aquí, el interceptor de axios manda `Authorization: Bearer`
 * y renueva con el refresh cuando el access expira. Sin cookies → sin CSRF ni problemas
 * de cookies de terceros.
 */
const ACCESS_KEY = 'nx-access-token'
const REFRESH_KEY = 'nx-refresh-token'

export const authToken = {
  get access(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY)
    } catch {
      return null
    }
  },
  get refresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  set(access: string, refresh?: string | null) {
    try {
      localStorage.setItem(ACCESS_KEY, access)
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
    } catch {
      /* localStorage no disponible (modo privado): el token vive solo en memoria de la sesión */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      /* noop */
    }
  },
}
