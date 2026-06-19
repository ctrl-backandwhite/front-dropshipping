import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSackDollar, faBoxesPacking, faReceipt } from '@fortawesome/free-solid-svg-icons'
import { operatorApi, formatCny } from '../../api/operator'
import { useT } from '../../store/locale'

/** i18n laxo: devuelve el fallback si la clave no está traducida aún. */
function tt(t: (k: string) => string, key: string, fb: string): string {
  const v = t(key); return v === key ? fb : v
}

/** Panel del operador (soporte): su comisión acumulada en CNY + histórico paginado por rango de fechas. */
export default function OperatorEarningsPage() {
  const t = useT()
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)
  const [page, setPage] = useState(0)
  const size = 20

  const { data: summary } = useQuery({
    queryKey: ['op-earnings', from, to], queryFn: () => operatorApi.myEarnings({ from, to }),
  })
  const { data: history } = useQuery({
    queryKey: ['op-history', from, to, page], queryFn: () => operatorApi.myHistory({ from, to, page, size }),
  })
  const totalPages = history ? Math.max(1, Math.ceil(history.total / size)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{tt(t, 'operator.earnings.title', 'Mis ganancias')}</h1>
        <p className="text-sm text-base-content/60">{tt(t, 'operator.earnings.subtitle', 'Comisión del 15% (en yuan) por cada orden que entregas.')}</p>
      </div>

      {/* Filtro de fechas */}
      <div className="flex flex-wrap items-end gap-3 card bg-base-100 p-4">
        <label className="text-sm">{tt(t, 'operator.from', 'Desde')}
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }} className="input input-bordered input-sm block mt-1" />
        </label>
        <label className="text-sm">{tt(t, 'operator.to', 'Hasta')}
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }} className="input input-bordered input-sm block mt-1" />
        </label>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card bg-base-100 p-5 flex-row items-center gap-4">
          <FontAwesomeIcon icon={faSackDollar} className="text-3xl text-primary" />
          <div>
            <div className="text-2xl font-semibold">{formatCny(summary?.totalCommissionCnyCents ?? 0)}</div>
            <div className="text-sm text-base-content/60">{tt(t, 'operator.earnings.accumulated', 'Comisión acumulada (CNY)')}</div>
          </div>
        </div>
        <div className="card bg-base-100 p-5 flex-row items-center gap-4">
          <FontAwesomeIcon icon={faBoxesPacking} className="text-3xl text-success" />
          <div>
            <div className="text-2xl font-semibold">{summary?.operations ?? 0}</div>
            <div className="text-sm text-base-content/60">{tt(t, 'operator.earnings.operations', 'Órdenes entregadas')}</div>
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="card bg-base-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-base-200 font-medium flex items-center gap-2">
          <FontAwesomeIcon icon={faReceipt} className="text-primary" /> {tt(t, 'operator.history.title', 'Histórico de operaciones')}
        </div>
        <table className="table table-sm">
          <thead><tr>
            <th>{tt(t, 'operator.history.order', 'Orden')}</th>
            <th>{tt(t, 'operator.history.items', 'Artículos')}</th>
            <th>{tt(t, 'operator.history.commission', 'Comisión (CNY)')}</th>
            <th>{tt(t, 'operator.history.date', 'Fecha')}</th>
          </tr></thead>
          <tbody>
            {(history?.items ?? []).map((a) => (
              <tr key={a.orderId}>
                <td className="font-mono text-[12px]">{a.orderNumber}</td>
                <td>{a.itemCount}</td>
                <td className="font-medium">{formatCny(a.commissionCnyCents)}</td>
                <td className="text-[12px] text-base-content/60">{new Date(a.processedAt).toLocaleString('es-ES')}</td>
              </tr>
            ))}
            {(history?.items?.length ?? 0) === 0 && (
              <tr><td colSpan={4} className="text-center text-sm text-base-content/50 py-6">{tt(t, 'operator.history.empty', 'Sin operaciones en este rango.')}</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-base-200 text-sm">
            <button disabled={page <= 0} onClick={() => setPage((p) => p - 1)} className="btn btn-xs btn-ghost">←</button>
            <span>{page + 1} / {totalPages}</span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn btn-xs btn-ghost">→</button>
          </div>
        )}
      </div>
    </div>
  )
}
