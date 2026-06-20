import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage } from '@fortawesome/free-solid-svg-icons'

interface ImageProps {
  src?: string | null
  alt: string
  className?: string
  fallbackClassName?: string
  /** Optional override of the placeholder icon. */
  icon?: any
}

/**
 * <SafeImage> — renders the image when available, swaps to a neutral
 * branded placeholder (icon, no malformed SKU text) on missing / broken src.
 * DROP-256 (UX-26): every product/image surface in the app must use this.
 */
export function SafeImage({ src, alt, className = '', fallbackClassName = '', icon = faImage }: ImageProps) {
  const [broken, setBroken] = useState(false)
  // DROP-412: detectar URLs de servicios placeholder (devuelven imagen con texto "800 × 800")
  // y tratarlas como rotas para mostrar el icono neutro pastel.
  const isPlaceholderService = !!src && /via\.placeholder|placehold\.co|placeimg|dummyimage|placekitten|loremflickr|fakeimg|picsum/i.test(src)
  if (!src || broken || isPlaceholderService) {
    return (
      <div className={`flex items-center justify-center bg-ink-50 text-ink-300 ${fallbackClassName || className}`}
           role="img" aria-label={alt}>
        <FontAwesomeIcon icon={icon} className="text-2xl" />
      </div>
    )
  }
  return (
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className={className} onError={() => setBroken(true)} />
  )
}

/** Generic skeleton block — uses the `.skeleton` utility from index.css. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/** Card-shaped skeleton for product/listing grids. */
export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  )
}

/** Reusable row skeleton for admin tables. */
export function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="border-t border-ink-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-2"><Skeleton className="h-3" /></td>
      ))}
    </tr>
  )
}
