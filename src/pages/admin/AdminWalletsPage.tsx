import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { admin } from '../../api/admin'
import { useT } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWallet, faPlus, faSliders, faClockRotateLeft, faArrowRightToBracket } from '@fortawesome/free-solid-svg-icons'
import { SearchInput } from '../../components/SearchInput'
import { FilterBar, SelectFilter } from '../../components/FilterBar'
import { Pagination } from './AdminOrdersPage'
import { dialog } from '../../store/dialog'

const STATUSES = ['ACTIVE', 'FROZEN']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'BRL', 'MXN', 'CNY', 'JPY']
const PAGE_SIZE = 25

export default function AdminWalletsPage() {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  // DROP-463: la columna "Moneda" debe mostrar la divisa en la que se RENDERIZA el balance,
  // no el código del wallet (que internamente es siempre USD canon). format() convierte
  // USD → moneda activa del usuario, así que ambos campos deben ir coherentes.
  const displayCurrency = useCurrencyStore((s) => s.current)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  // DROP-438: modal state para depósito / ajuste / historial.
  const [modal, setModal] = useState<null | { kind: 'topup' | 'adjust' | 'history'; wallet: any }>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const qc = useQueryClient()
  const topupMut = useMutation({
    mutationFn: (vars: { userId: string; amountCents: number; description?: string }) =>
      admin.walletTopup(vars.userId, { amountCents: vars.amountCents, description: vars.description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-wallets'] })
      setModal(null); setAmount(''); setReason('')
      dialog.alert({ variant: 'success', message: t('admin.wallets.topup.ok') })
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.wallets.topup.error') }),
  })
  const adjustMut = useMutation({
    mutationFn: (vars: { userId: string; amountCents: number; description: string }) =>
      admin.walletAdjust(vars.userId, { amountCents: vars.amountCents, description: vars.description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-wallets'] })
      setModal(null); setAmount(''); setReason('')
      dialog.alert({ variant: 'success', message: t('admin.wallets.adjust.ok') })
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.wallets.adjust.error') }),
  })
  const { data: history } = useQuery({
    queryKey: ['admin-wallet-tx', modal?.wallet?.id],
    queryFn: () => admin.walletTx(modal!.wallet.id),
    enabled: modal?.kind === 'history' && !!modal?.wallet?.id,
  })

  const { data } = useQuery({
    queryKey: ['admin-wallets', q, status, currency, page],
    queryFn: () => admin.wallets({
      q: q || undefined,
      status: status ?? undefined,
      currency: currency ?? undefined,
      page, size: PAGE_SIZE,
    }),
  })

  const rows = data?.items ?? []
  const totalElements = data?.totalElements ?? 0
  const pages = data?.totalPages ?? 1

  const hasActive = !!(q || status || currency)
  const clear = () => { setQ(''); setStatus(null); setCurrency(null); setPage(0) }

  return (
    <div className="space-y-5">
      <header>
        <h1>{t('admin.wallets.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('admin.wallets.subtitle')}</p>
      </header>

      <FilterBar onClear={clear} hasActive={hasActive}>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(0) }}
                     placeholder={t('admin.wallets.search')} className="min-w-[320px]" />
        <SelectFilter label={t('admin.wallets.col.status')}
                      value={status}
                      options={STATUSES.map((s) => ({ value: s, label: t(`admin.wallets.status.${s}`) }))}
                      onChange={(v) => { setStatus(v); setPage(0) }}
                      placeholder={t('filters.all')} />
        <SelectFilter label={t('admin.wallets.col.currency')}
                      value={currency}
                      options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                      onChange={(v) => { setCurrency(v); setPage(0) }}
                      placeholder={t('filters.all')} />
        <span className="text-[11px] text-ink-400 ml-auto">{t('pagination.showing')} <strong>{rows.length}</strong> / {totalElements}</span>
      </FilterBar>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.wallets.col.email')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.wallets.col.name')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.wallets.col.balance')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.wallets.col.hold')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.wallets.col.currency')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.wallets.col.status')}</th>
              <th className="px-4 py-2 font-medium w-44">{t('admin.wallets.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((w: any) => (
              <tr key={w.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                <td className="px-4 py-2 text-[12px] font-mono">{w.email}</td>
                <td className="px-4 py-2 text-[12px]">{w.name ?? '—'}</td>
                <td className="px-4 py-2 text-right font-medium">{format(Number(w.balanceUsd), 'USD')}</td>
                <td className="px-4 py-2 text-right text-[12px] text-ink-500">
                  {w.holdUsd > 0 ? format(Number(w.holdUsd), 'USD') : '—'}
                </td>
                <td className="px-4 py-2 text-[12px] text-ink-500">{displayCurrency}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${w.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t(`admin.wallets.status.${w.status}`)}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {/* DROP-571: antes había dos botones (faWallet + faClockRotateLeft)
                      que ambos abrían el modal 'history', sin diferenciarse para
                      el operador. Dejamos un solo botón de historial — el resto
                      son acciones distintas. Tooltips nativos via title=. */}
                  <div className="flex gap-1">
                    {/* DROP-633: la acción principal ahora abre el detalle del wallet
                        (saldos + movimientos + ajuste), no redirige a /admin/users. */}
                    <Link to={`/admin/wallets/${w.userId}`}
                          className="btn btn-outline text-[11px]" title={t('admin.wallets.actions.enter')}>
                      <FontAwesomeIcon icon={faArrowRightToBracket} />
                    </Link>
                    <button onClick={() => { setModal({ kind: 'topup', wallet: w }); setAmount(''); setReason('') }}
                            className="btn btn-outline text-[11px]" title={t('admin.wallets.actions.topup')}>
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                    <button onClick={() => { setModal({ kind: 'adjust', wallet: w }); setAmount(''); setReason('') }}
                            className="btn btn-outline text-[11px]" title={t('admin.wallets.actions.adjust')}>
                      <FontAwesomeIcon icon={faSliders} />
                    </button>
                    <button onClick={() => setModal({ kind: 'history', wallet: w })}
                            className="btn btn-outline text-[11px]" title={t('admin.wallets.actions.history')}>
                      <FontAwesomeIcon icon={faClockRotateLeft} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-4 py-12 text-center">
                <FontAwesomeIcon icon={faWallet} className="text-3xl text-ink-300 mb-2" />
                <div className="text-ink-600 font-medium">{t('admin.wallets.empty.title')}</div>
                <div className="text-ink-500 text-[12px]">{t('admin.wallets.empty.body')}</div>
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} pages={Math.max(1, pages)} onPage={setPage} />

      {/* DROP-438: modales depósito / ajuste / historial. */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card bg-base-100 p-5 w-full max-w-md space-y-3">
            {modal.kind === 'topup' && (
              <>
                <h3 className="font-medium">{t('admin.wallets.topup.title')}</h3>
                <p className="text-[12px] text-ink-500">
                  {t('admin.wallets.topup.body')} <strong>{modal.wallet.email}</strong>
                </p>
                <label className="text-xs text-ink-500">{t('admin.wallets.amount_usd')}</label>
                <input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)}
                       className="input" placeholder="25.00" autoFocus />
                <label className="text-xs text-ink-500">{t('admin.wallets.note_optional')}</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input"
                       placeholder={t('admin.wallets.topup.note_placeholder')} />
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setModal(null)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
                  <button onClick={() => topupMut.mutate({
                            userId: modal.wallet.userId,
                            amountCents: Math.round(parseFloat(amount || '0') * 100),
                            description: reason || undefined,
                          })}
                          disabled={!amount || parseFloat(amount) <= 0 || topupMut.isPending}
                          className="btn btn-primary text-[12px]">{t('admin.wallets.topup.submit')}</button>
                </div>
              </>
            )}
            {modal.kind === 'adjust' && (
              <>
                <h3 className="font-medium">{t('admin.wallets.adjust.title')}</h3>
                <p className="text-[12px] text-ink-500">{t('admin.wallets.adjust.body')}</p>
                <label className="text-xs text-ink-500">{t('admin.wallets.amount_usd')} ({t('admin.wallets.signed_hint')})</label>
                <input type="number" step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)}
                       className="input" placeholder="-10.00" autoFocus />
                <label className="text-xs text-ink-500">{t('admin.wallets.reason_required')}</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input"
                       placeholder={t('admin.wallets.adjust.reason_placeholder')} />
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setModal(null)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
                  <button onClick={() => adjustMut.mutate({
                            userId: modal.wallet.userId,
                            amountCents: Math.round(parseFloat(amount || '0') * 100),
                            description: reason,
                          })}
                          disabled={!amount || !reason.trim() || adjustMut.isPending}
                          className="btn btn-primary text-[12px]">{t('admin.wallets.adjust.submit')}</button>
                </div>
              </>
            )}
            {modal.kind === 'history' && (
              <>
                <h3 className="font-medium">{t('admin.wallets.history.title')} — {modal.wallet.email}</h3>
                <div className="max-h-80 overflow-y-auto overflow-x-auto">
                  <table className="table table-sm">
                    <thead className="text-[11px] text-ink-500"><tr>
                      <th className="text-left">{t('admin.wallets.history.col.kind')}</th>
                      <th className="text-right">{t('admin.wallets.history.col.amount')}</th>
                      <th className="text-right">{t('admin.wallets.history.col.balance')}</th>
                      <th className="text-left">{t('admin.wallets.history.col.note')}</th>
                      <th className="text-left">{t('admin.wallets.history.col.date')}</th>
                    </tr></thead>
                    <tbody>
                      {(history?.items ?? []).length > 0 ? history!.items.map((tx: any) => (
                        <tr key={tx.id} className="text-[11px]">
                          <td>{tx.kind}</td>
                          <td className="text-right font-mono">{format(tx.amountCents / 100, 'USD')}</td>
                          <td className="text-right font-mono text-ink-500">{format(tx.balanceAfterCents / 100, 'USD')}</td>
                          <td className="truncate max-w-xs">{translateNote(tx.description, t)}</td>
                          <td className="text-ink-500">{new Date(tx.createdAt).toLocaleString()}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="text-center py-6 text-ink-500 text-[12px]">{t('admin.wallets.history.empty')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setModal(null)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// DROP-547: el backend persiste notas en inglés ("Order NX-1234", "Wallet
// recharge via CARD"). Las traducimos al idioma activo del usuario al render.
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
  if (/^\[Adjustment]/i.test(note))         return t('admin.wallets.note.adjustment')
                                              + ': ' + note.replace(/^\[Adjustment]\s*/i, '')
  return note
}
