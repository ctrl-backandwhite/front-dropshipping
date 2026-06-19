import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Al cambiar de ruta (pathname) vuelve SIEMPRE al inicio de la página. Sin esto, React Router
 * conserva el scroll de la pantalla anterior: al entrar a un producto desde el catálogo (que estaba
 * scrolleado) la ficha aparecía a media página, en las reseñas, en vez de arriba (imágenes, nombre,
 * descripción). Solo reacciona al `pathname` (no a query params/hash) para no saltar al filtrar ni
 * romper el scroll suave a secciones (#tab-*) dentro de la misma página.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  return null
}
