import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoneyBillTransfer, faCircleCheck, faBan, faGear, faClockRotateLeft, faXmark } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../../api/admin'
import { useT } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { dialog } from '../../store/dialog'

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-success', PENDING: 'badge-warning', SUSPENDED: 'badge-ghost',
}

export default function AdminAffiliatesPage() {
  const t = useT()
  const qc = useQueryClient()
  const format = useCurrencyStore((s) => s.format)
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['admin-affiliates'], queryFn: admin.affiliates })
  const { data: config } = useQuery({ queryKey: ['admin-affiliate-config'], queryFn: admin.affiliateConfig })
  const { data: payouts = [] } = useQuery({ queryKey: ['admin-affiliate-payouts'], queryFn: admin.affiliatePendingPayouts })
  const [cfgOpen, setCfgOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['admin-affiliates'] }); qc.invalidateQueries({ queryKey: ['admin-affiliate-payouts'] }) }
  const approvePayoutMut = useMutation({
    mutationFn: (id: string) => admin.approveAffiliatePayout(id),
    onSuccess: (r) => { invalidate(); dialog.alert({ variant: 'success', message: t('admin.affiliates.payout_done').replace('{n}', String(((r?.amountCents ?? 0) / 100).toFixed(2))) }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })
  const rejectPayoutMut = useMutation({
    mutationFn: (id: string) => admin.rejectAffiliatePayout(id),
    onSuccess: invalidate,
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => admin.setAffiliateStatus(id, status),
    onSuccess: invalidate,
  })
  const payoutMut = useMutation({
    mutationFn: (id: string) => admin.payoutAffiliate(id),
    onSuccess: (r) => { invalidate(); dialog.alert({ variant: r.paidCents > 0 ? 'success' : 'info', message: t('admin.affiliates.payout_done').replace('{n}', String((r.paidCents / 100).toFixed(2))) }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })
  const approveMut = useMutation({
    mutationFn: () => admin.approveDueCommissions(),
    onSuccess: (r) => { invalidate(); dialog.alert({ variant: 'success', message: t('admin.affiliates.approved_done').replace('{n}', String(r.approved)) }) },
  })

  const ccy = config?.currency ?? 'EUR'
  const money = (cents?: number) => format((cents ?? 0) / 100, ccy)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{t('admin.affiliates.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.affiliates.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending} className="btn btn-outline btn-sm text-[12px]">
            <FontAwesomeIcon icon={faClockRotateLeft} /> {t('admin.affiliates.approve_due')}
          </button>
          <button onClick={() => setCfgOpen(true)} className="btn btn-outline btn-sm text-[12px]">
            <FontAwesomeIcon icon={faGear} /> {t('admin.affiliates.config')}
          </button>
        </div>
      </header>

      {config && (
        <div className="text-[12px] text-ink-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>{t('admin.affiliates.cfg.default')}: <strong>{config.defaultPercent}%</strong></span>
          <span>{t('admin.affiliates.cfg.window')}: <strong>{config.attributionWindowDays}d</strong></span>
          <span>{t('admin.affiliates.cfg.return')}: <strong>{config.returnPeriodDays}d</strong></span>
          <span>{t('admin.affiliates.cfg.min')}: <strong>{money(config.minPayoutCents)}</strong></span>
        </div>
      )}

      {payouts.length > 0 && (
        <div className="card p-4 border-l-4 border-amber-400">
          <h2 className="font-medium text-sm mb-2">{t('admin.affiliates.payouts_pending')} ({payouts.length})</h2>
          <div className="space-y-2">
            {payouts.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 text-[13px] flex-wrap">
                <span className="font-medium">{money(p.amountCents)}</span>
                <span className="text-ink-500">· {p.commissionCount} {t('admin.affiliates.commissions')}</span>
                <span className="flex-1" />
                <button onClick={() => dialog.confirm({ message: t('admin.affiliates.payout_confirm').replace('{n}', money(p.amountCents)) }).then((ok) => ok && approvePayoutMut.mutate(p.id))}
                        className="btn btn-success btn-xs text-[12px]">{t('admin.affiliates.action.approve_pay')}</button>
                <button onClick={() => rejectPayoutMut.mutate(p.id)} className="btn btn-ghost btn-xs text-error text-[12px]">{t('admin.affiliates.action.reject')}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.affiliates.col.affiliate')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.affiliates.col.status')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.affiliates.col.codes')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.affiliates.col.clicks')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.affiliates.col.conversions')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.affiliates.col.cvr')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.affiliates.col.pending')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.affiliates.col.approved')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.affiliates.col.paid')}</th>
              <th className="px-4 py-2 font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => <tr key={i}><td colSpan={10} className="px-4 py-3"><div className="skeleton h-4 w-full" /></td></tr>)
            ) : rows.length ? rows.map((a: any) => (
              <tr key={a.id} className="border-t border-ink-100 hover:bg-ink-50/50 cursor-pointer" onClick={() => setDetailId(a.id)}>
                <td className="px-4 py-2">
                  <div className="font-medium text-[13px]">{a.name ?? '—'}</div>
                  <div className="text-[11px] text-ink-500 font-mono">{a.email ?? ''}</div>
                </td>
                <td className="px-4 py-2"><span className={`badge badge-sm ${STATUS_BADGE[a.status] ?? 'badge-ghost'}`}>{t(`admin.affiliates.status.${a.status}`)}</span></td>
                <td className="px-4 py-2 text-right">{a.codesCount}</td>
                <td className="px-4 py-2 text-right">{a.clicks ?? 0}</td>
                <td className="px-4 py-2 text-right">{a.referralsCount}</td>
                <td className="px-4 py-2 text-right text-[12px]">{a.clicks > 0 ? `${Math.round((a.referralsCount / a.clicks) * 100)}%` : '—'}</td>
                <td className="px-4 py-2 text-right text-amber-600">{money(a.pendingCents)}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{money(a.approvedCents)}</td>
                <td className="px-4 py-2 text-right">{money(a.paidCents)}</td>
                <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 flex-wrap">
                    {a.status !== 'ACTIVE' && (
                      <button onClick={() => statusMut.mutate({ id: a.id, status: 'ACTIVE' })} className="btn btn-ghost btn-xs btn-square text-emerald-600" title={t('admin.affiliates.action.activate')} aria-label={t('admin.affiliates.action.activate')}><FontAwesomeIcon icon={faCircleCheck} /></button>
                    )}
                    {a.status !== 'SUSPENDED' && (
                      <button onClick={() => statusMut.mutate({ id: a.id, status: 'SUSPENDED' })} className="btn btn-ghost btn-xs btn-square text-error" title={t('admin.affiliates.action.suspend')} aria-label={t('admin.affiliates.action.suspend')}><FontAwesomeIcon icon={faBan} /></button>
                    )}
                    <button onClick={() => dialog.confirm({ message: t('admin.affiliates.payout_confirm').replace('{n}', money(a.approvedCents)) }).then((ok) => ok && payoutMut.mutate(a.id))}
                            disabled={(a.approvedCents ?? 0) <= 0}
                            className="btn btn-ghost btn-xs btn-square text-brand-700 disabled:opacity-30" title={t('admin.affiliates.action.payout')} aria-label={t('admin.affiliates.action.payout')}><FontAwesomeIcon icon={faMoneyBillTransfer} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-500 text-[13px]">{t('filters.no_results')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {cfgOpen && config && <ConfigModal config={config} onClose={() => setCfgOpen(false)} />}
      {detailId && <DetailModal id={detailId} ccy={ccy} onClose={() => setDetailId(null)} />}
    </div>
  )
}

function ConfigModal({ config, onClose }: { config: any; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    defaultPercent: String(config.defaultPercent), attributionWindowDays: String(config.attributionWindowDays),
    returnPeriodDays: String(config.returnPeriodDays), minPayoutCents: String(config.minPayoutCents), currency: config.currency,
    maxCommissionPeriodCents: String(config.maxCommissionPeriodCents ?? 0),
  })
  const save = useMutation({
    mutationFn: () => admin.updateAffiliateConfig({
      defaultPercent: Number(form.defaultPercent), attributionWindowDays: Number(form.attributionWindowDays),
      returnPeriodDays: Number(form.returnPeriodDays), minPayoutCents: Number(form.minPayoutCents), currency: form.currency,
      maxCommissionPeriodCents: Number(form.maxCommissionPeriodCents),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-affiliate-config'] }); onClose() },
  })
  const field = (key: keyof typeof form, label: string, type = 'number') => (
    <div>
      <label className="text-xs text-ink-500">{label}</label>
      <input type={type} className="input input-bordered input-sm w-full" value={form[key]}
             onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-medium text-lg">{t('admin.affiliates.config')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {field('defaultPercent', t('admin.affiliates.cfg.default') + ' (%)')}
          {field('currency', t('admin.affiliates.cfg.currency'), 'text')}
          {field('attributionWindowDays', t('admin.affiliates.cfg.window') + ' (d)')}
          {field('returnPeriodDays', t('admin.affiliates.cfg.return') + ' (d)')}
          {field('minPayoutCents', t('admin.affiliates.cfg.min') + ' (cents)')}
          {field('maxCommissionPeriodCents', t('admin.affiliates.cfg.max') + ' (cents)')}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary btn-sm">{t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}

const COMMISSION_BADGE: Record<string, string> = {
  PENDING: 'badge-warning', APPROVED: 'badge-info', PAID: 'badge-success', REJECTED: 'badge-ghost', REVIEW: 'badge-error',
}

function DetailModal({ id, ccy, onClose }: { id: string; ccy: string; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const format = useCurrencyStore((s) => s.format)
  const money = (c?: number) => format((c ?? 0) / 100, ccy)
  const { data } = useQuery({ queryKey: ['admin-affiliate-detail', id], queryFn: () => admin.affiliateDetail(id) })
  const reviewMut = useMutation({
    mutationFn: ({ cid, approve }: { cid: string; approve: boolean }) => admin.resolveAffiliateReview(cid, approve),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-affiliate-detail', id] }); qc.invalidateQueries({ queryKey: ['admin-affiliates'] }) },
  })
  const row = data?.row
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-2xl space-y-3 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-lg">{row?.name ?? '—'}</h3>
            <div className="text-[12px] text-ink-500 font-mono">{row?.email}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-square"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        {row && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
            <Stat label={t('admin.affiliates.col.clicks')} value={String(row.clicks ?? 0)} />
            <Stat label={t('admin.affiliates.col.conversions')} value={String(row.referralsCount)} />
            <Stat label={t('admin.affiliates.col.approved')} value={money(row.approvedCents)} />
            <Stat label={t('admin.affiliates.col.paid')} value={money(row.paidCents)} />
          </div>
        )}
        <div>
          <h4 className="font-medium text-sm mb-1">{t('affiliate.codes.title')}</h4>
          <div className="space-y-1">
            {(data?.codes ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 text-[12px]">
                <code className="font-mono">{c.code}</code>
                <span className="text-ink-500">· {c.clicks} {t('affiliate.codes.clicks')}</span>
                {!c.active && <span className="badge badge-ghost badge-xs">off</span>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-medium text-sm mb-1">{t('affiliate.commissions.title')}</h4>
          <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead className="text-[11px] text-ink-500"><tr>
              <th className="px-2">{t('affiliate.commissions.date')}</th>
              <th className="px-2 text-right">{t('affiliate.commissions.amount')}</th>
              <th className="px-2">{t('affiliate.commissions.status')}</th>
              <th className="px-2"></th>
            </tr></thead>
            <tbody>
              {(data?.commissions ?? []).map((c: any) => (
                <tr key={c.id} className="text-[12px]">
                  <td className="px-2 text-ink-500">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-2 text-right font-medium">{money(c.amountCents)} <span className="opacity-50">({c.percentage}%)</span></td>
                  <td className="px-2"><span className={`badge badge-sm ${COMMISSION_BADGE[c.status] ?? 'badge-ghost'}`}>{t(`affiliate.commissions.st.${c.status}`)}</span></td>
                  <td className="px-2 text-right whitespace-nowrap">
                    {c.status === 'REVIEW' && (
                      <>
                        <button onClick={() => reviewMut.mutate({ cid: c.id, approve: true })} className="btn btn-ghost btn-xs text-emerald-600">{t('admin.affiliates.action.approve')}</button>
                        <button onClick={() => reviewMut.mutate({ cid: c.id, approve: false })} className="btn btn-ghost btn-xs text-error">{t('admin.affiliates.action.reject')}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {(data?.commissions ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-2 py-4 text-center text-ink-400 text-[12px]">{t('affiliate.commissions.empty')}</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-box bg-base-200/50 p-2"><div className="text-ink-500">{label}</div><div className="font-semibold text-sm">{value}</div></div>
}
