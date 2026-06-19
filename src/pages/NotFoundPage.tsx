import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faHouse, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'

export default function NotFoundPage() {
  const t = useT()
  const navigate = useNavigate()
  return (
    <ErrorPageShell
      code="404"
      title={t('errors.404.title')}
      body={t('errors.404.body')}
    >
      <button onClick={() => navigate(-1)} className="btn btn-outline">
        <FontAwesomeIcon icon={faArrowLeft} /> {t('errors.back')}
      </button>
      <Link to="/" className="btn btn-primary">
        <FontAwesomeIcon icon={faHouse} /> {t('errors.home')}
      </Link>
      <Link to="/catalog" className="btn btn-outline">
        <FontAwesomeIcon icon={faMagnifyingGlass} /> {t('errors.browse_catalog')}
      </Link>
    </ErrorPageShell>
  )
}

export function ServerErrorPage({ onRetry }: { onRetry?: () => void }) {
  const t = useT()
  return (
    <ErrorPageShell
      code="500"
      title={t('errors.500.title')}
      body={t('errors.500.body')}
    >
      {onRetry && (
        <button onClick={onRetry} className="btn btn-primary">{t('errors.retry')}</button>
      )}
      <Link to="/" className="btn btn-outline">
        <FontAwesomeIcon icon={faHouse} /> {t('errors.home')}
      </Link>
    </ErrorPageShell>
  )
}

function ErrorPageShell({ code, title, body, children }: { code: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <div className="text-[120px] leading-none font-bold text-brand-600 tracking-tighter">{code}</div>
        <h1 className="mt-4 text-2xl font-medium">{title}</h1>
        <p className="mt-3 text-ink-600">{body}</p>
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {children}
        </div>
      </div>
    </div>
  )
}
