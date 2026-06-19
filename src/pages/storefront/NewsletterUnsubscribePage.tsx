import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { newsletter } from '../../api/affiliate'
import { useT } from '../../store/locale'

export default function NewsletterUnsubscribePage() {
  const t = useT()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setState('error'); return }
    newsletter.unsubscribe(token)
      .then((r: any) => setState(r?.unsubscribed ? 'ok' : 'error'))
      .catch(() => setState('error'))
  }, [token])

  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      {state === 'loading' && <div className="loading loading-spinner loading-lg text-brand-600" />}
      {state === 'ok' && (
        <>
          <FontAwesomeIcon icon={faCircleCheck} className="text-4xl text-emerald-500" />
          <h1 className="text-xl font-medium">{t('newsletter.unsub.ok_title')}</h1>
          <p className="text-sm text-ink-500">{t('newsletter.unsub.ok_body')}</p>
        </>
      )}
      {state === 'error' && (
        <>
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-4xl text-amber-500" />
          <h1 className="text-xl font-medium">{t('newsletter.unsub.err_title')}</h1>
          <p className="text-sm text-ink-500">{t('newsletter.unsub.err_body')}</p>
        </>
      )}
      <Link to="/" className="btn btn-outline btn-sm">{t('newsletter.unsub.home')}</Link>
    </div>
  )
}
