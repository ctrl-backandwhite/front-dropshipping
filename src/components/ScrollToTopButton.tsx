import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'

/**
 * Botón flotante "volver arriba". Aparece tras desplazarse hacia abajo (útil con el scroll infinito del
 * catálogo, donde volver al principio a mano es tedioso). Hace scroll suave al inicio de la página.
 */
export function ScrollToTopButton({ threshold = 600 }: { threshold?: number }) {
  const t = useT()
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > threshold)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  if (!show) return null
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('catalog.back_to_top')}
      title={t('catalog.back_to_top')}
      className="fixed bottom-6 right-6 z-40 btn btn-primary btn-circle shadow-pastel-lg">
      <FontAwesomeIcon icon={faArrowUp} />
    </button>
  )
}
