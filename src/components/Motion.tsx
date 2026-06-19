import { ReactNode, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

// DROP-318/319: motion tokens consumidos por framer-motion.
export const ease = [0.2, 0, 0, 1] as const
export const easeStandard = [0.4, 0, 0.2, 1] as const

// Duraciones unificadas (en segundos) — el usuario pidió ~1s en toda la app. Las animaciones de
// CONTENIDO (reveal al hacer scroll, fade-in al cargar, chips de filtro) usan 1s para sentirse suaves.
// La transición ENTRE PÁGINAS se mantiene algo más ágil (0.6s) para que navegar no se sienta lento.
export const DUR_CONTENT = 1.0
export const DUR_PAGE = 0.6

/** DROP-328: transición de página suave entre rutas. */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const reduce = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -4 }}
        transition={{ duration: DUR_PAGE, ease }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** DROP-336: reveal on scroll. Usa IntersectionObserver via framer-motion. */
export function Reveal({ children, delay = 0, y = 12 }: { children: ReactNode; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const reduce = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: DUR_CONTENT, ease, delay }}
    >
      {children}
    </motion.div>
  )
}

/** DROP-338: contador numérico animado. */
export function AnimatedCounter({ value, duration = 900, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [n, setN] = useState(value)
  const reduce = useReducedMotion()
  const fromRef = useRef(value)
  useEffect(() => {
    if (reduce) { setN(value); return }
    const from = fromRef.current
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(from + (value - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, reduce])
  const out = format ? format(n) : Math.round(n).toLocaleString()
  return <span>{out}</span>
}

/** DROP-329: fade-in al cargar contenido (cuando `loading` pasa a false). */
export function ContentFade({ show, children }: { show: boolean; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR_CONTENT, ease: easeStandard }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** DROP-340: animar chips de filtros activos entrando/saliendo. */
export function FilterChip({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      layout
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.92 }}
      transition={{ duration: DUR_CONTENT, ease }}
      className="badge badge-primary badge-outline gap-1 cursor-default"
    >
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="opacity-70 hover:opacity-100" aria-label="remove filter">×</button>
      )}
    </motion.span>
  )
}

/** DROP-337: sticky header con shadow on scroll — marca data-scrolled en window scroll. */
export function useScrollShadow(threshold = 4) {
  useEffect(() => {
    const navs = document.querySelectorAll('header.navbar')
    const onScroll = () => {
      const y = window.scrollY
      navs.forEach((n) => n.setAttribute('data-scrolled', y > threshold ? 'true' : 'false'))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
}
