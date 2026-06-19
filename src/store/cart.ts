import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartLine {
  productId: string
  variantId?: string
  /** Resolved SKU (variant SKU or product base SKU). Shown in the cart. */
  sku?: string
  slug: string
  title: string
  image?: string
  /** Optional variant label (e.g. "Color: Negro / Size: M") for display. */
  variantLabel?: string
  /** Unit price in the product's source currency (whatever the API returned). */
  unitPriceSource: number
  /** Currency code of unitPriceSource (e.g. CNY for 1688 imports). */
  sourceCurrency: string
  quantity: number
  /** MOQ — pedido mínimo del producto. */
  moq?: number
  /** @deprecated kept for backwards compat with older persisted carts. */
  unitPriceUsd?: number
  unitPriceDisplay?: number
  displayCurrency?: string
  displaySymbol?: string
}

/**
 * DROP-637: single source of truth for a line's unit price + its currency, shared by the
 * cart page, drawer and checkout so the amount NEVER changes between views. Prefers the
 * DISPLAY price frozen at add-time (exactly what the user saw on the product page), falling
 * back to the source price only for legacy persisted lines. Pairing price↔currency here, in
 * one place, removes the bug where a source amount (e.g. 117 CNY) was rendered against the
 * display currency (→ "117,26 €" instead of "14,90 €").
 */
export function lineUnitPrice(l: CartLine): { amount: number; currency: string } {
  if (l.unitPriceDisplay != null && l.unitPriceDisplay > 0 && l.displayCurrency) {
    return { amount: l.unitPriceDisplay, currency: l.displayCurrency }
  }
  if (l.unitPriceSource != null && l.sourceCurrency) {
    return { amount: l.unitPriceSource, currency: l.sourceCurrency }
  }
  return { amount: l.unitPriceSource ?? l.unitPriceUsd ?? 0, currency: l.sourceCurrency ?? l.displayCurrency ?? 'USD' }
}

interface CartState {
  lines: CartLine[]
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  add: (line: CartLine) => void
  setQty: (productId: string, variantId: string | undefined, qty: number) => void
  remove: (productId: string, variantId?: string) => void
  clear: () => void
  subtotalUsdCents: () => number
  count: () => number
}

// DROP-514: normalizamos variantId vacío/null/undefined a `null` para que merges
// de líneas sigan funcionando aunque distintos callers pasen distintas formas
// de "sin variante". El bug aparecía cuando un legacy cart guardaba '' y la
// rama nueva mandaba undefined → sameLine devolvía false → duplicado.
const normVariant = (v: string | null | undefined) =>
  v == null || v === '' ? null : v
const sameLine = (a: CartLine, b: { productId: string; variantId?: string }) =>
  a.productId === b.productId && normVariant(a.variantId) === normVariant(b.variantId)

// DROP-553: sanitizer aplicado al rehydratar el cart persistido (y al hacer
// add). Resuelve carritos con duplicados antiguos donde el mismo
// productId+variantId aparecía 2× con monedas/precios distintos (ej. una en
// CNY y otra en EUR convertida). El resultado eran subtotales incongruentes
// (117,26 € + 1,89 € en la misma fila). Conservamos la línea más reciente
// pero sumamos qty para no perder unidades.
function dedupeLines(raw: CartLine[]): CartLine[] {
  const out: CartLine[] = []
  for (const l of raw) {
    const i = out.findIndex((x) => sameLine(x, l))
    if (i >= 0) {
      const prev = out[i]
      // Si las dos líneas tienen precios MUY distintos (>10x), preferimos la
      // que tiene sourceCurrency definido (más reciente / canónico) o, en
      // empate, la de precio mayor (asumimos legacy bug donde una vino sin
      // convertir desde CNY).
      const prevP = prev.unitPriceSource ?? prev.unitPriceUsd ?? 0
      const newP  = l.unitPriceSource    ?? l.unitPriceUsd    ?? 0
      const keepNew = !!l.sourceCurrency && (!prev.sourceCurrency || newP >= prevP)
      out[i] = keepNew
        ? { ...prev, ...l, sku: l.sku ?? prev.sku, image: l.image ?? prev.image,
            variantLabel: l.variantLabel ?? prev.variantLabel,
            quantity: prev.quantity + l.quantity }
        : { ...prev, sku: prev.sku ?? l.sku, image: prev.image ?? l.image,
            variantLabel: prev.variantLabel ?? l.variantLabel,
            quantity: prev.quantity + l.quantity }
    } else {
      out.push(l)
    }
  }
  return out
}

export const useCartStore = create<CartState>()(persist(
  (set, get) => ({
    lines: [],
    drawerOpen: false,
    openDrawer() { set({ drawerOpen: true }) },
    closeDrawer() { set({ drawerOpen: false }) },
    add(line) {
      set((s) => {
        // DROP-636: consolidación por productId + variantId/SKU. Si ya existe una
        // línea para la misma variante, SUMAMOS cantidades en vez de crear una
        // línea nueva. Tomamos el precio/moneda/SKU del último add (canónico y
        // coherente con la divisa actual) para que NUNCA convivan dos precios
        // distintos del mismo producto (el bug de 14,90 vs 1,89).
        const incoming: CartLine = { ...line, variantId: normVariant(line.variantId) ?? undefined }
        const merged: CartLine[] = []
        let absorbed = false
        for (const l of s.lines) {
          if (sameLine(l, incoming)) {
            if (!absorbed) {
              merged.push({
                ...l,
                ...incoming, // precio/moneda/imagen/sku del último add (currency actual)
                // conservamos sku/imagen previos si el add nuevo no los trae
                sku: incoming.sku ?? l.sku,
                image: incoming.image ?? l.image,
                variantLabel: incoming.variantLabel ?? l.variantLabel,
                quantity: l.quantity + incoming.quantity,
              })
              absorbed = true
            } else {
              // Línea duplicada extra preexistente: absorbemos su qty en la primera.
              merged[merged.length - 1].quantity += l.quantity
            }
          } else {
            merged.push(l)
          }
        }
        if (!absorbed) merged.push(incoming)
        return { lines: merged }
      })
    },
    setQty(productId, variantId, qty) {
      set((s) => ({
        lines: s.lines
          .map((l) => sameLine(l, { productId, variantId }) ? { ...l, quantity: Math.max(0, qty) } : l)
          .filter((l) => l.quantity > 0)
      }))
    },
    remove(productId, variantId) {
      set((s) => ({ lines: s.lines.filter((l) => !sameLine(l, { productId, variantId })) }))
    },
    clear() { set({ lines: [] }) },
    subtotalUsdCents() {
      // Subtotal in the SOURCE currency cents (kept the name for backwards compat
      // — converters that consume this should treat the unit as "source currency").
      return Math.round(get().lines.reduce((sum, l) => sum + (l.unitPriceSource ?? l.unitPriceUsd ?? 0) * l.quantity * 100, 0))
    },
    count() { return get().lines.reduce((n, l) => n + l.quantity, 0) },
  }),
  {
    // DROP-637/636: bumped the storage key + version. Carts created before the price-freeze fix
    // stored an incoherent unit price (e.g. 14,90 raw) that made the cart and checkout diverge.
    // The old key is abandoned so every cart starts clean; new lines freeze a single coherent price.
    name: 'nx036-cart-v2',
    version: 2,
    // Only persist lines — drawerOpen is ephemeral UI state.
    partialize: (s) => ({ lines: s.lines }) as any,
    migrate: () => ({ lines: [] }) as any, // discard any pre-v2 persisted cart entirely
    // DROP-553: al rehydratar sanitizamos para colapsar carritos legacy con
    // duplicados producidos por migraciones de moneda anteriores.
    onRehydrateStorage: () => (state) => {
      if (state && Array.isArray(state.lines)) {
        state.lines = dedupeLines(state.lines)
      }
    },
  }
))
