import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeadset } from '@fortawesome/free-solid-svg-icons'
import { operatorApi, formatCny } from '../../api/operator'
import { useT } from '../../store/locale'

function tt(t: (k: string) => string, key: string, fb: string): string {
  const v = t(key); return v === key ? fb : v
}

/** Reporte admin: operaciones procesadas y comisión (CNY) acumulada por cada operador (soporte). */
export default function AdminOperatorsPage() {
  const t = useT()
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)

  const { data: rows } = useQuery({
    queryKey: ['admin-operators', from, to], queryFn: () => operatorApi.adminReport({ from, to }),
  })
  const totalOps = (rows ?? []).reduce((s, r) => s + r.operations, 0)
  const totalCny = (rows ?? []).reduce((s, r) => s + r.totalCommissionCnyCents, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FontAwesomeIcon icon={faHeadset} className="text-primary" /> {tt(t, 'admin.operators.title', 'Operadores (soporte)')}
        </h1>
        <p className="text-sm text-base-content/60">{tt(t, 'admin.operators.subtitle', 'Operaciones procesadas con éxito y comisión acumulada por operador.')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 card bg-base-100 p-4">
        <label className="text-sm">{tt(t, 'operator.from', 'Desde')}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input input-bordered input-sm block mt-1" />
        </label>
        <label className="text-sm">{tt(t, 'operator.to', 'Hasta')}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input input-bordered input-sm block mt-1" />
        </label>
        <div className="ml-auto text-sm text-base-content/70">
          {tt(t, 'admin.operators.total', 'Total')}: <strong>{totalOps}</strong> {tt(t, 'admin.operators.ops', 'operaciones')} · <strong>{formatCny(totalCny)}</strong>
        </div>
      </div>

      <div className="card bg-base-100 overflow-hidden">
        <table className="table table-sm">
          <thead><tr>
            <th>{tt(t, 'admin.operators.operator', 'Operador')}</th>
            <th>{tt(t, 'admin.operators.operations', 'Operaciones')}</th>
            <th>{tt(t, 'admin.operators.commission', 'Comisión acumulada (CNY)')}</th>
          </tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.operatorSubject}>
                <td>
                  <div className="font-medium">{r.operatorName || r.operatorEmail || r.operatorSubject}</div>
                  {r.operatorEmail && <div className="text-[12px] text-base-content/50">{r.operatorEmail}</div>}
                </td>
                <td>{r.operations}</td>
                <td className="font-medium">{formatCny(r.totalCommissionCnyCents)}</td>
              </tr>
            ))}
            {(rows?.length ?? 0) === 0 && (
              <tr><td colSpan={3} className="text-center text-sm text-base-content/50 py-6">{tt(t, 'admin.operators.empty', 'Sin operaciones en este rango.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
