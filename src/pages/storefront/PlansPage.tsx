import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { listPlans, subscribe, type Plan } from '../../api/billing'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { dialog } from '../../store/dialog'

export default function PlansPage() {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: listPlans })
  const mutation = useMutation({
    mutationFn: ({ plan }: { plan: Plan }) => subscribe(plan.code, period),
    onSuccess: (data) => {
      if (data.checkoutUrl?.startsWith('http')) {
        window.location.href = data.checkoutUrl
      } else {
        dialog.alert(t('plans.subscribed_dev'))
      }
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
          const isEnterprise = plan.code === 'ENTERPRISE'
          const isPopular = plan.position === 3
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
                      : format(cents / 100, 'USD')}
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

                <div className="card-actions mt-4">
                  <button
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ plan })}
                    className={`btn w-full ${isPopular ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {isEnterprise ? t('plans.contact_sales') : t('plans.choose')}
                  </button>
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
