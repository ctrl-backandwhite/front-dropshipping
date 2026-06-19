/**
 * DROP-637: efecto visual "volar al carrito". Clona la imagen del producto y la anima en vuelo
 * (curva + encogido) desde el origen (botón/imagen pulsada) hasta el icono del carrito de la barra,
 * luego hace un "bump" del icono. Es DOM puro (sin estado React) para ser fiable y no re-renderizar.
 *
 * Destino: el elemento con id `nx-cart-icon` (lo marca StorefrontLayout).
 */
export function flyToCart(source: HTMLElement | DOMRect | null | undefined, imageUrl?: string): void {
  if (typeof document === 'undefined' || !source) return
  // Respeta usuarios con "reduce motion": solo hace el bump del icono, sin vuelo.
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const cart = document.getElementById('nx-cart-icon')
  if (!cart) return
  const from = source instanceof HTMLElement ? source.getBoundingClientRect() : source

  const bump = () => {
    cart.classList.remove('cart-bump')
    void cart.offsetWidth // reinicia la animación
    cart.classList.add('cart-bump')
  }

  if (reduce) { bump(); return }

  const to = cart.getBoundingClientRect()
  const size = 60
  const startX = from.left + from.width / 2 - size / 2
  const startY = from.top + from.height / 2 - size / 2
  const dx = to.left + to.width / 2 - (startX + size / 2)
  const dy = to.top + to.height / 2 - (startY + size / 2)

  const fly = document.createElement('div')
  fly.style.cssText = [
    'position:fixed',
    `left:${startX}px`,
    `top:${startY}px`,
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:14px',
    'z-index:9999',
    'pointer-events:none',
    'background-size:cover',
    'background-position:center',
    'box-shadow:0 10px 28px rgba(0,0,0,0.28)',
    'transform:translate(0,0) scale(1)',
    'opacity:1',
    'transition:transform .8s cubic-bezier(.2,.7,.3,1), opacity .8s ease-in',
  ].join(';')
  if (imageUrl) fly.style.backgroundImage = `url("${imageUrl}")`
  else fly.style.background = 'var(--fallback-p, #7c6cd0)'
  document.body.appendChild(fly)

  // doble rAF para asegurar que el navegador toma el estado inicial antes de transicionar
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.12)`
    fly.style.opacity = '0.35'
  }))

  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    fly.remove()
    bump()
  }
  fly.addEventListener('transitionend', cleanup, { once: true })
  window.setTimeout(cleanup, 1000) // fallback por si no dispara transitionend
}
