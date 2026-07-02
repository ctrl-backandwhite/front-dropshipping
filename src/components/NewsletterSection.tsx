import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperPlane, faCircleCheck, faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'
import { newsletter } from '../api/affiliate'

/**
 * Sección de suscripción al newsletter para la HOME. Antes solo estaba en el pie; con el scroll infinito
 * del catálogo era casi imposible llegar a él. Reutiliza la misma API e i18n del pie.
 */
export function NewsletterSection() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [already, setAlready] = useState(false)
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    newsletter.subscribe(email.trim())
      .then((r) => { setAlready(!!r?.alreadySubscribed); setDone(true); setEmail('') })
      .catch(() => setDone(true))
  }
  return (
    <section className="card p-8 lg:p-10 text-center bg-brand-50/60 border-brand-100">
      <div className="max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-3">
          <FontAwesomeIcon icon={faEnvelopeOpenText} className="text-lg" />
        </div>
        <h2 className="text-xl md:text-2xl font-medium tracking-tight">{t('newsletter.footer.title')}</h2>
        <p className="mt-2 text-ink-600">{t('newsletter.footer.pitch')}</p>
        {done ? (
          <p className={`mt-4 flex items-center justify-center gap-2 ${already ? 'text-ink-500' : 'text-success'}`}>
            <FontAwesomeIcon icon={faCircleCheck} /> {t(already ? 'newsletter.footer.already' : 'newsletter.footer.done')}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder={t('newsletter.footer.placeholder')} className="input input-bordered flex-1" />
            <button type="submit" className="btn btn-primary">
              <FontAwesomeIcon icon={faPaperPlane} /> {t('newsletter.footer.subscribe')}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
