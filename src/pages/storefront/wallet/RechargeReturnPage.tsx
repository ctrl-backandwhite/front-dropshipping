import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faTriangleExclamation, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { wallet } from '../../../api/wallet'
import { useT } from '../../../store/locale'

/**
 * Retorno de la recarga de wallet para pagos por pasarela (Stripe Checkout Session / PayPal). La pasarela
 * redirige aquí con paymentId; confirmamos del lado servidor (Stripe: retrieve session · PayPal: capture),
 * lo que ACREDITA el saldo, y llevamos a la wallet. No dependemos del webhook en local/sandbox.
 */
export default function RechargeReturnPage() {
  const t = useT()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
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
      setError(t('recharge.return.cancelled'))
      return
    }
    if (!paymentId) {
      setState('error')
      setError(t('recharge.return.missing'))
      return
    }
    wallet.confirmRecharge(paymentId)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['wallet'] })
        qc.invalidateQueries({ queryKey: ['wallet-tx'] })
        setState('ok')
        setTimeout(() => navigate('/wallet?recharged=1'), 1200)
      })
      .catch((e) => {
        setState('error')
        setError(e?.response?.data?.message ?? e?.message ?? t('recharge.return.err'))
      })
  }, [paymentId, cancelled, navigate, qc, t])

  return (
    <div className="max-w-md mx-auto card p-8 text-center">
      {state === 'loading' && (
        <>
          <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-primary mb-3" />
          <h1>{t('recharge.return.confirming')}</h1>
          <p className="text-sm text-ink-500 mt-2">{t('recharge.return.dont_close')}</p>
        </>
      )}
      {state === 'ok' && (
        <>
          <FontAwesomeIcon icon={faCircleCheck} className="text-3xl text-emerald-500 mb-3" />
          <h1>{t('recharge.return.ok')}</h1>
          <p className="text-sm text-ink-500 mt-2">{t('recharge.return.redirecting')}</p>
        </>
      )}
      {state === 'error' && (
        <>
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl text-amber-500 mb-3" />
          <h1>{t('recharge.return.err')}</h1>
          <p className="text-sm text-ink-500 mt-2">{error}</p>
          <div className="mt-5 flex gap-2 justify-center">
            <Link to="/wallet/recharge" className="btn btn-primary text-sm">{t('common.retry')}</Link>
            <Link to="/wallet" className="btn btn-ghost text-sm">{t('recharge.return.see_wallet')}</Link>
          </div>
        </>
      )}
    </div>
  )
}
