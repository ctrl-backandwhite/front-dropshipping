import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrashCan, faFire } from '@fortawesome/free-solid-svg-icons'
import { intelApi } from '../../../api/platform'
import { useT, useLocaleStore } from '../../../store/locale'
import { useCurrencyStore } from '../../../store/currency'

const SOURCES = ['', 'tiktok', 'facebook', 'instagram', 'pinterest', 'youtube', 'amazon']

export default function IntelligencePage() {
  const t = useT()
  const [tab, setTab] = useState<'ads' | 'sales' | 'winning' | 'alerts'>('ads')
  return (
    <div className="space-y-5">
      <header>
        <h1>{t('intel.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('intel.subtitle')}</p>
      </header>
      <div className="flex gap-1 border-b border-ink-100">
        {(['ads', 'sales', 'winning', 'alerts'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-[13px] -mb-px border-b-2 transition-colors ${
              tab === k ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-ink-500'
            }`}>{t(`intel.tab.${k}`)}</button>
        ))}
      </div>
      {tab === 'ads'     && <AdsTab t={t} />}
      {tab === 'sales'   && <SalesTab t={t} />}
      {tab === 'winning' && <WinningTab t={t} />}
      {tab === 'alerts'  && <AlertsTab t={t} />}
    </div>
  )
}

function AdsTab({ t }: any) {
  const [src, setSrc] = useState('')
  const { data = [] } = useQuery({ queryKey: ['ads', src], queryFn: () => intelApi.adTrends(src || undefined, 50) })
  // DROP-243 — group by source for a sparkline-style summary.
  const bySource = (data as any[]).reduce<Record<string, { count: number; engagement: number }>>((acc, r) => {
    const k = r.source ?? '—'
    acc[k] = acc[k] ?? { count: 0, engagement: 0 }
    acc[k].count++
    acc[k].engagement += Number(r.engagement ?? 0)
    return acc
  }, {})
  const maxEngagement = Math.max(1, ...Object.values(bySource).map((b) => b.engagement))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(bySource).map(([source, b]) => (
          <button key={source} onClick={() => setSrc(source)}
                  className={`card p-3 text-left ${src === source ? 'border-brand-300 bg-brand-50' : ''}`}>
            <div className="text-[11px] uppercase tracking-wider text-ink-500">{source}</div>
            <div className="mt-1 text-lg font-medium">{b.count}</div>
            <div className="mt-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${(b.engagement / maxEngagement) * 100}%` }} />
            </div>
            <div className="text-[10px] text-ink-500 mt-0.5">{b.engagement.toLocaleString()} {t('intel.engagement')}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {SOURCES.map((s) => (
          <button key={s} onClick={() => setSrc(s)}
            className={`chip ${s === src ? 'chip-active' : ''}`}>
            {s || t('intel.all')}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 font-medium">{t('intel.col.source')}</th>
              <th className="px-3 py-2 font-medium">{t('intel.col.headline')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('intel.col.score')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('intel.col.engagement')}</th>
              <th className="px-3 py-2 font-medium">{t('intel.col.region')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                <td className="px-3 py-2 text-[11px] uppercase">{r.source}</td>
                <td className="px-3 py-2 text-[13px]">{r.productSlug ? <Link to={`/catalog/${r.productSlug}`} className="hover:text-brand-700">{r.headline}</Link> : r.headline}</td>
                {/* DROP-623: score is on a 0–1 scale; clamp + tolerate stray 0–100 data so it never shows 6000/100. */}
                <td className="px-3 py-2 text-right font-medium">{Math.min(100, Math.round((Number(r.score ?? 0) > 1 ? Number(r.score ?? 0) : Number(r.score ?? 0) * 100)))}/100</td>
                <td className="px-3 py-2 text-right text-[12px]">{(r.engagement ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-[12px] text-ink-500">{r.region ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SalesTab({ t }: any) {
  // DROP-541: incluir lang en queryKey + queryFn.
  const lang = useLocaleStore((s) => s.locale)
  const { data = [] } = useQuery({ queryKey: ['sales', lang], queryFn: () => intelApi.sales(undefined, 30, lang) })
  return <ProductGrid items={data} t={t} />
}
function WinningTab({ t }: any) {
  const lang = useLocaleStore((s) => s.locale)
  const { data = [] } = useQuery({ queryKey: ['winning', lang], queryFn: () => intelApi.winning(30, lang) })
  return <ProductGrid items={data} t={t} />
}
function ProductGrid({ items, t }: any) {
  // DROP-541: precio en moneda activa en lugar de $ fijo. CNY canon convertido.
  const format = useCurrencyStore((s) => s.format)
  void t
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {items.map((p: any) => (
        <Link key={p.slug} to={`/catalog/${p.slug}`} className="card overflow-hidden hover:border-brand-300">
          {p.mainImage && <img src={p.mainImage} className="aspect-square w-full object-cover" alt=""
                               onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
          <div className="p-2">
            <div className="text-[12px] line-clamp-2">{p.title}</div>
            <div className="text-[11px] text-ink-500 mt-1">
              <FontAwesomeIcon icon={faFire} className="text-amber-500 mr-1" />{p.monthlySales} · {Number(p.trendScore ?? 0).toFixed(2)}
            </div>
            {p.price != null && (
              <div className="text-[12px] font-medium text-brand-700 mt-1">{format(Number(p.price), 'CNY')}</div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function AlertsTab({ t }: any) {
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['intel-alerts'], queryFn: intelApi.alerts })
  const [kw, setKw] = useState('')
  // DROP-623: the threshold UI is on the same 0–100 scale shown for ad scores; we store it as 0–1.
  const [score, setScore] = useState('75')
  // DROP-666: the delivery channel is now selectable (was hardcoded to EMAIL).
  const [channel, setChannel] = useState('EMAIL')
  const add = useMutation({
    mutationFn: () => intelApi.addAlert({ keyword: kw, thresholdScore: Math.min(1, Math.max(0, Number(score) / 100)), channel }),
    onSuccess: () => { setKw(''); qc.invalidateQueries({ queryKey: ['intel-alerts'] }) },
  })
  const del = useMutation({ mutationFn: (id: string) => intelApi.delAlert(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['intel-alerts'] }) })
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); add.mutate() }} className="card p-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]"><label className="text-xs text-ink-500">{t('intel.alert.keyword')}</label>
          <input value={kw} onChange={(e) => setKw(e.target.value)} className="input mt-1" /></div>
        <div className="w-28"><label className="text-xs text-ink-500">{t('intel.alert.threshold')} (0–100)</label>
          <input type="number" step="5" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} className="input mt-1" /></div>
        <div className="w-32"><label className="text-xs text-ink-500">{t('intel.alert.channel')}</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="input mt-1">
            <option value="EMAIL">{t('intel.channel.EMAIL')}</option>
            <option value="IN_APP">{t('intel.channel.IN_APP')}</option>
            <option value="PUSH">{t('intel.channel.PUSH')}</option>
            <option value="WEBHOOK">{t('intel.channel.WEBHOOK')}</option>
          </select></div>
        <button type="submit" disabled={add.isPending} className="btn btn-primary"><FontAwesomeIcon icon={faPlus} /> {t('intel.add_alert')}</button>
      </form>
      {data.length === 0 && <div className="card p-8 text-center text-ink-500">{t('intel.empty.alerts')}</div>}
      <div className="space-y-2">
        {data.map((a) => (
          <div key={a.id} className="card p-3 flex items-center gap-3">
            <span className="badge bg-brand-50 text-brand-700">{a.channel}</span>
            <div className="flex-1 text-[13px]">{a.keyword ?? '—'} {a.thresholdScore != null && <span className="text-ink-500 text-[11px]">≥ {Math.round((Number(a.thresholdScore) > 1 ? Number(a.thresholdScore) : Number(a.thresholdScore) * 100))}/100</span>}</div>
            <button onClick={() => del.mutate(a.id)} className="btn btn-ghost text-red-600 text-[12px]"><FontAwesomeIcon icon={faTrashCan} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
