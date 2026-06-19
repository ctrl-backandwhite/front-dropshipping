import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faStar, faCheckCircle, faChevronRight, faTrashCan, faBan } from '@fortawesome/free-solid-svg-icons'
import { sourcingApi } from '../../../api/platform'
import { useT } from '../../../store/locale'
import { dialog } from '../../../store/dialog'

const TIER_COLOR: Record<string, string> = {
  STRATEGIC: 'bg-brand-100 text-brand-800',
  SENIOR:    'bg-emerald-100 text-emerald-700',
  MID:       'bg-amber-100 text-amber-700',
  JUNIOR:    'bg-ink-100 text-ink-700',
}

export default function SourcingPage() {
  const t = useT()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'requests' | 'agents'>('requests')

  return (
    <div className="space-y-5">
      <header>
        <h1>{t('sourcing.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('sourcing.subtitle')}</p>
      </header>

      <div className="flex gap-1 border-b border-ink-100">
        {(['requests', 'agents'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-[13px] -mb-px border-b-2 transition-colors ${
              tab === k ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-ink-500'
            }`}>{t(`sourcing.tab.${k}`)}</button>
        ))}
      </div>

      {tab === 'requests' && <RequestsTab qc={qc} t={t} />}
      {tab === 'agents'   && <AgentsTab t={t} />}
    </div>
  )
}

// DROP-662: solo URLs http(s) de marketplaces soportados.
const SUPPORTED_MARKETPLACE = /(1688\.com|taobao\.com|aliexpress\.com|ebay\.com|amazon\.)/i
function validateMarketplaceUrl(raw: string): 'invalid' | 'unsupported' | null {
  const u = raw.trim()
  let parsed: URL
  try { parsed = new URL(u) } catch { return 'invalid' }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'invalid'
  if (!SUPPORTED_MARKETPLACE.test(u)) return 'unsupported'
  return null
}

function RequestsTab({ qc, t }: any) {
  const { data: rows = [] } = useQuery({ queryKey: ['sourcing-reqs'], queryFn: sourcingApi.myRequests })
  const [show, setShow] = useState(false)
  const [url, setUrl] = useState('')
  const [hint, setHint] = useState('')
  const [notes, setNotes] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: () => sourcingApi.create({ url: url.trim(), titleHint: hint, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sourcing-reqs'] }); setShow(false); setUrl(''); setHint(''); setNotes(''); setUrlError(null) },
    onError: (e: any) => setUrlError(e?.response?.data?.message ?? t('sourcing.url.invalid')),
  })
  function submitCreate() {
    const v = validateMarketplaceUrl(url)
    if (v) { setUrlError(t(v === 'invalid' ? 'sourcing.url.invalid' : 'sourcing.url.unsupported')); return }
    setUrlError(null); create.mutate()
  }
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setShow(true)} className="btn btn-primary"><FontAwesomeIcon icon={faPlus} /> {t('sourcing.new')}</button>
      </div>
      {rows.length === 0 && <div className="card p-8 text-center text-ink-500">{t('sourcing.empty')}</div>}
      <div className="space-y-3">
        {rows.map((r: any) => <RequestCard key={r.id} req={r} t={t} qc={qc} />)}
      </div>
      {show && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md p-5">
            <h3>{t('sourcing.new')}</h3>
            <form onSubmit={(e) => { e.preventDefault(); submitCreate() }} className="space-y-3 mt-3">
              <div><label className="text-xs text-ink-500">{t('sourcing.url')}</label>
                <input required type="url" value={url}
                       onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(null) }}
                       placeholder={t('sourcing.url.placeholder')}
                       className={`input mt-1 ${urlError ? 'border-red-300' : ''}`} aria-invalid={!!urlError} />
                {urlError && <div className="text-[11px] text-red-600 mt-1">{urlError}</div>}</div>
              <div><label className="text-xs text-ink-500">{t('sourcing.title_hint')}</label>
                <input value={hint} onChange={(e) => setHint(e.target.value)} className="input mt-1" /></div>
              <div><label className="text-xs text-ink-500">{t('sourcing.notes')}</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input mt-1" rows={3} /></div>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShow(false)} className="btn btn-ghost">{t('common.cancel')}</button>
                <button type="submit" disabled={create.isPending} className="btn btn-primary">{create.isPending ? t('common.saving') : t('sourcing.new')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function RequestCard({ req, t, qc }: any) {
  const [open, setOpen] = useState(false)
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes', req.id], queryFn: () => sourcingApi.quotes(req.id), enabled: open })
  const select = useMutation({
    mutationFn: (qid: string) => sourcingApi.selectQuote(req.id, qid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sourcing-reqs'] }),
  })
  // DROP-552: cancelar (soft) o eliminar definitivamente la solicitud.
  const cancelMut = useMutation({
    mutationFn: () => sourcingApi.cancel(req.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sourcing-reqs'] }),
  })
  const deleteMut = useMutation({
    mutationFn: () => sourcingApi.remove(req.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sourcing-reqs'] }),
  })
  async function onDelete() {
    const ok = await dialog.confirm({
      title: t('sourcing.delete_title'),
      message: t('sourcing.delete_confirm'),
      variant: 'error',
      confirmLabel: t('actions.delete'),
    })
    if (ok) deleteMut.mutate()
  }
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* DROP-504: traducir badge + reforzar contraste sobre fondo neutro. */}
            <span className={`badge font-medium ${
              req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : req.status === 'QUOTING' ? 'bg-brand-50 text-brand-800 border border-brand-200'
              : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>{t(`sourcing.status.${req.status}`)}</span>
            {req.source && <span className="text-[11px] uppercase tracking-wider text-ink-500">{req.source}</span>}
            <span className="text-[11px] text-ink-400">{new Date(req.createdAt).toLocaleString()}</span>
          </div>
          <a href={req.sourceUrl} target="_blank" rel="noreferrer" className="text-[13px] text-brand-700 hover:underline break-all line-clamp-1">{req.sourceUrl}</a>
          {req.titleHint && <div className="text-[13px] mt-1">{req.titleHint}</div>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setOpen(!open)} className="btn btn-outline text-[11px]">
            {req.quotesCount} {t('sourcing.quotes')} <FontAwesomeIcon icon={faChevronRight} className={`text-[10px] ml-1 transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
          {/* DROP-552: cancelar (soft) si está activa, eliminar si ya está cancelada o sin cotizaciones. */}
          {req.status !== 'CANCELLED' && req.status !== 'APPROVED' && (
            <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}
                    className="btn btn-ghost btn-square text-[11px]" title={t('actions.cancel')}>
              <FontAwesomeIcon icon={faBan} />
            </button>
          )}
          <button onClick={onDelete} disabled={deleteMut.isPending}
                  className="btn btn-ghost btn-square text-[11px] text-error" title={t('actions.delete')}>
            <FontAwesomeIcon icon={faTrashCan} />
          </button>
        </div>
      </div>
      {open && quotes.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
          {quotes.map((q: any) => (
            <div key={q.id} className="flex items-center gap-3 text-[13px]">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{q.agent?.displayName ?? 'Agent'} <span className="text-[10px] text-ink-500">({q.agent?.tier})</span></div>
                {q.notes && <div className="text-[11px] text-ink-500 line-clamp-1">{q.notes}</div>}
              </div>
              <div className="text-right">
                <div className="font-medium">${(q.priceUsdCents/100).toFixed(2)}</div>
                <div className="text-[10px] text-ink-500">{t('sourcing.eta')} {q.etaDays}d</div>
              </div>
              {req.status !== 'APPROVED' && (
                <button onClick={() => select.mutate(q.id)} className="btn btn-outline text-[11px]">
                  <FontAwesomeIcon icon={faCheckCircle} /> {t('sourcing.select_quote')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AgentsTab({ t }: any) {
  const { data: agents = [] } = useQuery({ queryKey: ['sourcing-agents'], queryFn: sourcingApi.agents })
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {agents.map((a: any) => (
        <div key={a.id} className="card p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className={`badge ${TIER_COLOR[a.tier] ?? 'bg-ink-100 text-ink-700'}`}>{a.tier}</span>
            <span className="text-[12px] text-ink-700"><FontAwesomeIcon icon={faStar} className="text-amber-500 mr-1" /> {Number(a.satisfaction).toFixed(2)}</span>
          </div>
          <div className="font-medium">{a.displayName}</div>
          <div className="text-[11px] text-ink-500 mt-1">{a.completedJobs} {t('sourcing.agent_completed').toLowerCase()}</div>
        </div>
      ))}
    </div>
  )
}
