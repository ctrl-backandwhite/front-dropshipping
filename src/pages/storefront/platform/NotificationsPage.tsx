import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faCheckDouble, faCircle, faPaperPlane, faXmark } from '@fortawesome/free-solid-svg-icons'
import { notificationsApi } from '../../../api/platform'
import { admin } from '../../../api/admin'
import { useT } from '../../../store/locale'
import { useAuthStore } from '../../../store/auth'
import { dialog } from '../../../store/dialog'

export default function NotificationsPage() {
  const t = useT()
  const qc = useQueryClient()
  const isStaff = useAuthStore((s) => s.user?.role === 'ADMIN' || s.user?.role === 'OPERATOR')
  const [send, setSend] = useState(false)
  const [form, setForm] = useState({ target: 'all', title: '', body: '' })
  const { data = [] } = useQuery({ queryKey: ['notif'], queryFn: notificationsApi.list })
  const markAll = useMutation({ mutationFn: notificationsApi.markAll, onSuccess: () => qc.invalidateQueries({ queryKey: ['notif'] }) })
  const markOne = useMutation({ mutationFn: (id: string) => notificationsApi.markRead(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['notif'] }) })
  const sendMut = useMutation({
    mutationFn: () => admin.sendNotification(form),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['notif'] })
      setSend(false); setForm({ target: 'all', title: '', body: '' })
      dialog.alert({ variant: 'success', message: t('notif.send.ok').replace('{n}', String(r.sent)) })
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('notif.send.error') }),
  })
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <header className="flex items-end justify-between gap-2 flex-wrap">
        <h1>{t('notif.title')}</h1>
        <div className="flex gap-2">
          {isStaff && (
            <button onClick={() => setSend(true)} className="btn btn-primary text-[12px]"><FontAwesomeIcon icon={faPaperPlane} /> {t('notif.send.btn')}</button>
          )}
          <button onClick={() => markAll.mutate()} className="btn btn-outline text-[12px]"><FontAwesomeIcon icon={faCheckDouble} /> {t('notif.mark_all_read')}</button>
        </div>
      </header>
      {send && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSend(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-md p-5 border border-base-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{t('notif.send.title')}</h3>
              <button onClick={() => setSend(false)} className="btn btn-ghost btn-sm btn-square"><FontAwesomeIcon icon={faXmark} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-ink-500 mb-1 block">{t('notif.send.target')}</label>
                <input className="input input-bordered input-sm w-full" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="all" />
                <p className="text-[11px] text-ink-400 mt-1">{t('notif.send.target_help')}</p>
              </div>
              <input className="input input-bordered input-sm w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('notif.send.title_ph')} />
              <textarea className="textarea textarea-bordered textarea-sm w-full h-24" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={t('notif.send.body_ph')} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSend(false)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
              <button onClick={() => sendMut.mutate()} disabled={!form.title.trim() || !form.body.trim() || sendMut.isPending} className="btn btn-primary btn-sm">
                <FontAwesomeIcon icon={faPaperPlane} /> {t('notif.send.send')}
              </button>
            </div>
          </div>
        </div>
      )}
      {data.length === 0 && (
        <div className="card p-10 text-center text-ink-500">
          <FontAwesomeIcon icon={faBell} className="text-3xl text-ink-300 mb-2" />
          <p>{t('notif.empty')}</p>
        </div>
      )}
      <div className="space-y-2">
        {data.map((n) => (
          <button key={n.id} onClick={() => !n.readAt && markOne.mutate(n.id)}
            className={`w-full text-left card p-3 flex items-start gap-3 hover:border-brand-300 ${n.readAt ? '' : 'border-l-4 border-l-brand-500'}`}>
            <FontAwesomeIcon icon={n.readAt ? faBell : faCircle} className={`text-[10px] mt-1.5 ${n.readAt ? 'text-ink-300' : 'text-brand-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-[13px]">{n.title}</span>
                <span className="text-[11px] text-ink-400">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              {n.body && <p className="text-[12px] text-ink-600 mt-1">{n.body}</p>}
              <span className="text-[10px] uppercase tracking-wider text-ink-400 mt-1 inline-block">{n.eventType}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
