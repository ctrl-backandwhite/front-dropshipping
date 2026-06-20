import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authToken } from '../../lib/authToken'
import { useAuthStore } from '../../store/auth'

/**
 * Destino del login con Google bajo auth por token. El backend redirige aquí con los
 * tokens en el fragmento de la URL: `/auth/callback#token=…&refresh=…` (el fragmento no
 * viaja al servidor). Guardamos el par, cargamos el perfil y redirigimos según el rol.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(hash)
    const token = params.get('token')
    const refresh = params.get('refresh')

    // Limpia el fragmento de la barra de direcciones (no dejar tokens a la vista/historial).
    window.history.replaceState(null, '', '/auth/callback')

    // Solo guardamos algo con forma de JWT (header.payload.firma). Evita que alguien
    // siembre un valor arbitrario vía `/auth/callback#token=…` (session-fixation/basura).
    const looksJwt = (t: string | null): t is string => !!t && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(t)
    if (!looksJwt(token)) {
      navigate('/login?error=google', { replace: true })
      return
    }

    authToken.set(token, looksJwt(refresh) ? refresh : undefined)
    fetchMe().finally(() => {
      const role = useAuthStore.getState().user?.role
      const dest = role === 'ADMIN' || role === 'OPERATOR' ? '/admin' : '/'
      navigate(dest, { replace: true })
    })
  }, [fetchMe, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-ink-50">
      <span className="loading loading-spinner loading-lg text-primary" />
      <p className="text-ink-500 text-sm">Completando inicio de sesión…</p>
    </div>
  )
}
