import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faTriangleExclamation, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { api } from '../../../api/client'
import { useT } from '../../../store/locale'

/**
 * Retorno unificado del checkout para pagos por proveedor externo (Stripe Checkout
 * Session / PayPal). El proveedor redirige aquí con orderId + paymentId; confirmamos
 * del lado servidor (Stripe: retrieve session · PayPal: capture) y llevamos al detalle
 * de la orden ya pagada. No dependemos del webhook en local/sandbox.
 */
export default function CheckoutReturnPage() {
  const t = useT()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const provider = params.get('provider') || ''
  const orderId = params.get('orderId') || ''
  const paymentId = params.get('paymentId') || ''
  const cancelled = params.get('cancelled') === '1'
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (cancelled) {
      setState('error')
      setError(t('checkout.return.cancelled'))
      return
    }
    if (!orderId || !paymentId) {
      setState('error')
      setError(t('checkout.return.missing'))
      return
    }
    api.post(`/me/orders/${orderId}/payments/${paymentId}/confirm`)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['orders'] })
        qc.invalidateQueries({ queryKey: ['wallet'] })
        setState('ok')
        setTimeout(() => navigate(`/orders/${orderId}?placed=1&paid=1`), 1200)
      })
      .catch((e) => {
        setState('error')
        setError(e?.response?.data?.message ?? e?.message ?? t('checkout.return.err'))
      })
  }, [orderId, paymentId, cancelled, navigate, qc, t])

  return (
    <div className="max-w-md mx-auto card p-8 text-center">
      {state === 'loading' && (
        <>
          <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-primary mb-3" />
          <h1>{t('checkout.return.confirming')}</h1>
          <p className="text-sm text-ink-500 mt-2">
            {provider === 'paypal' ? t('checkout.return.paypal') : t('checkout.return.stripe')}
            {' · '}{t('checkout.return.dont_close')}
          </p>
        </>
      )}
      {state === 'ok' && (
        <>
          <FontAwesomeIcon icon={faCircleCheck} className="text-3xl text-emerald-500 mb-3" />
          <h1>{t('checkout.return.ok')}</h1>
          <p className="text-sm text-ink-500 mt-2">{t('checkout.return.redirecting')}</p>
        </>
      )}
      {state === 'error' && (
        <>
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl text-amber-500 mb-3" />
          <h1>{t('checkout.return.err')}</h1>
          <p className="text-sm text-ink-500 mt-2">{error}</p>
          <div className="mt-5 flex gap-2 justify-center">
            <Link to="/checkout" className="btn btn-primary text-sm">{t('common.retry')}</Link>
            {orderId && <Link to={`/orders/${orderId}`} className="btn btn-ghost text-sm">{t('checkout.return.see_order')}</Link>}
          </div>
        </>
      )}
    </div>
  )
}
