import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { wallet } from '../../../api/wallet'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faArrowDown, faArrowUp, faRotateLeft, faGears } from '@fortawesome/free-solid-svg-icons'
import { useT, useLocaleStore } from '../../../store/locale'

const KIND_ICON: Record<string, any> = {
  DEPOSIT: faArrowDown, REFUND: faArrowDown, RELEASE: faArrowDown, ADJUSTMENT: faGears,
  PAYMENT: faArrowUp, HOLD: faRotateLeft, WITHDRAW: faArrowUp,
}
const KIND_COLOR: Record<string, string> = {
  DEPOSIT: 'text-emerald-600', REFUND: 'text-emerald-600', RELEASE: 'text-emerald-600',
  PAYMENT: 'text-red-600', WITHDRAW: 'text-red-600', HOLD: 'text-amber-600', ADJUSTMENT: 'text-indigo-600',
}

export default function WalletPage() {
  const t = useT()
  // El idioma va en la queryKey: el backend localiza las descripciones (X-Lang), así que al cambiar de
  // idioma se refetch y se ven traducidas.
  const lang = useLocaleStore((s) => s.locale)
  const { data: w } = useQuery({ queryKey: ['wallet'], queryFn: wallet.get })
  const { data: tx } = useQuery({ queryKey: ['wallet-tx', lang], queryFn: () => wallet.transactions(0, 20) })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card p-6 sm:p-8 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
        <div className="text-xs uppercase tracking-wider text-brand-100 opacity-80">{t('wallet.balance')}</div>
        <div className="mt-2 text-4xl sm:text-5xl font-medium">
          {w ? (w.balanceFormatted ?? `${w.displaySymbol}${w.balanceDisplay.toFixed(2)}`) : '—'}
          <span className="ml-2 text-base font-light text-brand-100">{w?.displayCurrency}</span>
        </div>
        <div className="mt-1 text-sm text-brand-100/80">
          {t('wallet.usd_canonical')}: <strong className="font-mono">{w?.balanceUsdFormatted ?? '—'}</strong>
          {w && w.holdUsdCents > 0 && <span className="ml-3">· {t('wallet.hold')}: {w.holdUsdFormatted}</span>}
        </div>
        <div className="mt-6 flex gap-2 flex-wrap">
          <Link to="/wallet/recharge" className="btn btn-primary bg-white text-brand-700 hover:bg-brand-50">
            <FontAwesomeIcon icon={faPlus} /> {t('wallet.recharge')}
          </Link>
          <Link to="/orders" className="btn btn-outline border-brand-200/40 text-white hover:bg-white/10">
            {t('wallet.view_orders')}
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header"><span>{t('wallet.transactions')}</span></div>
        <table className="data-table">
          <thead className="bg-ink-50">
            <tr className="text-left text-ink-500">
              <th className="px-4 py-2">{t('wallet.col.type')}</th>
              <th className="px-4 py-2">{t('wallet.col.amount')}</th>
              <th className="px-4 py-2">{t('wallet.col.balance_after')}</th>
              <th className="px-4 py-2 hidden sm:table-cell">{t('common.description')}</th>
              <th className="px-4 py-2 hidden md:table-cell">{t('common.date')}</th>
            </tr>
          </thead>
          <tbody>
            {tx?.items && tx.items.length > 0 ? tx.items.map((trx) => (
              <tr key={trx.id} className="border-t border-ink-100">
                <td className="px-4 py-2">
                  <FontAwesomeIcon icon={KIND_ICON[trx.kind] ?? faGears} className={`mr-1 ${KIND_COLOR[trx.kind] ?? 'text-ink-500'}`} />
                  <span className="text-xs uppercase font-medium">{trx.kind}</span>
                </td>
                <td className={`px-4 py-2 font-mono ${trx.amountUsdCents >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {trx.amountFormatted ?? `${trx.amountUsdCents >= 0 ? '+' : ''}$${(trx.amountUsdCents / 100).toFixed(2)}`}
                </td>
                <td className="px-4 py-2 font-mono">{trx.balanceAfterFormatted ?? `$${(trx.balanceAfterCents / 100).toFixed(2)}`}</td>
                <td className="px-4 py-2 hidden sm:table-cell text-ink-500 text-xs">{trx.description}</td>
                <td className="px-4 py-2 hidden md:table-cell text-ink-500 text-xs">{new Date(trx.createdAt).toLocaleString()}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">{t('wallet.transactions.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
