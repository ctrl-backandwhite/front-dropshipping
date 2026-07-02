import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { favorites } from '../api/catalog'
import { useAuthStore } from '../store/auth'

/**
 * Favoritos (wishlist) del usuario. Carga UNA vez el set de IDs favoritos (compartido por todas las
 * tarjetas vía react-query) y permite alternar con actualización optimista. Solo activo si hay usuario.
 */
export function useFavorites() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const enabled = !!user

  const { data: ids } = useQuery({
    queryKey: ['favorite-ids'],
    queryFn: () => favorites.ids(),
    enabled,
    staleTime: 60_000,
  })

  const set = useMemo(() => new Set(ids ?? []), [ids])

  const toggle = useCallback(async (productId: string) => {
    if (!enabled) return
    const isFav = set.has(productId)
    // Optimista: actualizamos la caché de IDs al instante.
    qc.setQueryData<string[]>(['favorite-ids'], (old = []) =>
      isFav ? old.filter((x) => x !== productId) : [productId, ...old])
    try {
      if (isFav) await favorites.remove(productId)
      else await favorites.add(productId)
      qc.invalidateQueries({ queryKey: ['favorites'] }) // lista de la página de favoritos
    } catch {
      qc.invalidateQueries({ queryKey: ['favorite-ids'] }) // revertir si falla
    }
  }, [enabled, set, qc])

  return {
    enabled,
    count: set.size,
    isFavorite: useCallback((id: string) => set.has(id), [set]),
    toggle,
  }
}
