import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
  { code: 'USDT',   labelKey: 'recharge.method.usdt',   descKey: 'recharge.method.usdt_desc' },
]
const PRESETS = [10, 25, 50, 100, 250, 500]
const CHAINS = ['TRC20', 'ERC20', 'BEP20']

export default function RechargePage() {
  const t = useT()
  // DROP-535 (v2): selector multi-divisa real con conversión a USD canónico.
  const format = useCurrencyStore((s) => s.format)
  const displayCurrency = useCurrencyStore((s) => s.current)
  const currencies = useCurrencyStore((s) => s.currencies)
  const [inputCurrency, setInputCurrency] = useState<string>(displayCurrency || 'USD')
  const [amountInput, setAmountInput] = useState<string>('50')
  const usdAmount = (() => {
    const v = parseFloat(amountInput) || 0
    if (inputCurrency === 'USD') return v
    const cur = currencies.find((c) => c.code === inputCurrency)
    return v * (cur?.rateVsUsd ?? 1)
  })()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [method, setMethod] = useState<Method>('CARD')
  const [chain, setChain] = useState<string>('TRC20')
  const [result, setResult] = useState<RechargeResponse | null>(null)
  const [confirming, setConfirming] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()

  // DROP-535: el endpoint sigue requiriendo USD, así que convertimos antes del POST.
  const start = useMutation({
    mutationFn: () => wallet.recharge({ method, amountUsdCents: Math.round(usdAmount * 100), cryptoChain: method === 'USDT' ? chain : undefined }),
    onSuccess: (r) => { setResult(r); setStep(3); },
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
            {/* DROP-535 (v2): permitir al usuario elegir la divisa de entrada.
                El wallet se acredita siempre en USD canónico — convertimos en
                tiempo real lo que escribe. El selector arranca en la divisa
                display del usuario (EUR/MXN/etc.) para que coincida con lo que
                ve en el resto de la app. */}
            {/* DROP-557: el label decía siempre "Importe en USD" aunque el
                usuario seleccionara EUR/MXN/etc. — confunde porque el input
                está en la divisa elegida. Refleja la divisa activa. */}
            <label className="text-xs text-ink-500">
              {t('recharge.amount.label').replace('USD', inputCurrency)}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select value={inputCurrency} onChange={(e) => setInputCurrency(e.target.value)}
                      className="select select-bordered text-sm w-auto">
                {['USD','EUR','GBP','BRL','MXN','JPY','CNY','CAD'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input type="number" min={0.01} max={10000} step="0.01"
                     value={amountInput} onChange={(e) => setAmountInput(e.target.value)}
                     className="input text-2xl flex-1 font-medium" />
            </div>
            {inputCurrency !== 'USD' && amountInput && Number(amountInput) > 0 && (
              <div className="text-[11px] text-ink-500 mt-1">
                {t('recharge.charged_in_usd')}: <strong>{format(usdAmount, 'USD')}</strong>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => { setInputCurrency('USD'); setAmountInput(String(p)) }}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    inputCurrency === 'USD' && Number(amountInput) === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 hover:bg-ink-50'
                  }`}>${p}</button>
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
            <button type="submit" disabled={start.isPending || usdAmount < 1} className="btn btn-primary flex-1">
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
          ${(result.amountUsdCents / 100).toFixed(2)} <span className="text-sm text-ink-500">USD</span>
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
