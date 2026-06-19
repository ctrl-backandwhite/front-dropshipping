import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCopy, faCheck, faTriangleExclamation, faHandshakeAngle, faPlus, faLink, faArrowPointer, faCartShopping,
  faMoneyBillTransfer,
} from '@fortawesome/free-solid-svg-icons'
import { affiliate, newsletter, AffiliateDashboard, ReferralCode } from '../../../api/affiliate'
import { useT } from '../../../store/locale'
import { useCurrencyStore } from '../../../store/currency'
import { useAuthStore } from '../../../store/auth'
import { toast } from '../../../store/toast'

const COMMISSION_BADGE: Record<string, string> = {
  PENDING: 'badge-warning', APPROVED: 'badge-info', PAID: 'badge-success', REJECTED: 'badge-ghost',
}

export default function AffiliatePage() {
  const t = useT()
  const qc = useQueryClient()
  const format = useCurrencyStore((s) => s.format)
  const role = useAuthStore((s) => s.user?.role)
  const isStaff = role === 'ADMIN' || role === 'OPERATOR'

  const { data, isLoading } = useQuery<AffiliateDashboard>({
    queryKey: ['affiliate-dashboard'],
    queryFn: affiliate.dashboard,
    enabled: !isStaff,
  })

  const addCode = useMutation({
    mutationFn: () => affiliate.addCode('Link'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['affiliate-dashboard'] }),
  })
  const joinMut = useMutation({
    mutationFn: () => affiliate.join(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['affiliate-dashboard'] }),
  })
  const payoutMut = useMutation({
    mutationFn: () => affiliate.requestPayout(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliate-dashboard'] }); toast.success(t('affiliate.payout.requested')) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? t('common.error')),
  })
  const [terms, setTerms] = useState(false)

  if (isStaff) {
    return (
      <div className="space-y-5 max-w-3xl">
        <header><h1>{t('affiliate.title')}</h1></header>
        <div className="alert alert-warning text-sm">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <span>{t('affiliate.staff_blocked')}</span>
        </div>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div className="space-y-3 max-w-4xl">{[...Array(3)].map((_, i) => <div key={i} className="card p-5"><div className="skeleton h-5 w-1/3 mb-3" /><div className="skeleton h-4 w-full" /></div>)}</div>
  }

  const ccy = data.stats.currency
  const money = (cents: number) => format(cents / 100, ccy)

  // DROP-650: explicit opt-in with terms acceptance before the dashboard is usable.
  if (!data.joined) {
    return (
      <div className="space-y-5 max-w-2xl">
        <header>
          <h1>{t('affiliate.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('affiliate.subtitle').replace('{pct}', String(data.commissionPercent))}</p>
        </header>
        <section className="card p-6 space-y-4">
          <h2 className="font-medium">{t('affiliate.join.how_title')}</h2>
          <ol className="text-sm text-ink-700 space-y-1 list-decimal pl-5">
            <li>{t('affiliate.join.step1')}</li>
            <li>{t('affiliate.join.step2').replace('{pct}', String(data.commissionPercent))}</li>
            <li>{t('affiliate.join.step3').replace('{n}', money(data.minPayoutCents))}</li>
          </ol>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>{t('affiliate.join.terms')}</span>
          </label>
          <button onClick={() => joinMut.mutate()} disabled={!terms || joinMut.isPending} className="btn btn-primary">
            <FontAwesomeIcon icon={faHandshakeAngle} /> {t('affiliate.join.cta')}
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <header>
        <h1>{t('affiliate.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('affiliate.subtitle').replace('{pct}', String(data.commissionPercent))}</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={faArrowPointer} label={t('affiliate.kpi.clicks')} value={String(data.stats.clicks)} />
        <Kpi icon={faCartShopping} label={t('affiliate.kpi.conversions')} value={String(data.stats.conversions)} />
        <Kpi icon={faHandshakeAngle} label={t('affiliate.kpi.approved')} value={money(data.stats.approvedCents)} tone="text-emerald-600" />
        <Kpi icon={faHandshakeAngle} label={t('affiliate.kpi.paid')} value={money(data.stats.paidCents)} />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-sm">{t('affiliate.codes.title')}</h2>
          <button onClick={() => addCode.mutate()} disabled={addCode.isPending} className="btn btn-outline btn-xs text-[12px]">
            <FontAwesomeIcon icon={faPlus} /> {t('affiliate.codes.add')}
          </button>
        </div>
        <div className="space-y-2">
          {data.codes.map((c) => <CodeRow key={c.id} code={c} />)}
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <p className="text-[12px] text-ink-500">{t('affiliate.pending')}: <strong className="text-amber-600">{money(data.stats.pendingCents)}</strong> · {t('affiliate.kpi.approved')}: <strong className="text-emerald-600">{money(data.stats.approvedCents)}</strong></p>
          {data.payoutRequested
            ? <span className="badge badge-info badge-sm">{t('affiliate.payout.pending')}</span>
            : <button onClick={() => payoutMut.mutate()} disabled={!data.canRequestPayout || payoutMut.isPending}
                      className="btn btn-outline btn-xs text-[12px] disabled:opacity-40"
                      title={data.canRequestPayout ? '' : t('affiliate.payout.min_hint').replace('{n}', money(data.minPayoutCents))}>
                <FontAwesomeIcon icon={faMoneyBillTransfer} /> {t('affiliate.payout.request')}
              </button>}
        </div>
      </section>

      <EmailPrefToggle />

      <section className="card overflow-hidden">
        <div className="card-header"><span>{t('affiliate.commissions.title')}</span></div>
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('affiliate.commissions.date')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('affiliate.commissions.base')}</th>
              <th className="px-4 py-2 font-medium text-right">%</th>
              <th className="px-4 py-2 font-medium text-right">{t('affiliate.commissions.amount')}</th>
              <th className="px-4 py-2 font-medium">{t('affiliate.commissions.status')}</th>
            </tr>
          </thead>
          <tbody>
            {data.recentCommissions.length ? data.recentCommissions.map((c) => (
              <tr key={c.id} className="border-t border-ink-100">
                <td className="px-4 py-2 text-[12px] text-ink-500">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 text-right">{money(c.baseAmountCents)}</td>
                <td className="px-4 py-2 text-right">{c.percentage}%</td>
                <td className="px-4 py-2 text-right font-medium">{money(c.amountCents)}</td>
                <td className="px-4 py-2"><span className={`badge badge-sm ${COMMISSION_BADGE[c.status] ?? 'badge-ghost'}`}>{t(`affiliate.commissions.st.${c.status}`)}</span></td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400 text-[13px]">{t('affiliate.commissions.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function EmailPrefToggle() {
  const t = useT()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['email-prefs'], queryFn: newsletter.getEmailPrefs })
  const mut = useMutation({
    mutationFn: (optOut: boolean) => newsletter.setEmailPrefs(optOut),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-prefs'] }),
  })
  if (!data) return null
  return (
    <label className="card p-3 flex items-center gap-3 text-[13px] cursor-pointer">
      <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={!data.marketingOptOut}
             onChange={(e) => mut.mutate(!e.target.checked)} />
      <span>{t('affiliate.email_pref')}</span>
    </label>
  )
}

function Kpi({ icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-500 flex items-center gap-1"><FontAwesomeIcon icon={icon} className="text-[10px]" /> {label}</div>
      <div className={`text-xl font-semibold mt-1 ${tone ?? ''}`}>{value}</div>
    </div>
  )
}

function CodeRow({ code }: { code: ReferralCode }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const fullUrl = `${window.location.origin}${code.url}`
  function copy() {
    navigator.clipboard?.writeText(fullUrl).then(() => {
      setCopied(true); toast.success(t('affiliate.codes.copied')); setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center gap-2 p-2 rounded-box bg-base-200/50 border border-base-200">
      <FontAwesomeIcon icon={faLink} className="text-ink-400 text-[12px]" />
      <code className="text-[12px] flex-1 truncate">{fullUrl}</code>
      <span className="text-[11px] text-ink-500 whitespace-nowrap">{code.clicks} {t('affiliate.codes.clicks')}</span>
      <button onClick={copy} className="btn btn-ghost btn-xs btn-square" title={t('affiliate.codes.copy')}>
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-success' : ''} />
      </button>
    </div>
  )
}
