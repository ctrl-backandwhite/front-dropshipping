import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNodes, faCircleCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { useAuthStore } from '../../store/auth'

export default function ActivatePage() {
  const [params] = useSearchParams()
  const codeFromUrl = params.get('code') ?? ''
  const [code, setCode] = useState(codeFromUrl)
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const activate = useAuthStore((s) => s.activate)
  const navigate = useNavigate()

  async function go(c: string) {
    if (!c) return
    setState('loading')
    setMessage(null)
    try {
      await activate(c)
      setState('ok')
      setMessage('Cuenta activada. Redirigiendo al login…')
      setTimeout(() => navigate('/login'), 1800)
    } catch (err: any) {
      setState('err')
      setMessage(err?.response?.data?.message || 'Código inválido o expirado.')
    }
  }

  useEffect(() => {
    if (codeFromUrl) go(codeFromUrl)
  }, [codeFromUrl])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-brand-50 via-white to-slate-50">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 text-slate-800 font-bold text-lg">
          <FontAwesomeIcon icon={faCircleNodes} className="text-brand-600" />
          NX036 Dropshipping
        </Link>
        <div className="card p-8">
          <h1 className="text-2xl font-semibold text-slate-900">Activa tu cuenta</h1>
          <p className="text-sm text-slate-500 mt-1">Pega el código que llegó a tu email.</p>

          {message && state === 'ok' && (
            <div className="mt-5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
              <FontAwesomeIcon icon={faCircleCheck} /> {message}
            </div>
          )}
          {message && state === 'err' && (
            <div className="mt-5 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              <FontAwesomeIcon icon={faTriangleExclamation} /> {message}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); go(code) }}
            className="mt-5 space-y-4">
            <input
              className="input font-mono tracking-wider"
              placeholder="Código de activación"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" disabled={state === 'loading'} className="btn btn-primary w-full">
              {state === 'loading' ? 'Activando…' : 'Activar cuenta'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-500">
            <Link to="/login" className="text-brand-600 hover:underline font-medium">Volver al login</Link>
            <span className="opacity-40">·</span>
            <Link to="/" className="text-brand-600 hover:underline font-medium">Volver a la tienda</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
