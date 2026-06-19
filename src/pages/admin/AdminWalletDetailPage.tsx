import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { admin } from '../../api/admin'
import { useT } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faWallet, faSliders, faClockRotateLeft, faLock, faCoins,
} from '@fortawesome/free-solid-svg-icons'
import { Pagination } from './AdminOrdersPage'
import { dialog } from '../../store/dialog'

const PAGE_SIZE = 30

/**
 * DROP-633: detalle de wallet del admin. Reemplaza el antiguo "Ir al usuario":
 * muestra saldo disponible / retenido / total, el historial de movimientos del
 * ledger (con saldo resultante por movimiento, persistido en balanceAfterCents)
 * y un modal de ajuste manual de saldo (importe con signo + motivo obligatorio).
 */
export default function AdminWalletDetailPage() {
  const t = useT()
  const { userId } = useParams()
  const format = useCurrencyStore((s) => s.format)
  const qc = useQueryClient()

  const [page, setPage] = useState(0)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const { data: w, isLoading } = useQuery({
    queryKey: ['admin-wallet-detail', userId],
    queryFn: () => admin.walletDetail(userId!),
    enabled: !!userId,
  })

  const { data: movements, isLoading: movLoading } = useQuery({
    queryKey: ['admin-wallet-movements', w?.id, page],
    queryFn: () => admin.walletMovements(w!.id, page, PAGE_SIZE),
    enabled: !!w?.id,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-wallet-detail', userId] })
    qc.invalidateQueries({ queryKey: ['admin-wallet-movements', w?.id] })
    qc.invalidateQueries({ queryKey: ['admin-wallets'] })
  }

  const adjustMut = useMutation({
    mutationFn: (vars: { amountCents: number; description: string }) =>
      admin.adjustWallet(userId!, vars),
    onSuccess: () => {
      invalidate()
      setAdjustOpen(false); setAmount(''); setReason('')
      dialog.alert({ variant: 'success', message: t('admin.wallets.adjust.ok') })
    },
    onError: (e: any) =>
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.wallets.adjust.error') }),
  })

  if (isLoading) return <div className="text-ink-500 text-sm">{t('common.loading')}</div>
  if (!w) {
    return (
      <div className="space-y-3">
        <Link to="/admin/wallets" className="text-brand-700 text-[12px]">
          <FontAwesomeIcon icon={faArrowLeft} /> {t('admin.wallets.detail.back')}
        </Link>
        <div className="card p-6 text-ink-500">{t('admin.wallets.detail.not_found')}</div>
      </div>
    )
  }

  const rows = movements?.items ?? []
  const pages = movements?.totalPages ?? 1
  const total = movements?.totalElements ?? 0

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/wallets" className="text-brand-700 text-[12px]">
          <FontAwesomeIcon icon={faArrowLeft} /> {t('admin.wallets.detail.back')}
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2">
            <FontAwesomeIcon icon={faWallet} className="text-brand-600" />
            {t('admin.wallets.detail.title')}
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            <span className="font-mono">{w.email}</span>
            {w.name ? <span className="text-ink-400"> · {w.name}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${w.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {t(`admin.wallets.status.${w.status}`)}
          </span>
          <button onClick={() => { setAdjustOpen(true); setAmount(''); setReason('') }}
                  className="btn btn-primary text-[12px]">
            <FontAwesomeIcon icon={faSliders} /> {t('admin.wallets.detail.adjust_cta')}
          </button>
        </div>
      </header>

      {/* Balance cards: available / held / total. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <FontAwesomeIcon icon={faCoins} /> {t('admin.wallets.detail.available')}
          </div>
          <div className="text-2xl font-semibold mt-1">{format(Number(w.availableUsd), 'USD')}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <FontAwesomeIcon icon={faLock} /> {t('admin.wallets.detail.held')}
          </div>
          <div className="text-2xl font-semibold mt-1 text-ink-600">{format(Number(w.holdUsd), 'USD')}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <FontAwesomeIcon icon={faWallet} /> {t('admin.wallets.detail.total')}
          </div>
          <div className="text-2xl font-semibold mt-1">{format(Number(w.balanceUsd), 'USD')}</div>
        </div>
      </div>

      {/* Movements / ledger. */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-100 text-[13px] font-medium">
          <FontAwesomeIcon icon={faClockRotateLeft} className="text-ink-400" />
          {t('admin.wallets.detail.movements')}
          <span className="text-[11px] text-ink-400 ml-auto font-normal">{total}</span>
        </div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.wallets.detail.col.date')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.wallets.detail.col.type')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.wallets.detail.col.amount')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.wallets.detail.col.reference')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.wallets.detail.col.balance')}</th>
            </tr>
          </thead>
          <tbody>
            {movLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-500 text-[12px]">{t('common.loading')}</td></tr>
            ) : rows.length > 0 ? rows.map((tx: any) => (
              <tr key={tx.id} className="border-t border-ink-100 hover:bg-ink-50/50 text-[12px]">
                <td className="px-4 py-2 text-ink-500 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 text-[11px] font-medium">
                    {t(`admin.wallets.kind.${tx.kind}`)}
                  </span>
                </td>
                <td className={`px-4 py-2 text-right font-mono ${tx.amountCents < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {tx.amountCents > 0 ? '+' : ''}{format(tx.amountCents / 100, 'USD')}
                </td>
                <td className="px-4 py-2 text-ink-600">{movementReference(tx, t)}</td>
                <td className="px-4 py-2 text-right font-mono text-ink-500">{format(tx.balanceAfterCents / 100, 'USD')}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-12 text-center">
                <FontAwesomeIcon icon={faClockRotateLeft} className="text-3xl text-ink-300 mb-2" />
                <div className="text-ink-600 font-medium">{t('admin.wallets.detail.movements_empty')}</div>
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} pages={Math.max(1, pages)} onPage={setPage} />

      {/* Manual adjustment modal. */}
      {adjustOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAdjustOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card bg-base-100 p-5 w-full max-w-md space-y-3">
            <h3 className="font-medium">{t('admin.wallets.adjust.title')}</h3>
            <p className="text-[12px] text-ink-500">{t('admin.wallets.adjust.body')}</p>
            <label className="text-xs text-ink-500">{t('admin.wallets.amount_usd')} ({t('admin.wallets.signed_hint')})</label>
            <input type="number" step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)}
                   className="input" placeholder="-10.00" autoFocus />
            <label className="text-xs text-ink-500">{t('admin.wallets.reason_required')}</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input"
                   placeholder={t('admin.wallets.adjust.reason_placeholder')} />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setAdjustOpen(false)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
              <button onClick={() => adjustMut.mutate({
                        amountCents: Math.round(parseFloat(amount || '0') * 100),
                        description: reason,
                      })}
                      disabled={!amount || parseFloat(amount) === 0 || !reason.trim() || adjustMut.isPending}
                      className="btn btn-primary text-[12px]">{t('admin.wallets.adjust.submit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// El ledger guarda la referencia de pedido en orderId; mostramos un texto
// legible. Si no hay pedido, caemos a la nota traducida del movimiento.
function movementReference(tx: any, t: (k: string) => string): string {
  if (tx.orderId) return t('admin.wallets.detail.order_ref').replace('{id}', String(tx.orderId).slice(0, 8))
  return translateNote(tx.description, t)
}

// DROP-547: el backend persiste notas en inglés; las traducimos al render.
function translateNote(note: string | null | undefined, t: (k: string) => string): string {
  if (!note) return '—'
  const orderMatch = note.match(/^Order\s+(.+)$/i)
  if (orderMatch) return t('admin.wallets.note.order').replace('{order}', orderMatch[1])
  const rechargeMatch = note.match(/^Wallet recharge via\s+(.+)$/i)
  if (rechargeMatch) {
    const method = rechargeMatch[1].toUpperCase()
    return t('admin.wallets.note.recharge').replace('{method}', t(`recharge.method.${method.toLowerCase()}`))
  }
  if (/^Hold for order/i.test(note))        return t('admin.wallets.note.hold')
  if (/^Refund/i.test(note))                return t('admin.wallets.note.refund')
  if (/^Admin manual top-up/i.test(note))   return t('admin.wallets.note.manual_topup')
  if (/^\[Adjustment]/i.test(note))         return t('admin.wallets.note.adjustment') + ': ' + note.replace(/^\[Adjustment]\s*/i, '')
  return note
}
