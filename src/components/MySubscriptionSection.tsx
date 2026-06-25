import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileInvoice, faReceipt } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'
import { dialog } from '../store/dialog'
import * as billing from '../api/billing'

/**
 * Sección "Mi plan" del perfil: muestra la suscripción vigente (plan, estado, próxima renovación,
 * cancelar) y el historial de facturas de Stripe. Si Stripe no está activo o no hay suscripción ni
 * facturas, no se pinta nada.
 */
export default function MySubscriptionSection() {
  const t = useT()
  const qc = useQueryClient()

  const { data: config } = useQuery({ queryKey: ['billing-config'], queryFn: billing.billingConfig })
  const enabled = !!config?.enabled
  const { data: sub } = useQuery({ queryKey: ['my-subscription'], queryFn: billing.currentSubscription, retry: false, enabled })
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: billing.listPlans, enabled })
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: billing.listInvoices, retry: false, enabled })

  const cancelMut = useMutation({
    mutationFn: billing.cancelSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-subscription'] })
      dialog.alert({ variant: 'success', message: t('plans.canceled_ok') })
    },
  })

  if (!enabled || (!sub && invoices.length === 0)) return null

  const planName = sub ? (plans.find((p) => p.id === sub.planId)?.name ?? '—') : null
  const fmtDate = (epoch?: number | string) =>
    epoch ? new Date(typeof epoch === 'number' ? epoch * 1000 : epoch).toLocaleDateString() : '—'
  const fmtMoney = (cents?: number, cur?: string) =>
    cents == null ? '—' : `${(cents / 100).toFixed(2)} ${(cur ?? '').toUpperCase()}`

  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2">
        <FontAwesomeIcon icon={faReceipt} className="text-brand-600" /> {t('profile.section.subscription')}
      </h3>

      {sub ? (
        <div className="mt-3 border border-ink-100 rounded p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-[13px]">
            <span className="font-semibold">{planName}</span>
            <span className="badge bg-brand-50 text-brand-700 ml-2">{sub.status}</span>
            <span className="text-ink-400 ml-2">· {sub.billingPeriod}</span>
            <div className="text-ink-500 mt-0.5">
              {sub.cancelAt
                ? `${t('profile.subscription.cancels_on')} ${fmtDate(sub.cancelAt)}`
                : `${t('profile.subscription.renews_on')} ${fmtDate(sub.currentPeriodEnd)}`}
            </div>
          </div>
          {!sub.cancelAt && sub.status === 'ACTIVE' && (
            <button
              disabled={cancelMut.isPending}
              onClick={() => dialog.confirm({ message: t('plans.cancel_confirm'), variant: 'error' }).then((ok) => ok && cancelMut.mutate())}
              className="btn btn-ghost btn-sm text-error">{t('plans.cancel')}</button>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-ink-400 mt-2">{t('profile.subscription.none')}</p>
      )}

      {invoices.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[13px] font-medium text-ink-600 mb-2">{t('profile.subscription.invoices')}</h4>
          <div className="space-y-1">
            {invoices.map((inv, i) => (
              <div key={inv.number ?? i} className="flex items-center justify-between text-[12px] border-b border-ink-50 py-1.5">
                <span className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faFileInvoice} className="text-ink-400" />
                  {inv.number ?? '—'} · {fmtDate(inv.created)}
                  <span className="badge badge-sm">{inv.status}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium">{fmtMoney(inv.total, inv.currency)}</span>
                  {inv.pdfUrl && (
                    <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="link text-brand-600">PDF</a>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
