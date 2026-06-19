import { api } from './client'

export interface Metrics {
  activeProducts: number
  totalProducts: number
  draftProducts: number
  totalOrders: number
  totalUsers: number
  totalSuppliers: number
  activePlans: number
  totalSubscriptions: number
  gmvUsd: number
  gmvDisplay: number
  mrrUsd: number
  displayCurrency: string
  displaySymbol: string
}

export interface RecentOrder {
  id: string
  orderNumber: string
  status: string
  totalCents: number
  currency: string
  placedAt: string
}

export interface CategoryRow {
  id: string
  slug: string
  nameZh: string
  names: Record<string, string>
  icon?: string
  position: number
  active: boolean
  parentId: string | null
  productCount: number
}

export interface SupplierRow {
  id: string
  externalId: string
  source: string
  name: string
  nameZh?: string
  country?: string
  city?: string
  rating?: number
  yearsActive?: number
  verified: boolean
  trustPass: boolean
  profileUrl?: string
  productCount: number
}

// DROP-690: payload de alta manual / importación de órdenes.
export interface AdminOrderAddressBody {
  fullName: string; phone?: string; email?: string;
  line1: string; line2?: string; city: string; state?: string; postalCode?: string; country: string
}
export interface AdminOrderItemBody { productId: string; variantId?: string; quantity: number }
export interface AdminCreateOrderBody {
  customerEmail?: string
  externalOrderId?: string
  shippingAddress: AdminOrderAddressBody
  billingAddress?: AdminOrderAddressBody
  items: AdminOrderItemBody[]
  notes?: string
}

export interface OrderRow {
  id: string
  orderNumber: string
  status: string
  partnerAppId?: string
  totalCents: number
  shippingCents: number
  currency: string
  itemCount: number
  placedAt?: string
  forwardedAt?: string
  shippedAt?: string
  deliveredAt?: string
  cancelledAt?: string
  customerEmail?: string
  shopName?: string
  shopHandle?: string
  supplierName?: string
}

export interface PriceRule {
  id: string
  scope: 'GLOBAL' | 'CATEGORY' | 'SUPPLIER' | 'PRODUCT' | 'PRODUCT_GROUP' | 'VARIANT'
  scopeId?: string
  scopeName?: string
  marginType: 'PERCENTAGE' | 'FIXED'
  marginValue: number
  minCostUsd?: number
  maxCostUsd?: number
  active: boolean
  position: number
  description?: string
}

export interface ProductGroup {
  id: string
  name: string
  description?: string
  active: boolean
  memberCount: number
}

export interface OAuthClient {
  id: string
  client_id: string
  client_name: string
  auth_methods: string
  grant_types: string
  redirect_uris?: string
  scopes: string
}

export interface UserRow {
  id: string
  email: string
  role: string
  active: boolean
  displayName?: string
  companyName?: string
  country?: string
  language?: string
  lockedUntil?: string | null
  failedLoginCount: number
  lastLogin?: string | null
  createdAt?: string | null
}

export interface PlanRow {
  id: string
  code: string
  name: string
  description?: string
  priceMonthlyCents: number
  priceYearlyCents: number
  currency: string
  active: boolean
  position: number
}

export interface SubscriptionRow {
  id: string
  userId: string
  userEmail: string
  plan: string
  status: string
  billingPeriod: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  priceMonthly: number
  priceYearly: number
}

export interface CountryTaxRow {
  countryCode: string
  label?: string
  rateBps: number
  ratePercent: number
  active: boolean
}

export interface CurrencyRow {
  code: string
  name: string
  symbol: string
  countryCode?: string
  flagEmoji?: string
  locale?: string
  rateVsUsd: number
  active: boolean
  lastSyncedAt?: string
}

// Resultado estándar de las acciones masivas con reporte por id (loop backend con try/catch).
export interface BulkResult {
  succeeded: number
  failed: number
  errors: string[]
}

export const admin = {
  metrics:        () => api.get<Metrics>('/admin/dashboard/metrics').then((r) => r.data),
  recentOrders:   () => api.get<RecentOrder[]>('/admin/dashboard/recent-orders').then((r) => r.data),
  series:         () => api.get<{ ordersByDay: Record<string, number>; gmvCentsByDay: Record<string, number> }>('/admin/dashboard/series').then((r) => r.data),
  categories:     () => api.get<CategoryRow[]>('/admin/catalog/categories').then((r) => r.data),
  // Listado paginado e indexado de categorías (rápido, sin cargar todo el árbol). Filtro libre opcional `q`.
  categoriesPaged:(params?: { q?: string; hasProducts?: boolean; page?: number; size?: number }) =>
                    api.get<{ items: CategoryRow[]; totalElements: number; totalPages: number; page: number; size: number }>(
                      '/admin/catalog/categories/paged', { params }).then((r) => r.data),
  toggleCategory: (id: string) => api.put<CategoryRow>(`/admin/catalog/categories/${id}/toggle`).then((r) => r.data),
  // Activa/desactiva varias categorías a la vez.
  bulkActiveCategories: (ids: string[], active: boolean) =>
                    api.put<{ updated: number }>('/admin/catalog/categories/bulk-active', { ids, active }).then((r) => r.data),
  // DROP-454/455 — CRUD real. POST mapea al endpoint existente AdminCatalogController.upsertCategory
  // que espera IngestCategoryRequest (slug, parentId, nameZh, position, icon, nameTranslations).
  createCategory: (body: { slug: string; nameZh: string; icon?: string; position?: number;
                            parentId?: string; names?: Record<string, string> }) => {
                    const payload = {
                      slug: body.slug,
                      nameZh: body.nameZh,
                      icon: body.icon,
                      position: body.position ?? 0,
                      parentId: body.parentId,
                      nameTranslations: body.names ?? {},
                    }
                    return api.post('/admin/catalog/categories', payload).then((r) => r.data)
                  },
  updateCategory: (id: string, body: any) =>
                    api.put<CategoryRow>(`/admin/catalog/categories/${id}`, body).then((r) => r.data),
  deleteCategory: (id: string) =>
                    api.delete(`/admin/catalog/categories/${id}`).then((r) => r.status),
  reindexCategories: () => api.post<{ indexed: number }>('/admin/catalog/categories/reindex').then((r) => r.data),

  // ===== Impuestos por país =====
  taxRates:       () => api.get<CountryTaxRow[]>('/admin/tax-rates').then((r) => r.data),
  taxUpsert:      (country: string, body: { label: string; rateBps: number; active: boolean }) =>
                    api.put<CountryTaxRow>(`/admin/tax-rates/${country}`, body).then((r) => r.data),
  taxDelete:      (country: string) => api.delete(`/admin/tax-rates/${country}`).then((r) => r.status),

  // ===== Divisas (tipos de cambio) =====
  currencyAll:    () => api.get<CurrencyRow[]>('/admin/currency/all').then((r) => r.data),
  currencySync:   () => api.post<{ updated: number; message: string }>('/admin/currency/sync').then((r) => r.data),
  currencySetActive: (code: string, active: boolean) =>
                    api.put<CurrencyRow>(`/admin/currency/${code}/active`, null, { params: { active } }).then((r) => r.data),
  currencyBulkActive: (codes: string[], active: boolean) =>
                    api.put<{ changed: number }>('/admin/currency/bulk-active', { codes, active }).then((r) => r.data),
  currencyUpdateRate: (code: string, rateVsUsd: number, active?: boolean) =>
                    api.put<CurrencyRow>(`/admin/currency/${code}`, { rateVsUsd, active }).then((r) => r.data),

  // Reindex the whole catalog into OpenSearch (sync button on Productos/Categorías).
  reindexCatalog: () => api.post<{ indexed: number }>('/admin/catalog/reindex').then((r) => r.data),

  // Send/broadcast an in-app notification (admin).
  sendNotification: (body: { target?: string; title: string; body: string }) =>
                    api.post<{ sent: number }>('/admin/notifications/send', body).then((r) => r.data),

  // Manual single product creation; returns the new product id.
  createProduct:  (body: any) => api.post<string>('/admin/catalog/products/create', body).then((r) => r.data),
  duplicateProduct: (id: string) => api.post(`/admin/catalog/products/${id}/duplicate`).then((r) => r.data),
  deleteProduct:  (id: string) => api.delete(`/admin/catalog/products/${id}`).then((r) => r.status),
  // Borrado masivo con reporte por id (cada uno se rechaza si tiene órdenes).
  bulkDeleteProducts: (ids: string[]) =>
                    api.post<{ deleted: number; failed: number; errors: string[] }>('/admin/catalog/products/bulk-delete', ids).then((r) => r.data),
  // Cambio masivo de estado: publicar (ACTIVE), pausar (PAUSED) o archivar (ARCHIVED).
  bulkProductStatus: (ids: string[], status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') =>
                    api.put<BulkResult>('/admin/catalog/products/bulk-status', { ids, status }).then((r) => r.data),

  // Bulk JSON import.
  bulkProducts:   (rows: any[]) =>
                    api.post<{ created: number; failed: number; errors: string[] }>('/admin/catalog/products/bulk', rows).then((r) => r.data),
  // Export masivo: mismo formato que el import (re-importable), por rango 1-based (1-1000, 1001-2000, …).
  exportProductsCount: () => api.get<{ count: number }>('/admin/catalog/products/export/count').then((r) => r.data.count),
  exportProducts: (from: number, to: number) =>
                    api.get<any[]>('/admin/catalog/products/export', { params: { from, to } }).then((r) => r.data),
  bulkCategories: (rows: any[]) =>
                    api.post<{ created: number; failed: number; errors: string[] }>('/admin/catalog/categories/bulk', rows).then((r) => r.data),

  // Variant management (admin product detail). listVariants returns RAW prices (no margin).
  listVariants:   (productId: string) => api.get<any[]>(`/admin/catalog/products/${productId}/variants`).then((r) => r.data),
  createVariant:  (productId: string, body: any) =>
                    api.post(`/admin/catalog/products/${productId}/variants`, body).then((r) => r.data),
  updateVariant:  (id: string, body: any) =>
                    api.put(`/admin/catalog/variants/${id}`, body).then((r) => r.data),
  // Edición inline solo del precio (no toca sku/stock/opciones).
  updateVariantPrice: (id: string, price: number) =>
                    api.put(`/admin/catalog/variants/${id}/price`, { price }).then((r) => r.data),
  // Renombrar la etiqueta visible de un valor de variación (color/estampado).
  renameVariantValue: (id: string, value: string) =>
                    api.put(`/admin/catalog/variant-values/${id}/label`, { value }).then((r) => r.status),
  // DROP-674: fijar la imagen real de un valor de variación (foto del color).
  setVariantValueImage: (id: string, imageUrl: string) =>
                    api.put(`/admin/catalog/variant-values/${id}/image`, { imageUrl }).then((r) => r.status),
  // DROP-692: gestión admin de mentores.
  mentors: () => api.get('/admin/mentors').then((r) => r.data as any[]),
  createMentor: (body: any) => api.post('/admin/mentors', body).then((r) => r.data),
  updateMentor: (id: string, body: any) => api.put(`/admin/mentors/${id}`, body).then((r) => r.data),
  deleteMentor: (id: string) => api.delete(`/admin/mentors/${id}`).then((r) => r.status),
  // DROP-691: gestión admin de cursos de Academia.
  academyCourses: () => api.get('/admin/academy/courses').then((r) => r.data as any[]),
  createCourse: (body: any) => api.post('/admin/academy/courses', body).then((r) => r.data),
  updateCourse: (id: string, body: any) => api.put(`/admin/academy/courses/${id}`, body).then((r) => r.data),
  deleteCourse: (id: string) => api.delete(`/admin/academy/courses/${id}`).then((r) => r.status),
  // Registro de idiomas de la tienda (configurable, ilimitado).
  languages: () => api.get('/admin/languages').then((r) => r.data as Array<{ id: string; code: string; label: string; flag?: string; position: number; active: boolean; isDefault: boolean }>),
  upsertLanguage: (body: { code: string; label?: string; flag?: string; position?: number; active?: boolean; isDefault?: boolean }) =>
                    api.post('/admin/languages', body).then((r) => r.data),
  deleteLanguage: (id: string) => api.delete(`/admin/languages/${id}`).then((r) => r.status),
  deleteVariant:  (id: string) =>
                    api.delete(`/admin/catalog/variants/${id}`).then((r) => r.status),

  // DROP-648: affiliate program administration.
  affiliates:       () => api.get<any[]>('/admin/affiliates').then((r) => r.data),
  affiliateDetail:  (id: string) => api.get<any>(`/admin/affiliates/${id}`).then((r) => r.data),
  setAffiliateStatus: (id: string, status: string) =>
                      api.post(`/admin/affiliates/${id}/status`, { status }).then((r) => r.status),
  payoutAffiliate:  (id: string) => api.post<{ paidCents: number }>(`/admin/affiliates/${id}/payout`).then((r) => r.data),
  approveDueCommissions: () => api.post<{ approved: number }>('/admin/affiliates/approve-due').then((r) => r.data),
  affiliateConfig:  () => api.get<any>('/admin/affiliates/config').then((r) => r.data),
  updateAffiliateConfig: (body: any) => api.put<any>('/admin/affiliates/config', body).then((r) => r.data),
  affiliatePendingPayouts: () => api.get<any[]>('/admin/affiliates/payouts/pending').then((r) => r.data),
  // Newsletter (admin)
  newsletterOverview: () => api.get<{ subscribers: number; campaigns: any[] }>('/admin/newsletter').then((r) => r.data),
  sendNewsletter: (subject: string, bodyHtml: string) =>
                    api.post<{ id: string; recipients: number }>('/admin/newsletter/send', { subject, bodyHtml }).then((r) => r.data),
  approveAffiliatePayout: (id: string) => api.post<any>(`/admin/affiliates/payouts/${id}/approve`).then((r) => r.data),
  rejectAffiliatePayout: (id: string, reason?: string) =>
                      api.post(`/admin/affiliates/payouts/${id}/reject`, { reason }).then((r) => r.status),
  resolveAffiliateReview: (commissionId: string, approve: boolean) =>
                      api.post(`/admin/affiliates/commissions/${commissionId}/review`, null, { params: { approve } }).then((r) => r.status),

  // Image upload (URL or file) for products and variants.
  uploadImage:    (file: File) => {
                    const fd = new FormData()
                    fd.append('file', file)
                    return api.post<{ url: string }>('/admin/catalog/images/upload', fd,
                      { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
                  },
  addProductImage:(productId: string, url: string, role?: string) =>
                    api.post(`/admin/catalog/products/${productId}/images`, { url, role }).then((r) => r.data),
  deleteProductImage: (imageId: string) =>
                    api.delete(`/admin/catalog/products/images/${imageId}`).then((r) => r.status),

  suppliers:      () => api.get<SupplierRow[]>('/admin/catalog/suppliers').then((r) => r.data),
  orders:         (params?: { status?: string; q?: string; page?: number; size?: number }) =>
                    api.get<{ items: OrderRow[]; totalElements: number; totalPages: number; page: number; size: number }>(
                      '/admin/orders', { params }
                    ).then((r) => r.data),
  // DROP-632: lang drives localised line titles in the admin order detail.
  orderById:      (id: string, lang = 'es') => api.get<any>(`/admin/orders/${id}`, { params: { lang } }).then((r) => r.data),
  wallets:        (params?: { q?: string; status?: string; currency?: string; page?: number; size?: number }) =>
                    api.get<{ items: any[]; totalElements: number; totalPages: number; page: number; size: number }>(
                      '/admin/wallets', { params }
                    ).then((r) => r.data),
  // DROP-438: depósito manual + ajuste con motivo + historial paginado.
  walletTopup:    (userId: string, body: { amountCents: number; description?: string; idempotencyKey?: string }) =>
                    api.post<{ transactionId: string; balanceAfter: number; amountCents: number }>(
                      `/admin/wallets/${userId}/topup`, body).then((r) => r.data),
  walletAdjust:   (userId: string, body: { amountCents: number; description: string; idempotencyKey?: string }) =>
                    api.post<{ transactionId: string; balanceAfter: number; amountCents: number }>(
                      `/admin/wallets/${userId}/adjust`, body).then((r) => r.data),
  walletTx:       (walletId: string, page = 0, size = 30) =>
                    api.get<{ items: any[]; totalElements: number; totalPages: number; page: number; size: number }>(
                      `/admin/wallets/${walletId}/transactions`, { params: { page, size } }).then((r) => r.data),
  // DROP-633: wallet detail (balances + status) by userId; movements + manual adjustment.
  walletDetail:   (userId: string) =>
                    api.get<{
                      id: string; userId: string; email: string; name?: string;
                      balanceUsd: number; holdUsd: number; availableUsd: number;
                      currency: string; status: string;
                    }>(`/admin/wallets/${userId}`).then((r) => r.data),
  walletMovements:(walletId: string, page = 0, size = 30) =>
                    api.get<{ items: any[]; totalElements: number; totalPages: number; page: number; size: number }>(
                      `/admin/wallets/${walletId}/transactions`, { params: { page, size } }).then((r) => r.data),
  adjustWallet:   (userId: string, body: { amountCents: number; description: string; idempotencyKey?: string }) =>
                    api.post<{ transactionId: string; balanceAfter: number; amountCents: number }>(
                      `/admin/wallets/${userId}/adjust`, body).then((r) => r.data),
  forwardOrder:   (id: string) => api.post<OrderRow>(`/admin/orders/${id}/forward`).then((r) => r.data),
  shipOrder:      (id: string) => api.post<OrderRow>(`/admin/orders/${id}/ship`).then((r) => r.data),
  deliverOrder:   (id: string) => api.post<OrderRow>(`/admin/orders/${id}/deliver`).then((r) => r.data),
  cancelOrder:    (id: string) => api.post<OrderRow>(`/admin/orders/${id}/cancel`).then((r) => r.data),
  // DROP-584: reembolso administrativo — acredita el total al wallet del comprador.
  refundOrder:    (id: string) => api.post<OrderRow>(`/admin/orders/${id}/refund`).then((r) => r.data),
  // Acciones masivas de pedidos: el backend itera y reporta por id; las transiciones no válidas
  // (estado incompatible) cuentan como "failed" pero no abortan el lote.
  bulkForwardOrders: (ids: string[]) => api.post<BulkResult>('/admin/orders/bulk-forward', ids).then((r) => r.data),
  bulkShipOrders:    (ids: string[]) => api.post<BulkResult>('/admin/orders/bulk-ship', ids).then((r) => r.data),
  bulkDeliverOrders: (ids: string[]) => api.post<BulkResult>('/admin/orders/bulk-deliver', ids).then((r) => r.data),
  bulkCancelOrders:  (ids: string[]) => api.post<BulkResult>('/admin/orders/bulk-cancel', ids).then((r) => r.data),
  bulkRefundOrders:  (ids: string[]) => api.post<BulkResult>('/admin/orders/bulk-refund', ids).then((r) => r.data),
  // Cainiao: timeline de seguimiento + forzar sincronización del envío.
  orderTracking:  (id: string) => api.get<any>(`/admin/orders/${id}/tracking`).then((r) => r.data),
  syncTracking:   (id: string) => api.post<any>(`/admin/orders/${id}/sync-tracking`).then((r) => r.data),
  // DROP-585: toggles de proveedor verified/trustPass desde el panel.
  toggleSupplierVerified:  (id: string) => api.post(`/admin/catalog/suppliers/${id}/verify`).then((r) => r.data),
  toggleSupplierTrustPass: (id: string) => api.post(`/admin/catalog/suppliers/${id}/trustpass`).then((r) => r.data),
  createSupplier: (body: any) => api.post('/admin/catalog/suppliers/create', body).then((r) => r.data),
  updateSupplier: (id: string, body: any) => api.put(`/admin/catalog/suppliers/${id}`, body).then((r) => r.data),
  deleteSupplier: (id: string) => api.delete(`/admin/catalog/suppliers/${id}`).then((r) => r.status),
  // Acciones masivas de proveedores: verificar/desverificar (set a valor) y eliminar (rechaza si tiene productos).
  bulkVerifySuppliers: (ids: string[], verified: boolean) =>
                    api.put<BulkResult>('/admin/catalog/suppliers/bulk-verify', { ids, verified }).then((r) => r.data),
  bulkDeleteSuppliers: (ids: string[]) =>
                    api.post<BulkResult>('/admin/catalog/suppliers/bulk-delete', ids).then((r) => r.data),
  // DROP-586: edición inline de usuario.
  editUser:       (id: string, body: { displayName?: string; companyName?: string; country?: string; language?: string; active?: boolean }) =>
                    api.put(`/admin/users/${id}`, body).then((r) => r.data),
  createDemoOrder:() => api.post('/admin/orders/demo').then((r) => r.data),
  // DROP-690: alta manual de orden + importación masiva desde el panel.
  createOrder:    (body: AdminCreateOrderBody) => api.post<OrderRow>('/admin/orders', body).then((r) => r.data),
  importOrders:   (orders: AdminCreateOrderBody[]) =>
                    api.post<{ imported: number; failed: number; created: string[]; errors: string[] }>(
                      '/admin/orders/import', { orders }).then((r) => r.data),
  priceRules:     () => api.get<PriceRule[]>('/admin/pricing/rules').then((r) => r.data),
  createRule:     (body: Partial<PriceRule>) => api.post<PriceRule>('/admin/pricing/rules', body).then((r) => r.data),
  updateRule:     (id: string, body: Partial<PriceRule>) => api.put<PriceRule>(`/admin/pricing/rules/${id}`, body).then((r) => r.data),
  deleteRule:     (id: string) => api.delete(`/admin/pricing/rules/${id}`),
  toggleRule:     (id: string) => api.put<PriceRule>(`/admin/pricing/rules/${id}/toggle`).then((r) => r.data),
  // Acciones masivas de reglas de margen: activar/desactivar (set a valor) y eliminar.
  bulkToggleRules: (ids: string[], active: boolean) =>
                    api.put<BulkResult>('/admin/pricing/rules/bulk-toggle', { ids, active }).then((r) => r.data),
  bulkDeleteRules: (ids: string[]) =>
                    api.post<BulkResult>('/admin/pricing/rules/bulk-delete', ids).then((r) => r.data),
  // Grupos de productos (scope PRODUCT_GROUP de las reglas de margen).
  productGroups:  () => api.get<ProductGroup[]>('/admin/product-groups').then((r) => r.data),
  createProductGroup: (body: { name: string; description?: string; active?: boolean }) =>
                    api.post<ProductGroup>('/admin/product-groups', body).then((r) => r.data),
  updateProductGroup: (id: string, body: { name?: string; description?: string; active?: boolean }) =>
                    api.put<ProductGroup>(`/admin/product-groups/${id}`, body).then((r) => r.data),
  deleteProductGroup: (id: string) => api.delete(`/admin/product-groups/${id}`).then((r) => r.status),
  productGroupMembers: (id: string) =>
                    api.get<{ id: string; title: string; slug: string }[]>(`/admin/product-groups/${id}/members`).then((r) => r.data),
  addProductGroupMembers: (id: string, productIds: string[]) =>
                    api.post<{ added: number }>(`/admin/product-groups/${id}/members`, { productIds }).then((r) => r.data),
  removeProductGroupMember: (id: string, productId: string) =>
                    api.delete(`/admin/product-groups/${id}/members/${productId}`).then((r) => r.status),
  oauthClients:   () => api.get<OAuthClient[]>('/admin/partners/oauth-clients').then((r) => r.data),
  partnerApps:    () => api.get<any[]>('/admin/partners/apps').then((r) => r.data),
  webhooks:       () => api.get<any[]>('/admin/partners/webhooks').then((r) => r.data),
  testPartnerWebhooks: () => api.post<{ queued: number }>('/admin/partners/webhooks/test').then((r) => r.data),
  createOAuthClient: (body: { name: string; scopes?: string[] }) =>
                    api.post<{ clientId: string; clientSecret: string; name: string; message: string }>('/admin/partners/oauth-clients', body).then((r) => r.data),
  rotateOAuthSecret: (clientId: string) =>
                    api.post<{ clientId: string; clientSecret: string; message: string }>(`/admin/partners/oauth-clients/${clientId}/rotate-secret`).then((r) => r.data),
  deleteOAuthClient: (id: string) => api.delete(`/admin/partners/oauth-clients/${id}`).then((r) => r.status),
  users:          (params?: { role?: string; q?: string; country?: string; page?: number; size?: number }) =>
                    api.get<{ items: UserRow[]; totalElements: number; totalPages: number; page: number; size: number }>(
                      '/admin/users', { params }
                    ).then((r) => r.data),
  changeRole:     (id: string, role: string) => api.put<UserRow>(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  lockUser:       (id: string, minutes = 60) => api.post<UserRow>(`/admin/users/${id}/lock`, null, { params: { minutes } }).then((r) => r.data),
  unlockUser:     (id: string) => api.post<UserRow>(`/admin/users/${id}/unlock`).then((r) => r.data),
  forceActivate:  (id: string) => api.post<UserRow>(`/admin/users/${id}/activate`).then((r) => r.data),
  resetPassword:  (id: string) => api.post(`/admin/users/${id}/reset-password`).then((r) => r.status),
  deleteUser:     (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.status),
  inviteUser:     (email: string, role?: string) => api.post<UserRow>('/admin/users/invite', { email, role }).then((r) => r.data),
  // Acciones masivas de usuarios: el backend itera y reporta por id.
  bulkActivateUsers: (ids: string[]) => api.post<BulkResult>('/admin/users/bulk-activate', ids).then((r) => r.data),
  bulkLockUsers:     (ids: string[]) => api.post<BulkResult>('/admin/users/bulk-lock', ids).then((r) => r.data),
  bulkUnlockUsers:   (ids: string[]) => api.post<BulkResult>('/admin/users/bulk-unlock', ids).then((r) => r.data),
  bulkRoleUsers:     (ids: string[], role: string) =>
                    api.put<BulkResult>('/admin/users/bulk-role', { ids, role }).then((r) => r.data),
  bulkDeleteUsers:   (ids: string[]) => api.post<BulkResult>('/admin/users/bulk-delete', ids).then((r) => r.data),
  plans:          () => api.get<PlanRow[]>('/admin/billing/plans').then((r) => r.data),
  updatePlan:     (code: string, body: Partial<PlanRow>) => api.put(`/admin/billing/plans/${code}`, body),
  subscriptions:  (status?: string) => api.get<SubscriptionRow[]>('/admin/billing/subscriptions', { params: { status } }).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
                    api.post('/me/password', { currentPassword, newPassword }),

  // Outbound webhook subscriptions
  webhookSubs:        () => api.get<WebhookSub[]>('/admin/webhooks/subscriptions').then((r) => r.data),
  createWebhookSub:   (body: { name: string; targetUrl: string; events?: string[]; description?: string }) =>
                        api.post<WebhookSub>('/admin/webhooks/subscriptions', body).then((r) => r.data),
  updateWebhookSub:   (id: string, body: Partial<WebhookSub>) =>
                        api.put<WebhookSub>(`/admin/webhooks/subscriptions/${id}`, body).then((r) => r.data),
  deleteWebhookSub:   (id: string) => api.delete(`/admin/webhooks/subscriptions/${id}`),
  rotateWebhookSecret:(id: string) => api.post<WebhookSub>(`/admin/webhooks/subscriptions/${id}/rotate-secret`).then((r) => r.data),
  testWebhook:        (id: string) => api.post<WebhookSub>(`/admin/webhooks/subscriptions/${id}/test`).then((r) => r.data),
  webhookDeliveries:  (id: string) =>
                        api.get<WebhookDelivery[]>(`/admin/webhooks/subscriptions/${id}/deliveries`).then((r) => r.data),
}

export interface WebhookSub {
  id: string
  name: string
  targetUrl: string
  secret: string
  events: string[]
  active: boolean
  description?: string
  createdAt: string
}

export interface WebhookDelivery {
  id: string
  eventType: string
  eventId: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY'
  attempt: number
  responseStatus?: number
  responseBody?: string
  lastAttemptAt?: string
  nextRetryAt?: string
  createdAt: string
}
