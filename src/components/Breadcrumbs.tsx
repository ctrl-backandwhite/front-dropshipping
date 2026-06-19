import { Link, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faHouse } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  /** Explicit items override the automatic derivation. */
  items?: BreadcrumbItem[]
  /** Hide the leading home link. */
  hideHome?: boolean
}

/**
 * Renders a breadcrumb trail. When `items` is omitted, derives one from the
 * current pathname by mapping each segment to a friendly label via i18n keys
 * (`breadcrumb.<segment>`) or falling back to a Capitalized version.
 */
export function Breadcrumbs({ items, hideHome }: BreadcrumbsProps) {
  const t = useT()
  const location = useLocation()

  const trail: BreadcrumbItem[] = items ?? (() => {
    const parts = location.pathname.split('/').filter(Boolean)
    let acc = ''
    return parts.map((seg) => {
      acc += '/' + seg
      const key = `breadcrumb.${seg}`
      const translated = t(key)
      const label = translated !== key ? translated : pretty(decodeURIComponent(seg))
      return { to: acc, label }
    })
  })()

  if (trail.length === 0 && hideHome) return null

  return (
    <nav aria-label="Breadcrumb" className="text-[12px] text-ink-500 flex items-center gap-1.5 mb-3 flex-wrap">
      {!hideHome && (
        <>
          <Link to="/" className="hover:text-brand-700 inline-flex items-center gap-1">
            <FontAwesomeIcon icon={faHouse} className="text-[11px]" />
            <span>{t('breadcrumb.home')}</span>
          </Link>
          {trail.length > 0 && <FontAwesomeIcon icon={faChevronRight} className="text-[9px] text-ink-300" />}
        </>
      )}
      {trail.map((item, i) => {
        const last = i === trail.length - 1
        return (
          <span key={i} className="inline-flex items-center gap-1.5">
            {last || !item.to
              ? <span className={last ? 'text-ink-700 font-medium' : ''}>{item.label}</span>
              : <Link to={item.to} className="hover:text-brand-700">{item.label}</Link>}
            {!last && <FontAwesomeIcon icon={faChevronRight} className="text-[9px] text-ink-300" />}
          </span>
        )
      })}
    </nav>
  )
}

function pretty(seg: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg)) return '…'
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
