import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTicket } from '@fortawesome/free-solid-svg-icons'
import { supportApi } from '../../../api/platform'
import { useT } from '../../../store/locale'

// DROP-627: color semántico para estado y prioridad del ticket (antes ink plano).
const TICKET_STATUS_COLOR: Record<string, string> = {
  open:        'bg-amber-100 text-amber-700',
  in_progress: 'bg-brand-50 text-brand-700',
  pending:     'bg-amber-100 text-amber-700',
  resolved:    'bg-emerald-100 text-emerald-700',
  closed:      'bg-ink-100 text-ink-600',
}
const TICKET_PRIORITY_COLOR: Record<string, string> = {
  low:    'bg-ink-100 text-ink-600',
  normal: 'bg-ink-100 text-ink-600',
  medium: 'bg-sky-100 text-sky-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-rose-100 text-rose-700',
}
function pick(map: Record<string, string>, key: string): string {
  return map[key?.toLowerCase()] ?? 'bg-ink-100 text-ink-700'
}

export default function SupportPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['my-tickets'], queryFn: supportApi.mine })
  const [show, setShow] = useState(false)
  const [kind, setKind] = useState<'SUPPORT' | 'DISPUTE'>('SUPPORT')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const create = useMutation({
    mutationFn: () => supportApi.open({ kind, subject, body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tickets'] }); setShow(false); setSubject(''); setBody('') },
  })
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1>{t('support.title')}</h1><p className="text-sm text-ink-500 mt-1">{t('support.subtitle')}</p></div>
        <button onClick={() => setShow(true)} className="btn btn-primary"><FontAwesomeIcon icon={faPlus} /> {t('support.new')}</button>
      </header>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="flex gap-2"><div className="skeleton h-5 w-16" /><div className="skeleton h-5 w-16" /></div>
              <div className="skeleton h-4 w-2/3 mt-1" />
              <div className="skeleton h-3 w-full" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="card p-10 text-center text-ink-500">
          <FontAwesomeIcon icon={faTicket} className="text-3xl text-ink-300 mb-2" />
          <p>{t('support.empty')}</p>
        </div>
      ) : (
      <div className="space-y-2">
        {data.map((tk) => (
          <div key={tk.id} className="card p-4 transition-shadow hover:shadow-pastel-lg">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center flex-wrap gap-2">
                <span className={`badge ${tk.kind === 'DISPUTE' ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>{t(`support.kind.${tk.kind}`)}</span>
                <span className={`badge ${pick(TICKET_STATUS_COLOR, tk.status)}`}>{tk.status}</span>
                <span className={`badge ${pick(TICKET_PRIORITY_COLOR, tk.priority)}`}>{tk.priority}</span>
              </div>
              <span className="text-[11px] text-ink-400 whitespace-nowrap">{new Date(tk.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-[14px] font-medium mt-2">{tk.subject}</div>
            {tk.body && <p className="text-[13px] text-ink-700 mt-1 line-clamp-3">{tk.body}</p>}
            {tk.resolution && <p className="text-[12px] text-emerald-700 mt-2">→ {tk.resolution}</p>}
          </div>
        ))}
      </div>
      )}
      {show && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md p-5">
            <h3>{t('support.new')}</h3>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-3 mt-3">
              <div><label className="text-xs text-ink-500">{t('support.kind')}</label>
                <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="input mt-1">
                  <option value="SUPPORT">{t('support.kind.SUPPORT')}</option>
                  <option value="DISPUTE">{t('support.kind.DISPUTE')}</option>
                </select></div>
              <div><label className="text-xs text-ink-500">{t('support.subject')}</label>
                <input required value={subject} onChange={(e) => setSubject(e.target.value)} className="input mt-1" /></div>
              <div><label className="text-xs text-ink-500">{t('support.body')}</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="input mt-1" /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShow(false)} className="btn btn-ghost">{t('common.cancel')}</button>
                <button type="submit" disabled={create.isPending} className="btn btn-primary">{t('support.new')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
