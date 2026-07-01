import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { SafeImage } from './Placeholder'

/**
 * Miniatura que al hacer click abre la imagen a tamaño grande (lightbox fullscreen). Se cierra con
 * click en el fondo, el botón de cerrar o la tecla Escape. Si no hay imagen, no es interactiva.
 */
export function ImageLightbox({ src, alt = '', className, fallbackClassName }: {
  src?: string | null
  alt?: string
  className?: string
  fallbackClassName?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" onClick={() => { if (src) setOpen(true) }}
              aria-label={alt}
              className={`block p-0 border-0 bg-transparent ${src ? 'cursor-zoom-in' : 'cursor-default'}`}>
        <SafeImage src={src ?? undefined} alt={alt} className={className} fallbackClassName={fallbackClassName} />
      </button>
      {open && src && createPortal(
        <div onClick={() => setOpen(false)}
             className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out">
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()}
               className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl cursor-default" />
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white text-xl">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>,
        document.body)}
    </>
  )
}
