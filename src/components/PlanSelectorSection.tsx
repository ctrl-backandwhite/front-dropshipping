import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'
import { dialog } from '../store/dialog'
import * as billing from '../api/billing'

/**
 * Contratación de planes DENTRO del perfil del usuario: lista los planes (precios públicos ya
 * convertidos por el backend) con selector mensual/anual y permite contratar/cambiar cobrando con
 * la tarjeta guardada. La página pública /pricing solo muestra precios; aquí se contrata.
 * Si Stripe no está activo, no se pinta.
 */
export default function PlanSelectorSection() {
  const t = useT()
  const qc = useQueryClient()
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')

  const { data: config } = useQuery({ queryKey: ['billing-config'], queryFn: billing.billingConfig })
  const enabled = !!config?.enabled
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: billing.listPlans, enabled })
  const { data: current } = useQuery({ queryKey: ['my-subscription'], queryFn: billing.currentSubscription, retry: false, enabled })

  const subscribeMut = useMutation({
    mutationFn: ({ code }: { code: string }) => billing.subscribeWithSavedCard(code, period),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-subscription'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      dialog.alert({ variant: 'success', message: t('plans.subscribed_ok') })
    },
    onError: (e: any) => {
      const msg = e?.response?.status === 422 ? t('plans.need_card') : (e?.response?.data?.message ?? t('plans.error'))
      dialog.alert({ variant: 'error', message: msg })
    },
  })

  if (!enabled) return null

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="flex items-center gap-2">
          <FontAwesomeIcon icon={faLayerGroup} className="text-brand-600" /> {t('profile.section.plans')}
        </h3>
        <div className="join">
          {(['MONTHLY', 'YEARLY'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`btn btn-xs join-item ${period === p ? 'btn-primary' : 'btn-outline'}`}
            >
              {p === 'MONTHLY' ? t('plans.period.monthly') : t('plans.period.yearly')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {plans.map((plan) => {
          const cents = period === 'MONTHLY' ? plan.priceMonthlyCents : plan.priceYearlyCents
          const priceFmt = period === 'MONTHLY' ? plan.displayMonthlyFormatted : plan.displayYearlyFormatted
          const isEnterprise = plan.code === 'ENTERPRISE'
          const isCurrent = current?.planId === plan.id && current?.status === 'ACTIVE'
          return (
            <div key={plan.id} className={`border rounded-md p-3 flex flex-col ${isCurrent ? 'border-brand-500' : 'border-ink-100'}`}>
              <div className="font-semibold text-sm">{localized(t, `plans.name.${plan.code}`, plan.name)}</div>
              <div className="text-xl font-bold mt-1">
                {isEnterprise ? t('plans.custom') : cents === 0 ? t('plans.free') : (priceFmt ?? '—')}
                <span className="text-[11px] opacity-60 ml-1">
                  {cents > 0 && (period === 'MONTHLY' ? t('plans.per_month') : t('plans.per_year'))}
                </span>
              </div>
              <div className="mt-3 mt-auto pt-3">
                {isEnterprise ? (
                  <a href="/connect" className="btn btn-outline btn-sm w-full">{t('plans.contact_sales')}</a>
                ) : isCurrent ? (
                  <button disabled className="btn btn-success btn-outline btn-sm w-full">{t('plans.current')}</button>
                ) : (
                  <button
                    disabled={subscribeMut.isPending}
                    onClick={() => subscribeMut.mutate({ code: plan.code })}
                    className="btn btn-primary btn-sm w-full"
                  >
                    {current ? t('plans.switch') : t('plans.choose')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-ink-400 mt-3">{t('profile.plans.hint')}</p>
    </section>
  )
}

// Usa la traducción si existe; si falta la clave, cae al texto que da el backend.
function localized(t: (k: string) => string, key: string, fallback?: string | null): string {
  const v = t(key)
  return v === key ? (fallback ?? '') : v
}
