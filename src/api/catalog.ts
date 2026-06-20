import { api } from './client'

export interface ProductSummary {
  id: string
  slug: string
  title: string
  mainImage?: string
  basePrice?: number
  currency?: string
  rating?: number
  monthlySales: number
  trendScore?: number
  status: string
  // DROP-637: precio ya convertido (margen + tasa de BD) y FORMATEADO por el backend. El front solo pinta.
  priceUsd?: number
  displayPrice?: number
  displayCurrency?: string
  displaySymbol?: string
  displayFormatted?: string
}

export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface ProductDetail extends ProductSummary {
  source: string
  externalId: string
  // URL del detalle del producto en la plataforma de origen (1688/Taobao/…). Solo uso interno/admin.
  sourceUrl?: string
  sku?: string
  titleZh: string
  description?: string
  descriptionZh?: string
  brand?: string
  moq: number
  reviewCount: number
  // DROP-408/414: precios canónicos USD + display en la divisa del usuario.
  costUsd?: number
  retailUsd?: number
  displayPrice?: number
  displayCurrency?: string
  displaySymbol?: string
  displayFormatted?: string
  attributes?: Record<string, string>
  // DROP-410/443: especificaciones y tags
  specifications?: { key: string; value: string; position?: number }[]
  tags?: string[]
  images: { id: string; sourceUrl: string; cdnUrl?: string; position: number; role: string }[]
  variants: {
    id: string
    sku?: string
    title?: string
    price?: number
    priceFormatted?: string
    stock: number
    imageUrl?: string
    options: Record<string, string>
    active: boolean
  }[]
  variantOptions: {
    id: string
    nameZh: string
    name?: string
    position: number
    values: { id: string; valueZh: string; value?: string; imageUrl?: string; position: number }[]
  }[]
  priceTiers: { minQty: number; maxQty?: number; unitPrice: number; currency: string; unitPriceFormatted?: string }[]
}

export interface ProductFilters {
  q?: string
  categoryId?: string
  supplierId?: string
  minPrice?: number
  maxPrice?: number
  shipFrom?: string
  freeShipping?: boolean
  selfPickup?: boolean
  hasVideo?: boolean
  minRating?: number
  inventoryMin?: number
  certification?: string
  sort?: 'best_match' | 'trending' | 'price_asc' | 'price_desc' | 'newest' | 'sales' | 'rating' | 'inventory' | 'lists'
}

export async function listStorefrontProducts(page = 0, size = 24, lang = 'es', filters: ProductFilters = {}) {
  const { data } = await api.get<PageResponse<ProductSummary>>('/storefront/catalog/products', {
    params: { page, size, lang, ...filters },
  })
  return data
}

export interface CategoryView {
  id: string
  slug: string
  name: string
  nameZh?: string
  parentId?: string | null
  position: number
  icon?: string
  directProductCount?: number
  children?: CategoryView[]
}

export interface SupplierView {
  id: string
  slug: string
  name: string
  country?: string
  city?: string
  rating?: number
}

export async function listCategories(lang = 'es') {
  const { data } = await api.get<CategoryView[]>('/storefront/catalog/categories', { params: { lang } })
  return data
}

// Árbol completo (top-level + subcategorías) con su directProductCount y nombre traducido por `lang`.
// Lo usa el filtro del catálogo para ofrecer las categorías que SÍ tienen productos (que en este
// catálogo son las subcategorías), ya que listCategories solo devuelve los nodos raíz.
export async function listCategoriesTree(lang = 'es') {
  const { data } = await api.get<CategoryView[]>('/storefront/catalog/categories/tree', { params: { lang } })
  return data
}

export async function listSuppliers() {
  const { data } = await api.get<SupplierView[]>('/storefront/catalog/suppliers')
  return data
}

/* ============ DROP-1 (Catalog discovery) extra endpoints ============ */

export interface HomeSection {
  code: 'trending' | 'newest' | 'video' | 'top_selling'
  title: string
  items: ProductSummary[]
}
export interface HomeSectionsResponse { sections: HomeSection[]; hotCategories: CategoryView[] }

export async function listHomeSections(lang = 'es', perSection = 8) {
  const { data } = await api.get<HomeSectionsResponse>('/storefront/catalog/home/sections', {
    params: { lang, perSection },
  })
  return data
}

export interface ImportUrlResponse {
  matched: boolean
  source?: string
  externalId?: string
  product?: ProductSummary
  resolveHint?: string
}
export async function importProductByUrl(url: string, lang = 'es') {
  const { data } = await api.post<ImportUrlResponse>(
    '/storefront/catalog/products/import-url',
    { url },
    { params: { lang } },
  )
  return data
}

export interface ImageSearchResult { product: ProductSummary; score: number }

export async function searchByImage(payload: { imageBase64?: string; imageUrl?: string; limit?: number }, lang = 'es') {
  const { data } = await api.post<ImageSearchResult[]>(
    '/storefront/catalog/products/search-by-image',
    payload,
    { params: { lang } },
  )
  return data
}

export interface HistoryPoint { date: string; price: number; stock: number }
export async function getPriceHistory(productId: string, days = 90) {
  const { data } = await api.get<HistoryPoint[]>(`/storefront/catalog/products/${productId}/price-history`, {
    params: { days },
  })
  return data
}

export interface MarginEstimate {
  cost: number; suggestedRetail: number; shipping: number;
  commission: number; netProfit: number; marginPct: number;
}
export async function getMarginEstimate(productId: string, country = 'ES', quantity = 1) {
  const { data } = await api.get<MarginEstimate>(`/storefront/catalog/products/${productId}/margin-estimate`, {
    params: { country, quantity },
  })
  return data
}

export async function bestsellers(page = 0, size = 20, lang = 'es', categoryId?: string) {
  const { data } = await api.get<PageResponse<ProductSummary>>('/storefront/catalog/bestsellers', {
    params: { page, size, lang, categoryId },
  })
  return data
}

export async function getProduct(slug: string, lang = 'es') {
  const { data } = await api.get<ProductDetail>(`/storefront/catalog/products/${slug}`, {
    params: { lang },
  })
  return data
}

// DROP-410/443: el endpoint /products/{id}/specifications devuelve las
// 6-9 especificaciones técnicas por idioma. ProductDetailView no las trae
// embebidas, así que el PDP las hace fetch aparte.
export async function getProductSpecifications(id: string, lang = 'es') {
  const { data } = await api.get<{ key: string; value: string; position?: number }[]>(
    `/storefront/catalog/products/${id}/specifications`, { params: { lang } },
  )
  return data
}

// DROP-410/443: y los attributes free-form (color/size/material extraídos del feed 1688).
// DROP-672: lang para recibir el valor traducido del atributo cuando exista (fallback a neutral).
export async function getProductAttributes(id: string, lang = 'es') {
  const { data } = await api.get<{ key: string; value: string }[]>(
    `/storefront/catalog/products/${id}/attributes`,
    { params: { lang } },
  )
  return data
}

export async function searchProducts(q: string, lang = 'es', page = 0, size = 24) {
  const { data } = await api.get<{ items: any[]; total: number; page: number; size: number }>(
    '/storefront/search',
    { params: { q, lang, page, size } },
  )
  return data
}

export async function adminListProducts(status?: string, page = 0, size = 30, lang = 'es', categoryId?: string,
                                        sort?: string) {
  // DROP-453: limpiar status no válidos antes de mandar (axios a veces serializa
  // undefined como string "undefined" en versiones antiguas).
  const params: Record<string, any> = { page, size, lang }
  if (categoryId) params.categoryId = categoryId
  if (status && status !== 'ALL' && status !== 'undefined' && status !== 'null') {
    params.status = status
  }
  if (sort) params.sort = sort
  const { data } = await api.get<PageResponse<ProductSummary>>('/admin/catalog/products', { params })
  return data
}

export async function adminUpdateStatus(productId: string, status: string) {
  await api.put(`/admin/catalog/products/${productId}/status`, { status })
}

// ── Reseñas de producto ──
export interface ReviewItem {
  id: string; authorName?: string; authorCountry?: string; rating: number;
  title?: string; body?: string; helpfulCount?: number; verifiedPurchase?: boolean;
  language?: string; createdAt?: string
}
export interface ReviewList {
  items: ReviewItem[]; page: number; size: number; totalElements: number; totalPages: number;
  distribution: Record<string, number>; averageRating: number
}
export async function listReviews(productId: string, page = 0, size = 20) {
  const { data } = await api.get<ReviewList>(`/storefront/catalog/products/${productId}/reviews`, { params: { page, size } })
  return data
}
export async function createReview(productId: string, body: { rating: number; title?: string; body?: string; language?: string; authorName?: string }) {
  const { data } = await api.post<ReviewItem>(`/storefront/catalog/products/${productId}/reviews`, body)
  return data
}
