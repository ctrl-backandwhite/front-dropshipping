import { api } from './client'

/* ============ DROP-5 Shops ============ */
export interface ShopRow { id: string; platform: string; shopHandle: string; status: string; lastSyncAt?: string; lastSyncMessage?: string; lastSyncError?: string; createdAt: string; listings: number }
// DROP-701: `available` distingue integraciones reales de las anunciadas como "Próximamente".
export interface PlatformOpt { code: string; label: string; available: boolean }
export const shopsApi = {
  list:        () => api.get<ShopRow[]>('/me/shops').then((r) => r.data),
  connect:     (body: { platform: string; shopHandle: string; accessToken?: string }) =>
                 api.post<ShopRow>('/me/shops', body).then((r) => r.data),
  sync:        (id: string) => api.post<ShopRow>(`/me/shops/${id}/sync`).then((r) => r.data),
  disconnect:  (id: string) => api.delete(`/me/shops/${id}`),
  listings:    (id: string) => api.get<any[]>(`/me/shops/${id}/listings`).then((r) => r.data),
  push:        (id: string, productId: string) => api.post(`/me/shops/${id}/listings/${productId}`).then((r) => r.data),
  platforms:   () => api.get<PlatformOpt[]>('/me/shops/platforms').then((r) => r.data),
}

/* ============ DROP-3 Sourcing ============ */
export interface SourcingRequestRow {
  id: string; sourceUrl: string; source?: string; externalId?: string;
  status: string; titleHint?: string; notes?: string;
  selectedQuoteId?: string; createdAt: string; quotesCount: number
}
export interface AgentLite { id: string; displayName: string; tier: string; satisfaction: number; completedJobs: number; avatarUrl?: string }
export interface AgentFull extends AgentLite { bio?: string; languages: string[]; successRate: number; avgResponseHours: number; hourlyRateUsdCents?: number }
export interface SourcingQuote {
  id: string; requestId: string; agent?: AgentLite; priceUsdCents: number; etaDays: number;
  moq?: number; notes?: string; status: string; createdAt: string
}
export const sourcingApi = {
  myRequests:  () => api.get<SourcingRequestRow[]>('/me/sourcing/requests').then((r) => r.data),
  create:      (body: { url: string; titleHint?: string; notes?: string }) =>
                 api.post<SourcingRequestRow>('/me/sourcing/requests', body).then((r) => r.data),
  quotes:      (id: string) => api.get<SourcingQuote[]>(`/me/sourcing/requests/${id}/quotes`).then((r) => r.data),
  selectQuote: (id: string, qid: string) =>
                 api.post<SourcingRequestRow>(`/me/sourcing/requests/${id}/select-quote/${qid}`).then((r) => r.data),
  // DROP-552: cancelar (soft) o eliminar definitivamente.
  cancel:      (id: string) =>
                 api.post<SourcingRequestRow>(`/me/sourcing/requests/${id}/cancel`).then((r) => r.data),
  remove:      (id: string) =>
                 api.delete(`/me/sourcing/requests/${id}`),
  agents:      () => api.get<AgentLite[]>('/me/sourcing/agents').then((r) => r.data),
  agentDetail: (id: string) => api.get<AgentFull>(`/me/sourcing/agents/${id}`).then((r) => r.data),
}

/* ============ DROP-8 Intelligence ============ */
export interface AdTrend { id: string; source: string; headline: string; productSlug?: string; impressions?: number; engagement?: number; score?: number; region?: string; capturedAt: string }
export interface WinningProduct { slug: string; title: string; monthlySales: number; trendScore?: number; mainImage?: string; price?: number }
export interface IntelAlert { id: string; keyword?: string; categoryId?: string; categoryName?: string; channel: string; thresholdScore?: number; active: boolean; createdAt: string }
export const intelApi = {
  adTrends:  (source?: string, limit = 30) => api.get<AdTrend[]>('/me/intelligence/ad-trends', { params: { source, limit } }).then((r) => r.data),
  // DROP-541: pasar lang para que titles/headlines vengan en el idioma activo.
  sales:     (categoryId?: string, limit = 20, lang = 'es') => api.get<WinningProduct[]>('/me/intelligence/sales-trends', { params: { categoryId, limit, lang } }).then((r) => r.data),
  winning:   (limit = 20, lang = 'es') => api.get<WinningProduct[]>('/me/intelligence/winning-products', { params: { limit, lang } }).then((r) => r.data),
  alerts:    () => api.get<IntelAlert[]>('/me/intelligence/alerts').then((r) => r.data),
  addAlert:  (body: { keyword?: string; categoryId?: string; channel?: string; thresholdScore?: number }) =>
               api.post<IntelAlert>('/me/intelligence/alerts', body).then((r) => r.data),
  delAlert:  (id: string) => api.delete(`/me/intelligence/alerts/${id}`),
}

/* ============ DROP-10 Academy / Mentors / Affiliates ============ */
export interface Course { id: string; slug: string; title: string; description?: string; instructor?: string; durationMinutes?: number; coverUrl?: string; videoUrl?: string; locale: string; level: string; createdAt: string }
export interface Enrollment { id: string; courseId: string; courseSlug: string; courseTitle: string; progressPct: number; completedAt?: string }
export interface Mentor { id: string; userId: string; displayName: string; headline: string; bio?: string; expertise: string[]; languages: string[]; hourlyRateUsdCents: number; timezone?: string; active: boolean }
export interface Booking { id: string; mentorId: string; mentorName: string; startsAt: string; durationMin: number; status: string; topic?: string }
export interface Affiliate { id: string; code: string; earningsUsdCents: number; payoutUsdCents: number; referralsCount: number; active: boolean }
export const academyApi = {
  courses:     (locale?: string, level?: string) => api.get<Course[]>('/storefront/academy/courses', { params: { locale, level } }).then((r) => r.data),
  course:      (slug: string) => api.get<Course>(`/storefront/academy/courses/${slug}`).then((r) => r.data),
  enrol:       (courseId: string) => api.post<Enrollment>(`/me/academy/enroll/${courseId}`).then((r) => r.data),
  mine:        () => api.get<Enrollment[]>('/me/academy/enrollments').then((r) => r.data),
  setProgress: (id: string, progressPct: number) =>
                 api.put<Enrollment>(`/me/academy/enrollments/${id}/progress`, { progressPct }).then((r) => r.data),
}
export const mentorsApi = {
  list:    () => api.get<Mentor[]>('/storefront/mentors').then((r) => r.data),
  detail:  (id: string) => api.get<Mentor>(`/storefront/mentors/${id}`).then((r) => r.data),
  book:    (body: { mentorId: string; startsAt: string; durationMin?: number; topic?: string }) =>
             api.post<Booking>('/me/mentors/bookings', body).then((r) => r.data),
  mine:    () => api.get<Booking[]>('/me/mentors/bookings').then((r) => r.data),
}
export const affiliateApi = {
  me: () => api.get<Affiliate>('/me/affiliate').then((r) => r.data),
}

/* ============ DROP-6 POD ============ */
export interface PodDesign { id: string; productId: string; productTitle: string; name: string; canvasJson: Record<string, unknown>; mockupUrl?: string; status: string; aiPrompt?: string; createdAt: string }
export const podApi = {
  // DROP-540: pasar lang para recibir el título traducido + imagen real.
  blanks:       (lang = 'es') =>
                  api.get<any[]>('/storefront/pod/blank-products', { params: { lang } }).then((r) => r.data),
  createDesign: (body: { productId: string; name: string; canvasJson?: Record<string, unknown>; aiPrompt?: string }) =>
                  api.post<PodDesign>('/me/pod/designs', body).then((r) => r.data),
  myDesigns:    () => api.get<PodDesign[]>('/me/pod/designs').then((r) => r.data),
  aiGenerate:   (prompt: string) => api.post<{ mockupUrl: string; prompt: string; provider: string }>('/me/pod/ai-generate', { prompt }).then((r) => r.data),
  deleteDesign: (id: string) => api.delete(`/me/pod/designs/${id}`).then((r) => r.status),
  renameDesign: (id: string, name: string) => api.put<PodDesign>(`/me/pod/designs/${id}`, null, { params: { name } }).then((r) => r.data),
}

/* ============ DROP-7 ODM ============ */
export interface OdmProject { id: string; kind: string; title: string; brief?: string; budgetUsdCents?: number; slaDays?: number; status: string; createdAt: string }
export const odmApi = {
  create:      (body: { kind: string; title: string; brief?: string; budgetUsdCents?: number }) =>
                 api.post<OdmProject>('/me/odm/projects', body).then((r) => r.data),
  mine:        () => api.get<OdmProject[]>('/me/odm/projects').then((r) => r.data),
  getById:     (id: string) => api.get<OdmProject>(`/me/odm/projects/${id}`).then((r) => r.data),
  update:      (id: string, body: { kind: string; title: string; brief?: string; budgetUsdCents?: number }) =>
                 api.put<OdmProject>(`/me/odm/projects/${id}`, body).then((r) => r.data),
  remove:      (id: string) => api.delete(`/me/odm/projects/${id}`).then((r) => r.status),
  adminList:   (status?: string) => api.get<OdmProject[]>('/admin/odm/projects', { params: { status } }).then((r) => r.data),
  adminUpdate: (id: string, status: string) =>
                 api.put<OdmProject>(`/admin/odm/projects/${id}/status`, { status }).then((r) => r.data),
}

/* ============ DROP-11 Tickets + Notifications ============ */
export interface SupportTicket { id: string; kind: 'SUPPORT' | 'DISPUTE'; subject: string; body?: string; orderId?: string; status: string; priority: string; resolution?: string; createdAt: string }
export interface NotificationRow { id: string; eventType: string; title: string; body?: string; channel: string; payload?: Record<string, unknown>; readAt?: string; createdAt: string }
export const supportApi = {
  open:     (body: { kind: 'SUPPORT' | 'DISPUTE'; subject: string; body?: string; orderId?: string; priority?: string }) =>
              api.post<SupportTicket>('/me/tickets', body).then((r) => r.data),
  mine:     () => api.get<SupportTicket[]>('/me/tickets').then((r) => r.data),
  admin:    (status?: string) => api.get<SupportTicket[]>('/admin/tickets', { params: { status } }).then((r) => r.data),
  resolve:  (id: string, resolution: string) =>
              api.put<SupportTicket>(`/admin/tickets/${id}/resolve`, { resolution }).then((r) => r.data),
}
export const notificationsApi = {
  list:       () => api.get<NotificationRow[]>('/me/notifications').then((r) => r.data),
  unread:     () => api.get<{ count: number }>('/me/notifications/unread-count').then((r) => r.data),
  markRead:   (id: string) => api.post(`/me/notifications/${id}/read`),
  markAll:    () => api.post('/me/notifications/read-all'),
}

/* ============ DROP-13 Warehouses + Shipping calc + ESG ============ */
export interface Warehouse { id: string; code: string; name: string; country: string; city?: string; active: boolean }
export interface StockRow { warehouseId: string; warehouseCode: string; country: string; stock: number }
export interface CalcRow { method: string; carrier: string; cost: number; transitMin: number; transitMax: number }
export interface EsgResponse { carbonKg: number; offsetUsd: number; greenestMethod: string }
export const warehouseApi = {
  list:           () => api.get<Warehouse[]>('/storefront/warehouses').then((r) => r.data),
  adminList:      () => api.get<Warehouse[]>('/admin/warehouses').then((r) => r.data),
  create:         (body: { code: string; name: string; country?: string; city?: string; active: boolean }) =>
                    api.post<Warehouse>('/admin/warehouses', body).then((r) => r.data),
  update:         (id: string, body: { code: string; name: string; country?: string; city?: string; active: boolean }) =>
                    api.put<Warehouse>(`/admin/warehouses/${id}`, body).then((r) => r.data),
  remove:         (id: string) => api.delete(`/admin/warehouses/${id}`).then((r) => r.status),
  productStock:   (productId: string) => api.get<StockRow[]>(`/storefront/catalog/products/${productId}/warehouse-stock`).then((r) => r.data),
  shippingCalc:   (body: { weightGrams: number; qty: number; country: string }) =>
                    api.post<CalcRow[]>('/storefront/shipping/calculator', body).then((r) => r.data),
  carbonFootprint: (body: { weightGrams: number; qty: number; country: string }) =>
                    api.post<EsgResponse>('/storefront/shipping/carbon-footprint', body).then((r) => r.data),
}
