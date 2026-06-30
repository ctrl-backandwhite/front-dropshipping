// Nombre completo del país a partir del código ISO ("ES" → "España"), en el idioma activo.
// Usa Intl.DisplayNames (soporta los 8 idiomas y cualquier país); si falla, devuelve el código.
export function countryName(code?: string | null, locale = 'es'): string {
  if (!code) return ''
  const iso = code.trim().toUpperCase()
  // Si ya parece un nombre (más de 2 letras o con espacios), lo dejamos tal cual.
  if (iso.length !== 2) return code
  try {
    const dn = new Intl.DisplayNames([locale], { type: 'region' })
    return dn.of(iso) || code
  } catch {
    return code
  }
}

// Localiza una ubicación de tracking: códigos ISO de país → nombre completo.
// "ES" → "España"; "Shenzhen, CN" → "Shenzhen, China"; el resto se deja igual.
export function locationName(loc?: string | null, locale = 'es'): string {
  if (!loc) return ''
  const s = loc.trim()
  if (/^[A-Za-z]{2}$/.test(s)) return countryName(s, locale)
  const m = s.match(/^(.*),\s*([A-Za-z]{2})$/)
  if (m) return `${m[1].trim()}, ${countryName(m[2], locale)}`
  return loc
}
