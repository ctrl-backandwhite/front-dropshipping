import { api } from './client'

/** Resumen de ganancias del operador (acumulado en CNY). */
export interface OperatorEarningsSummary {
  operatorSubject: string
  operatorEmail?: string
  operatorName?: string
  operations: number
  totalCommissionCnyCents: number
  currency: string
  from: string
  to: string
}

/** Una operación del histórico. */
export interface OperatorAction {
  operatorSubject: string
  operatorEmail?: string
  operatorName?: string
  orderId: string
  orderNumber: string
  action: string
  commissionCnyCents: number
  itemCount: number
  processedAt: string
}

export interface OperatorActionPage {
  items: OperatorAction[]
  total: number
  page: number
  size: number
  currency: string
}

export interface OperatorReportRow {
  operatorSubject: string
  operatorEmail?: string
  operatorName?: string
  operations: number
  totalCommissionCnyCents: number
  currency: string
}

type DateRange = { from?: string; to?: string }

export const operatorApi = {
  // Área del propio operador (su acumulado + su histórico).
  myEarnings: (r: DateRange = {}) =>
    api.get<OperatorEarningsSummary>('/admin/operator/earnings', { params: r }).then((x) => x.data),
  myHistory: (r: DateRange & { page?: number; size?: number } = {}) =>
    api.get<OperatorActionPage>('/admin/operator/history', { params: r }).then((x) => x.data),
  // Reporte admin (agregado por operador + histórico global).
  adminReport: (r: DateRange = {}) =>
    api.get<OperatorReportRow[]>('/admin/operators/report', { params: r }).then((x) => x.data),
  adminHistory: (r: DateRange & { operator?: string; page?: number; size?: number } = {}) =>
    api.get<OperatorActionPage>('/admin/operators/history', { params: r }).then((x) => x.data),
}

/** Formatea céntimos de YUAN (CNY) → "¥ 12,34". */
export function formatCny(cents: number): string {
  return '¥ ' + (cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
