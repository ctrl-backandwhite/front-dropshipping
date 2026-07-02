import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNodes, faPaperPlane, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { faGithub, faXTwitter, faLinkedin, faDiscord } from '@fortawesome/free-brands-svg-icons'
import { useT } from '../store/locale'
import { newsletter } from '../api/affiliate'

function NewsletterSignup() {
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
    <nav className="max-w-xs">
      <h6 className="footer-title text-[11px]">{t('newsletter.footer.title')}</h6>
      <p className="text-[12px] opacity-70 mb-2">{t('newsletter.footer.pitch')}</p>
      {done ? (
        <p className={`text-[13px] flex items-center gap-1 ${already ? 'opacity-70' : 'text-success'}`}><FontAwesomeIcon icon={faCircleCheck} /> {t(already ? 'newsletter.footer.already' : 'newsletter.footer.done')}</p>
      ) : (
        <form onSubmit={submit} className="join">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder={t('newsletter.footer.placeholder')} className="input input-bordered input-sm join-item text-[13px]" />
          <button type="submit" className="btn btn-primary btn-sm join-item" aria-label={t('newsletter.footer.subscribe')}>
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </form>
      )}
    </nav>
  )
}

interface FooterCol {
  titleKey: string
  links: { labelKey: string; to: string; external?: boolean }[]
}

const COLS: FooterCol[] = [
  {
    titleKey: 'footer.col.platform',
    links: [
      { labelKey: 'footer.link.catalog', to: '/catalog' },
      { labelKey: 'footer.link.pricing', to: '/pricing' },
    ],
  },
  {
    titleKey: 'footer.col.developers',
    links: [
      { labelKey: 'footer.link.docs',      to: '/developers' },
      { labelKey: 'footer.link.connect',   to: '/connect' },
      { labelKey: 'footer.link.changelog', to: '/developers#changelog' },
      { labelKey: 'footer.link.status',    to: 'https://status.nx036.local', external: true },
    ],
  },
  {
    titleKey: 'footer.col.company',
    links: [
      { labelKey: 'footer.link.about',   to: '/about' },
      { labelKey: 'footer.link.privacy', to: '/legal/privacy' },
      { labelKey: 'footer.link.terms',   to: '/legal/terms' },
      { labelKey: 'footer.link.contact', to: '/contact' },
    ],
  },
]

const SOCIAL: { icon: any; label: string; href: string }[] = [
  { icon: faGithub,   label: 'GitHub',   href: 'https://github.com/nx036' },
  { icon: faXTwitter, label: 'X',        href: 'https://x.com/nx036' },
  { icon: faLinkedin, label: 'LinkedIn', href: 'https://linkedin.com/company/nx036' },
  { icon: faDiscord,  label: 'Discord',  href: 'https://discord.gg/nx036' },
]

export function SiteFooter() {
  const t = useT()
  return (
    <>
      <footer className="footer sm:footer-horizontal bg-base-200 text-base-content/80 border-t border-base-300 px-4 lg:px-10 py-10 mt-12">
        <aside className="max-w-xs">
          <Link to="/" className="inline-flex items-center gap-2 font-medium text-[15px]">
            <FontAwesomeIcon icon={faCircleNodes} className="text-primary" />
            NX036 Dropshipping
          </Link>
          <p className="text-[12px] opacity-70 mt-2 leading-relaxed">
            {t('footer.pitch')}
          </p>
        </aside>
        {COLS.map((col) => (
          <nav key={col.titleKey}>
            <h6 className="footer-title text-[11px]">{t(col.titleKey)}</h6>
            {col.links.map((l) => (
              l.external
                ? <a key={l.labelKey} href={l.to} target="_blank" rel="noreferrer" className="link link-hover text-[13px]">{t(l.labelKey)}</a>
                : <Link key={l.labelKey} to={l.to} className="link link-hover text-[13px]">{t(l.labelKey)}</Link>
            ))}
          </nav>
        ))}
        <NewsletterSignup />
      </footer>
      <footer className="footer footer-center bg-base-100 text-base-content/70 border-t border-base-200 px-4 py-4 text-[12px]">
        <aside>
          <p className="flex flex-wrap items-center justify-center gap-3">
            <span>© 2026 NX036 Dropshipping. {t('footer.tagline')}</span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-3">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                   aria-label={s.label} title={s.label}
                   className="hover:text-primary">
                  <FontAwesomeIcon icon={s.icon} />
                </a>
              ))}
            </span>
            <span className="opacity-40">·</span>
            <span>v0.1.0</span>
          </p>
        </aside>
      </footer>
    </>
  )
}
