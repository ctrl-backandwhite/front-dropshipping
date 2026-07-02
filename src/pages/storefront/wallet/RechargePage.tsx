import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { wallet, RechargeResponse } from '../../../api/wallet'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPaypal, faBitcoin,
} from '@fortawesome/free-brands-svg-icons'
import {
  faChevronRight, faCircleCheck, faClipboard, faTriangleExclamation, faCreditCard,
} from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../../store/locale'
import { useCurrencyStore } from '../../../store/currency'

type Method = 'CARD' | 'PAYPAL' | 'USDT'
const METHOD_ICON: Record<Method, any> = { CARD: faCreditCard, PAYPAL: faPaypal, USDT: faBitcoin }
const METHOD_KEYS: { code: Method; labelKey: string; descKey: string }[] = [
  { code: 'CARD',   labelKey: 'recharge.method.card',   descKey: 'recharge.method.card_desc' },
  { code: 'PAYPAL', labelKey: 'recharge.method.paypal', descKey: 'recharge.method.paypal_desc' },
  // USDT oculto temporalmente (la maquinaria on-chain se conserva más abajo para reactivarlo).
  // { code: 'USDT',   labelKey: 'recharge.method.usdt',   descKey: 'recharge.method.usdt_desc' },
]
const CHAINS = ['TRC20', 'ERC20', 'BEP20']

export default function RechargePage() {
  const t = useT()
  // La recarga trabaja SIEMPRE en la divisa activa de la web (la del selector superior). El importe se
  // introduce en esa divisa y el BACKEND hace todos los cálculos (USD canónico + moneda de cobro).
  const displayCurrency = useCurrencyStore((s) => s.current)
  const [amountInput, setAmountInput] = useState<string>('')
  const displayAmount = parseFloat(amountInput) || 0
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [method, setMethod] = useState<Method>('CARD')
  const [chain, setChain] = useState<string>('TRC20')
  const [result, setResult] = useState<RechargeResponse | null>(null)
  const [confirming, setConfirming] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Presets redondeados por el backend en la divisa activa (el front solo los pinta).
  const { data: options } = useQuery({
    queryKey: ['recharge-options', displayCurrency],
    queryFn: () => wallet.rechargeOptions(displayCurrency),
  })

  // El backend deriva el USD canónico y la moneda de cobro a partir del importe en divisa activa.
  const start = useMutation({
    mutationFn: () => wallet.recharge({
      method,
      currencyDisplay: displayCurrency,
      amountDisplay: displayAmount,
      cryptoChain: method === 'USDT' ? chain : undefined,
    }),
    onSuccess: (r) => {
      // Tarjeta y PayPal → Checkout hospedado: redirigimos a la pasarela segura. Al volver, la página
      // /wallet/recharge/return confirma el cobro y acredita el saldo. USDT (u otros) muestran el paso 3.
      if (r.approveUrl) { window.location.href = r.approveUrl; return }
      setResult(r); setStep(3)
    },
  })

  function next(e: FormEvent) { e.preventDefault(); setStep(2) }
  function back() { setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s)) }

  async function confirmMock() {
    if (!result) return
    setConfirming(true)
    try {
      await wallet.confirmMock(result.paymentId)
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['wallet-tx'] })
      navigate('/wallet?recharged=1')
    } finally {
      setConfirming(false)
    }
  }

  const stepLabels = [t('recharge.step.method'), t('recharge.step.amount'), t('recharge.step.confirm')]

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <header>
        <h1>{t('recharge.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('recharge.subtitle')}</p>
      </header>

      <ol className="flex items-center gap-2 text-xs">
        {stepLabels.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] font-medium ${
              step > i + 1 ? 'bg-emerald-500 text-white'
                : step === i + 1 ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500'
            }`}>{step > i + 1 ? '✓' : i + 1}</span>
            <span className={step >= i + 1 ? 'text-ink-900 font-medium' : 'text-ink-500'}>{label}</span>
            {i < 2 && <FontAwesomeIcon icon={faChevronRight} className="text-ink-300" />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <form onSubmit={next} className="space-y-3">
          {METHOD_KEYS.map((m) => (
            <label key={m.code}
                   className={`card p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                     method === m.code ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-ink-300'
                   }`}>
              <input type="radio" name="method" value={m.code} checked={method === m.code}
                     onChange={() => setMethod(m.code)} className="mt-1" />
              <FontAwesomeIcon icon={METHOD_ICON[m.code]} className="text-xl text-brand-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">{t(m.labelKey)}</div>
                <div className="text-xs text-ink-500">{t(m.descKey)}</div>
              </div>
            </label>
          ))}
          <button type="submit" className="btn btn-primary w-full">{t('common.next')}</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); start.mutate() }} className="space-y-4">
          <div className="card p-5">
            {/* La recarga se introduce en la divisa activa de la web; el importe y los presets vienen
                redondeados y formateados del backend. El wallet se acredita en USD canónico. */}
            <label className="text-xs text-ink-500">
              {t('recharge.amount.label').replace('USD', displayCurrency)}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-medium text-ink-500">{options?.symbol ?? displayCurrency}</span>
              <input type="number" min={0.01} step="0.01" placeholder="0"
                     value={amountInput} onChange={(e) => setAmountInput(e.target.value)}
                     className="input text-2xl flex-1 font-medium" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(options?.presets ?? []).map((p) => (
                <button key={p.amount} type="button" onClick={() => setAmountInput(String(p.amount))}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    displayAmount === p.amount ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 hover:bg-ink-50'
                  }`}>{p.formatted}</button>
              ))}
            </div>
          </div>

          {method === 'USDT' && (
            <div className="card p-5">
              <label className="text-xs text-ink-500">{t('recharge.chain.label')}</label>
              <div className="mt-1 flex gap-2 flex-wrap">
                {CHAINS.map((c) => (
                  <button key={c} type="button" onClick={() => setChain(c)}
                    className={`px-3 py-1.5 rounded-full text-xs border ${
                      chain === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 hover:bg-ink-50'
                    }`}>{c}</button>
                ))}
              </div>
              <p className="text-xs text-ink-500 mt-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 mr-1" />
                {t('recharge.chain.warning')}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={back} className="btn btn-outline">{t('common.back')}</button>
            <button type="submit" disabled={start.isPending || displayAmount <= 0} className="btn btn-primary flex-1">
              {start.isPending ? t('common.processing') : `${t('recharge.continue_with')} ${method}`}
            </button>
          </div>
        </form>
      )}

      {step === 3 && result && (
        <PaymentResult result={result} method={method} onConfirmMock={confirmMock} confirming={confirming} />
      )}
    </div>
  )
}

function PaymentResult({ result, method, onConfirmMock, confirming }: {
  result: RechargeResponse; method: Method; onConfirmMock: () => void; confirming: boolean;
}) {
  const t = useT()
  const isMock = result.provider === 'manual' || (result.clientSecret?.includes('mock')) || (result.approveUrl?.includes('mock=1'))
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 text-emerald-600 text-sm">
          <FontAwesomeIcon icon={faCircleCheck} /> {t('recharge.payment_started')}
        </div>
        <div className="mt-1 text-xs text-ink-500">ID: <span className="font-mono">{result.paymentId.slice(0, 8)}…</span></div>
        <div className="mt-3 text-xl font-medium">
          {result.chargeFormatted
            ? <>{result.chargeFormatted} <span className="text-sm text-ink-500">{result.chargeCurrency}</span></>
            : <>${(result.amountUsdCents / 100).toFixed(2)} <span className="text-sm text-ink-500">USD</span></>}
        </div>
        <div className="text-xs text-ink-500 mt-1">vía {result.provider} · {t('common.status').toLowerCase()} {result.status}</div>
      </div>

      {method === 'CARD' && (
        <div className="card p-5">
          <h3>{t('recharge.method.card')} (Stripe)</h3>
          {isMock ? (
            <>
              <p className="text-sm text-ink-500 mt-2">{t('recharge.stripe.mock')} {' '}
                <code>Stripe Elements</code> con <code>clientSecret={result.clientSecret?.slice(0, 24)}…</code></p>
              <button onClick={onConfirmMock} disabled={confirming} className="btn btn-primary mt-3 w-full">
                {confirming ? t('recharge.confirming') : t('recharge.stripe.simulate')}
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-500 mt-2">{t('recharge.stripe.live')}</p>
          )}
        </div>
      )}

      {method === 'PAYPAL' && (
        <div className="card p-5">
          <h3>PayPal</h3>
          {result.approveUrl && !isMock && (
            <a href={result.approveUrl} className="btn btn-primary w-full mt-3">{t('recharge.paypal.continue')}</a>
          )}
          {isMock && (
            <>
              <p className="text-sm text-ink-500 mt-2">{t('recharge.paypal.mock')} {' '}
                <code>{result.approveUrl?.slice(0, 40)}…</code></p>
              <button onClick={onConfirmMock} disabled={confirming} className="btn btn-primary mt-3 w-full">
                {confirming ? t('recharge.confirming') : t('recharge.paypal.simulate')}
              </button>
            </>
          )}
        </div>
      )}

      {method === 'USDT' && (
        <div className="card p-5 space-y-4">
          <h3>{t('recharge.usdt.send_to')}</h3>
          <div className="text-xs text-ink-500">{t('recharge.usdt.network')}: <strong>{result.cryptoChain}</strong></div>
          <div className="bg-ink-50 rounded p-3 break-all font-mono text-xs flex items-center gap-2">
            {result.cryptoAddress}
            <button onClick={() => navigator.clipboard.writeText(result.cryptoAddress ?? '')}
                    className="btn btn-ghost ml-auto p-1 text-ink-500">
              <FontAwesomeIcon icon={faClipboard} />
            </button>
          </div>
          {result.qrUrl && (
            <div className="flex justify-center">
              <img src={result.qrUrl} alt="QR" className="border border-ink-100 rounded p-2 bg-white" />
            </div>
          )}
          <div className="text-xs text-ink-500">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 mr-1" />
            {t('recharge.usdt.warning').replace('{chain}', result.cryptoChain ?? '')}
          </div>
          <button onClick={onConfirmMock} disabled={confirming} className="btn btn-outline w-full">
            {confirming ? t('recharge.usdt.verifying') : t('recharge.usdt.simulate')}
          </button>
        </div>
      )}

      <Link to="/wallet" className="btn btn-ghost block text-center">{t('recharge.back_to_wallet')}</Link>
    </div>
  )
}
