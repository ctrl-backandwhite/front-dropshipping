import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWarehouse, faTruckFast, faLeaf } from '@fortawesome/free-solid-svg-icons'
import { warehouseApi, CalcRow, EsgResponse } from '../../../api/platform'
import { useT } from '../../../store/locale'
import { useCurrencyStore } from '../../../store/currency'

const COUNTRIES = ['ES','US','MX','BR','GB','DE','FR','IT','JP','CN']

export default function WarehousesPage() {
  const t = useT()
  // DROP-501: el calc devuelve cost en USD; convertimos a la divisa activa
  // del usuario (EUR, MXN, etc.) para no mostrar "$" cuando el store está en
  // otra moneda.
  const format = useCurrencyStore((s) => s.format)
  const { data: whs = [] } = useQuery({ queryKey: ['warehouses'], queryFn: warehouseApi.list })
  const [weight, setWeight] = useState('500')
  const [qty, setQty] = useState('1')
  const [country, setCountry] = useState('ES')
  const calc = useMutation<CalcRow[]>({
    mutationFn: () => warehouseApi.shippingCalc({ weightGrams: Number(weight), qty: Number(qty), country }),
  })
  const esg = useMutation<EsgResponse>({
    mutationFn: () => warehouseApi.carbonFootprint({ weightGrams: Number(weight), qty: Number(qty), country }),
  })
  return (
    <div className="space-y-5">
      <header><h1>{t('warehouses.title')}</h1><p className="text-sm text-ink-500 mt-1">{t('warehouses.subtitle')}</p></header>

      <section>
        {/* DROP-501: contador real basado en el endpoint en lugar del literal "12". */}
        <div className="text-[12px] text-ink-500 mb-2">
          {t('warehouses.count_label').replace('{n}', String(whs.length))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {whs.map((w) => (
            <div key={w.id} className="card p-4 text-center">
              <FontAwesomeIcon icon={faWarehouse} className="text-brand-500 text-lg" />
              <div className="font-medium text-[13px] mt-2">{w.name}</div>
              <div className="text-[11px] text-ink-500">{w.country} · {w.city}</div>
              <div className="text-[10px] font-mono text-ink-400 mt-1">{w.code}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h3 className="flex items-center gap-2"><FontAwesomeIcon icon={faTruckFast} className="text-brand-500" /> {t('shipping_calc.title')}</h3>
        <p className="text-[12px] text-ink-500 mt-1">{t('shipping_calc.subtitle')}</p>
        <form onSubmit={(e) => { e.preventDefault(); calc.mutate(); esg.mutate() }} className="grid sm:grid-cols-4 gap-3 mt-4">
          <div><label className="text-xs text-ink-500">{t('shipping_calc.weight')}</label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="input mt-1" /></div>
          <div><label className="text-xs text-ink-500">{t('shipping_calc.qty')}</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="input mt-1" /></div>
          <div><label className="text-xs text-ink-500">{t('shipping_calc.country')}</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="input mt-1">
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div className="flex items-end"><button className="btn btn-primary w-full">{t('shipping_calc.calc')}</button></div>
        </form>
        {calc.data && (
          <table className="w-full mt-4 text-sm">
            <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
              {/* DROP-538: traducir cabeceras de la calculadora de envío. */}
              <tr><th className="px-3 py-2 font-medium">{t('shipping_calc.col.method')}</th><th className="px-3 py-2 font-medium">{t('shipping_calc.col.carrier')}</th><th className="px-3 py-2 font-medium text-right">{t('shipping_calc.col.cost')}</th><th className="px-3 py-2 font-medium">{t('shipping_calc.col.eta')}</th></tr>
            </thead>
            <tbody>{calc.data.map((r) => (
              <tr key={r.method} className="border-t border-ink-100">
                <td className="px-3 py-2 font-medium">{r.method}</td>
                <td className="px-3 py-2">{r.carrier}</td>
                <td className="px-3 py-2 text-right font-medium">{format(Number(r.cost), 'USD')}</td>
                <td className="px-3 py-2 text-[12px] text-ink-500">{r.transitMin}-{r.transitMax}d</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {esg.data && (
          <div className="mt-4 card p-4 bg-emerald-50 border-emerald-100 flex items-center gap-3">
            <FontAwesomeIcon icon={faLeaf} className="text-emerald-700 text-lg" />
            <div className="text-[13px]">
              <strong>{Number(esg.data.carbonKg).toFixed(3)}</strong> {t('esg.kg_co2')} · {t('esg.offset')}: <strong>{format(Number(esg.data.offsetUsd), 'USD')}</strong> · {t('esg.greenest')}: <strong>{esg.data.greenestMethod}</strong>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
