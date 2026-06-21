import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  listPlans, subscribeWithSavedCard, currentSubscription, cancelSubscription, type Plan,
} from '../../api/billing'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../store/locale'
import { dialog } from '../../store/dialog'

export default function PlansPage() {
  const t = useT()
  const qc = useQueryClient()
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: listPlans })
  // Suscripción vigente del usuario (null si no tiene / no logueado → la query falla en silencio).
  const { data: current } = useQuery({ queryKey: ['my-subscription'], queryFn: currentSubscription, retry: false })

  const subscribeMut = useMutation({
    mutationFn: ({ plan }: { plan: Plan }) => subscribeWithSavedCard(plan.code, period),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-subscription'] })
      dialog.alert({ variant: 'success', message: t('plans.subscribed_ok') })
    },
    onError: (e: any) => {
      const msg = e?.response?.status === 422 ? t('plans.need_card') : (e?.response?.data?.message ?? t('plans.error'))
      dialog.alert({ variant: 'error', message: msg })
    },
  })
  const cancelMut = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-subscription'] })
      dialog.alert({ variant: 'success', message: t('plans.canceled_ok') })
    },
  })

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">{t('plans.title')}</h1>
        <p className="opacity-70 mt-2">{t('plans.subtitle')}</p>
        <div className="join mt-4">
          {(['MONTHLY', 'YEARLY'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`btn btn-sm join-item ${period === p ? 'btn-primary' : 'btn-outline'}`}
            >
              {p === 'MONTHLY' ? t('plans.period.monthly') : t('plans.period.yearly')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const cents = period === 'MONTHLY' ? plan.priceMonthlyCents : plan.priceYearlyCents
          const priceFmt = period === 'MONTHLY' ? plan.displayMonthlyFormatted : plan.displayYearlyFormatted
          const isEnterprise = plan.code === 'ENTERPRISE'
          const isPopular = plan.position === 3
          const isCurrent = current?.planId === plan.id && current?.status === 'ACTIVE'
          return (
            <div key={plan.id} className={`card bg-base-100 ${isPopular ? 'border-2 border-primary shadow-lg' : 'card-border'} relative`}>
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge badge-primary">{t('plans.popular') === 'plans.popular' ? 'Popular' : t('plans.popular')}</span>
                </div>
              )}
              <div className="card-body">
                <h3 className="card-title">{localized(t, `plans.name.${plan.code}`, plan.name)}</h3>
                <p className="text-sm opacity-70 min-h-[2.5rem]">{localized(t, `plans.description.${plan.code}`, plan.description)}</p>
                <div className="mt-2 text-3xl font-bold">
                  {isEnterprise
                    ? t('plans.custom')
                    : cents === 0
                      ? t('plans.free')
                      : (priceFmt ?? '—')}
                  <span className="text-sm opacity-60 ml-1">
                    {cents > 0 && (period === 'MONTHLY' ? t('plans.per_month') : t('plans.per_year'))}
                  </span>
                </div>

                <ul className="text-sm space-y-1.5 mt-5">
                  {Object.entries(plan.limits || {}).map(([k, v]) => (
                    <li key={k} className="flex items-start gap-2">
                      <FontAwesomeIcon icon={faCheck} className="text-success mt-1" />
                      <span>
                        <strong>{v.toLocaleString()}</strong> {t(`plans.feature.${k}`) === `plans.feature.${k}` ? k.replace(/_/g, ' ') : t(`plans.feature.${k}`)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="card-actions mt-4 flex-col">
                  {isEnterprise ? (
                    <button className={`btn w-full ${isPopular ? 'btn-primary' : 'btn-outline'}`}>{t('plans.contact_sales')}</button>
                  ) : isCurrent ? (
                    <>
                      <button disabled className="btn w-full btn-success btn-outline">{t('plans.current')}</button>
                      <button
                        disabled={cancelMut.isPending}
                        onClick={() => dialog.confirm({ message: t('plans.cancel_confirm'), variant: 'error' }).then((ok) => ok && cancelMut.mutate())}
                        className="btn btn-ghost btn-sm w-full text-error">{t('plans.cancel')}</button>
                    </>
                  ) : (
                    <button
                      disabled={subscribeMut.isPending}
                      onClick={() => subscribeMut.mutate({ plan })}
                      className={`btn w-full ${isPopular ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {t('plans.choose')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Fall back to the backend-provided string when no localized key exists.
function localized(t: (k: string) => string, key: string, fallback?: string | null): string {
  const v = t(key)
  return v === key ? (fallback ?? '') : v
}
