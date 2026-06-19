import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { wallet } from '../../../api/wallet'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faTriangleExclamation, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../../store/locale'

export default function PaypalReturnPage() {
  const t = useT()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const paymentId = params.get('paymentId') || params.get('token') || ''
  const cancelled = params.get('cancelled') === '1'
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cancelled) {
      setState('error')
      setError(t('paypal.return.cancelled'))
      return
    }
    if (!paymentId) {
      setState('error')
      setError(t('paypal.return.missing_id'))
      return
    }
    wallet.paypalCapture(paymentId)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['wallet'] })
        qc.invalidateQueries({ queryKey: ['wallet-tx'] })
        setState('ok')
        setTimeout(() => navigate('/wallet?recharged=1'), 1500)
      })
      .catch((e) => {
        setState('error')
        setError(e?.response?.data?.message ?? e?.message ?? t('paypal.return.err'))
      })
  }, [paymentId, cancelled, navigate, qc, t])

  return (
    <div className="max-w-md mx-auto card p-8 text-center">
      {state === 'loading' && (
        <>
          <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-brand-600 mb-3" />
          <h1>{t('paypal.return.capturing')}</h1>
          <p className="text-sm text-ink-500 mt-2">{t('paypal.return.dont_close')}</p>
        </>
      )}
      {state === 'ok' && (
        <>
          <FontAwesomeIcon icon={faCircleCheck} className="text-3xl text-emerald-500 mb-3" />
          <h1>{t('paypal.return.ok')}</h1>
          <p className="text-sm text-ink-500 mt-2">{t('paypal.return.redirecting')}</p>
        </>
      )}
      {state === 'error' && (
        <>
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl text-amber-500 mb-3" />
          <h1>{t('paypal.return.err')}</h1>
          <p className="text-sm text-ink-500 mt-2">{error}</p>
          <div className="mt-5 flex gap-2 justify-center">
            <Link to="/wallet/recharge" className="btn btn-primary text-sm">{t('common.retry')}</Link>
            <Link to="/wallet" className="btn btn-ghost text-sm">{t('recharge.back_to_wallet')}</Link>
          </div>
        </>
      )}
    </div>
  )
}
