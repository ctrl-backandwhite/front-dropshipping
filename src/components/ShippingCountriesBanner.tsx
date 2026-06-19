import { useQuery } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEarthAmericas, faTruckFast } from '@fortawesome/free-solid-svg-icons'
import { orders, ShippingCountry } from '../api/orders'
import { useT } from '../store/locale'

/** Convierte un código ISO-3166-1 alfa-2 (p.ej. "ES") en su emoji de bandera (🇪🇸). */
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🏳️'
  const base = 0x1f1e6
  const cc = code.toUpperCase()
  return String.fromCodePoint(base + (cc.charCodeAt(0) - 65)) + String.fromCodePoint(base + (cc.charCodeAt(1) - 65))
}

/**
 * DROP-637: banner de cobertura de envío en la home (antes del footer). Muestra en un marquee infinito
 * (girando) los países a los que SÍ enviamos, cotejados en tiempo real con la cobertura real de Cainiao
 * (`GET /storefront/shipping/countries` → zonas habilitadas en BD). Si no hay datos, no se renderiza.
 */
export function ShippingCountriesBanner() {
  const t = useT()
  const { data } = useQuery({
    queryKey: ['shipping-countries'],
    queryFn: orders.shippingCountries,
    staleTime: 1000 * 60 * 60, // 1h: la cobertura cambia rara vez
  })

  const countries = data ?? []
  if (countries.length === 0) return null

  // Duplicamos la lista para que el desplazamiento sea continuo y sin saltos (loop perfecto).
  const loop: ShippingCountry[] = [...countries, ...countries]

  return (
    <section className="border-y border-base-200 bg-base-100/60 py-8 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-center gap-2 mb-5 text-center">
          <FontAwesomeIcon icon={faEarthAmericas} className="text-primary" />
          <h3 className="text-base font-medium">
            {t('home.shipping_banner.title')}
          </h3>
          <span className="badge badge-primary badge-sm">{countries.length}</span>
        </div>

        {/* Marquee: la pista se desplaza -50% (la mitad duplicada) en bucle. Pausa al pasar el ratón. */}
        <div className="group relative">
          {/* Difuminado en los bordes para que entren/salgan suavemente */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-base-100 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-base-100 to-transparent" />
          <div className="flex w-max gap-3 animate-[nx-marquee_40s_linear_infinite] group-hover:[animation-play-state:paused]">
            {loop.map((c, i) => (
              <div key={`${c.countryCode}-${i}`}
                   className="flex items-center gap-2 whitespace-nowrap rounded-full border border-base-200 bg-base-100 px-4 py-2 text-sm shadow-sm">
                <span className="text-lg leading-none">{flagEmoji(c.countryCode)}</span>
                <span className="font-medium">{c.countryName}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-ink-500 flex items-center justify-center gap-1.5">
          <FontAwesomeIcon icon={faTruckFast} className="text-primary/70" />
          {t('home.shipping_banner.subtitle')}
        </p>
      </div>
    </section>
  )
}
