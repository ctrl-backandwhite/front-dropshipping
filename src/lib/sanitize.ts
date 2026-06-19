import DOMPurify from 'dompurify'

/**
 * Sanitiza HTML antes de inyectarlo con dangerouslySetInnerHTML. La descripción de los productos
 * proviene de datos ingestados de proveedores externos (1688), por lo que NO es de confianza: sin
 * sanear, un proveedor podría inyectar <script>/eventos y provocar XSS almacenado. DOMPurify deja
 * solo HTML seguro (texto con formato) y elimina scripts, iframes y handlers de eventos.
 */
export function sanitizeHtml(html?: string | null): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}
