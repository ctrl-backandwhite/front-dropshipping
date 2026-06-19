import { useQuery } from '@tanstack/react-query'
import { orders } from '../api/orders'
import { useCurrencyStore } from '../store/currency'
import { CartLine, lineUnitPrice } from '../store/cart'

/**
 * DROP-637: re-cotiza el carrito con el precio ACTUAL del backend (margen + tasa del día), que es
 * EXACTAMENTE lo que se factura y se cobra. El carrito CONGELA el precio de display al añadir el
 * producto; sin re-cotizar, el drawer/carrito mostraban el precio viejo (p.ej. 3,08 €) mientras el
 * checkout cobraba el actual (6,18 €). Este hook centraliza la cotización para que el drawer, la
 * página del carrito y el checkout muestren SIEMPRE el mismo precio en la moneda activa (X-Currency).
 * El precio congelado solo se usa como fallback mientras la cotización está cargando.
 */
export function useCartQuote(lines: CartLine[]) {
  const activeCurrency = useCurrencyStore((s) => s.current)
  const convert = useCurrencyStore((s) => s.convert)
  const format = useCurrencyStore((s) => s.format)

  const { data: quote, isLoading } = useQuery({
    queryKey: ['cart-quote', activeCurrency, lines.map((l) => `${l.productId}:${l.variantId ?? ''}:${l.quantity}`).join(',')],
    queryFn: () => orders.cartQuote(lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }))),
    enabled: lines.length > 0,
  })

  const lineOf = (l: CartLine) =>
    quote?.items.find(
      (it) => it.productId === l.productId && (it.variantId ?? undefined) === (l.variantId ?? undefined),
    )

  // Precio unitario en la moneda activa: cotización en vivo si está; si no, el congelado convertido.
  const unitActive = (l: CartLine): number => {
    const q = lineOf(l)?.unit
    if (q != null) return q
    const frozen = lineUnitPrice(l)
    return convert(frozen.amount, frozen.currency)
  }

  // Strings YA formateados por el backend (el front solo pinta). Fallback al formateo cliente del
  // precio congelado SOLO mientras la cotización carga (transitorio).
  const unitText = (l: CartLine): string => lineOf(l)?.unitFormatted ?? format(unitActive(l), activeCurrency)
  const lineTotalText = (l: CartLine): string =>
    lineOf(l)?.lineTotalFormatted ?? format(unitActive(l) * l.quantity, activeCurrency)

  // Subtotal autoritativo = el del backend (precio actual). Fallback al congelado solo mientras carga.
  const subtotalActive = quote
    ? quote.subtotal
    : lines.reduce((sum, l) => sum + convert(lineUnitPrice(l).amount * l.quantity, lineUnitPrice(l).currency), 0)
  const subtotalText = quote?.subtotalFormatted ?? format(subtotalActive, activeCurrency)

  return { quote, isLoading, unitActive, unitText, lineTotalText, subtotalActive, subtotalText, activeCurrency }
}
