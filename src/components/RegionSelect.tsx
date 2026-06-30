import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orders } from '../api/orders'

/**
 * Selector de estado/provincia por país. Si el país tiene regiones sembradas (US/CA/BR y los que se
 * añadan), muestra un DROPDOWN con ellas (el value es el código de región, p. ej. "CA", "ON", "SP",
 * que el backend usa para el IVA por estado). Si el país no tiene regiones, cae a un input de texto
 * libre (compatibilidad con países aún sin sembrar). Mismo control en /addresses y en el checkout.
 */
export function RegionSelect({ country, value, onChange, selectClassName, inputClassName, placeholder }: {
  country?: string
  value: string
  onChange: (v: string) => void
  selectClassName?: string
  inputClassName?: string
  placeholder: string
}) {
  const { data: regions = [] } = useQuery({
    queryKey: ['regions', country],
    queryFn: () => orders.regions(country!),
    enabled: !!country,
    staleTime: 60 * 60_000,
  })

  // Si cambia el país a uno CON regiones y el valor actual no es un código válido, lo limpiamos para
  // forzar una selección coherente (evita arrastrar texto libre de otro país como si fuera código).
  useEffect(() => {
    if (regions.length > 0 && value && !regions.some((r) => r.code === value)) {
      onChange('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, regions.length])

  if (regions.length > 0) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClassName}>
        <option value="">{placeholder}</option>
        {regions.map((r) => (
          <option key={r.code} value={r.code}>{r.name}</option>
        ))}
      </select>
    )
  }
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClassName} />
  )
}
