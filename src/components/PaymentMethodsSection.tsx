import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { loadStripe } from '@stripe/stripe-js'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCreditCard, faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'
import { dialog } from '../store/dialog'
import * as billing from '../api/billing'

/**
 * Sección "Método de pago" del perfil: el usuario GUARDA su tarjeta con Stripe Elements (SetupIntent),
 * la lista, la marca por defecto o la borra. El navegador manda los datos de tarjeta a Stripe directo
 * (Elements); el backend solo guarda el id del PaymentMethod (pm_…). Si Stripe no está activo, no se pinta.
 */
export default function PaymentMethodsSection() {
  const t = useT()
  const qc = useQueryClient()

  const { data: config } = useQuery({ queryKey: ['billing-config'], queryFn: billing.billingConfig })
  const stripeEnabled = !!config?.enabled && !!config?.publishableKey
  const stripePromise = useMemo(
    () => (config?.publishableKey ? loadStripe(config.publishableKey) : null),
    [config?.publishableKey],
  )

  const { data: cards = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: billing.listPaymentMethods,
    enabled: stripeEnabled,
  })

  const setDefaultMut = useMutation({
    mutationFn: billing.setDefaultPaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
    onError: () => dialog.alert({ variant: 'error', message: t('profile.billing.error') }),
  })
  const deleteMut = useMutation({
    mutationFn: billing.deletePaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
    onError: () => dialog.alert({ variant: 'error', message: t('profile.billing.error') }),
  })

  if (!stripeEnabled) return null

  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2">
        <FontAwesomeIcon icon={faCreditCard} className="text-brand-600" /> {t('profile.section.billing')}
      </h3>
      <p className="text-[13px] text-ink-500 mt-1">{t('profile.billing.subtitle')}</p>

      <div className="space-y-2 mt-4">
        {cards.length === 0 && <p className="text-[13px] text-ink-400">{t('profile.billing.empty')}</p>}
        {cards.map((c) => (
          <div key={c.id} className="flex items-center justify-between border border-ink-100 rounded p-2.5">
            <span className="flex items-center gap-2 text-[13px]">
              <FontAwesomeIcon icon={faCreditCard} className="text-ink-400" />
              <span className="uppercase font-medium">{c.brand}</span> •••• {c.last4}
              <span className="text-ink-400">· {String(c.expMonth).padStart(2, '0')}/{c.expYear}</span>
              {c.isDefault && (
                <span className="badge bg-brand-50 text-brand-700">
                  <FontAwesomeIcon icon={faStar} className="mr-1" /> {t('profile.billing.default')}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {!c.isDefault && (
                <button onClick={() => setDefaultMut.mutate(c.id)} disabled={setDefaultMut.isPending}
                        className="btn btn-ghost btn-xs text-[12px]">{t('profile.billing.set_default')}</button>
              )}
              <button
                onClick={() => dialog.confirm({ message: t('profile.billing.delete_confirm'), variant: 'error' })
                  .then((ok) => ok && deleteMut.mutate(c.id))}
                disabled={deleteMut.isPending}
                className="btn btn-ghost btn-xs btn-square text-error" title={t('profile.billing.delete')}>
                <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {stripePromise && (
        <Elements stripe={stripePromise}>
          <AddCardForm onAdded={() => qc.invalidateQueries({ queryKey: ['payment-methods'] })} />
        </Elements>
      )}
    </section>
  )
}

/** Formulario de alta de tarjeta — debe vivir dentro de <Elements> para usar Stripe Elements. */
function AddCardForm({ onAdded }: { onAdded: () => void }) {
  const t = useT()
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!stripe || !elements) return
    const card = elements.getElement(CardElement)
    if (!card) return
    setBusy(true)
    setError('')
    try {
      const { clientSecret } = await billing.createSetupIntent()
      const result = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } })
      if (result.error) {
        setError(result.error.message || t('profile.billing.error'))
      } else {
        card.clear()
        onAdded()
      }
    } catch {
      setError(t('profile.billing.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-ink-100">
      <label className="text-[12px] text-ink-500">{t('profile.billing.add_card')}</label>
      <div className="border border-ink-200 rounded p-3 mt-1 bg-white">
        <CardElement options={{ hidePostalCode: true, style: { base: { fontSize: '14px' } } }} />
      </div>
      {error && <p className="text-error text-[12px] mt-1">{error}</p>}
      <div className="flex justify-end mt-2">
        <button onClick={submit} disabled={!stripe || busy} className="btn btn-primary btn-sm text-[12px]">
          <FontAwesomeIcon icon={faPlus} /> {busy ? t('profile.billing.saving') : t('profile.billing.save_card')}
        </button>
      </div>
    </div>
  )
}
