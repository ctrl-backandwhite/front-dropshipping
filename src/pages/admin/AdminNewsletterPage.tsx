import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperPlane, faUsers, faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../../api/admin'
import { useT } from '../../store/locale'
import { dialog } from '../../store/dialog'

export default function AdminNewsletterPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['admin-newsletter'], queryFn: admin.newsletterOverview })
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const sendMut = useMutation({
    mutationFn: () => admin.sendNewsletter(subject.trim(), body.trim()),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin-newsletter'] })
      setSubject(''); setBody('')
      dialog.alert({ variant: 'success', message: t('admin.newsletter.sent').replace('{n}', String(r.recipients)) })
    },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })

  function send() {
    dialog.confirm({ message: t('admin.newsletter.confirm').replace('{n}', String(data?.subscribers ?? 0)) })
      .then((ok) => ok && sendMut.mutate())
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{t('admin.newsletter.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.newsletter.subtitle')}</p>
        </div>
        <div className="badge badge-lg badge-ghost gap-2"><FontAwesomeIcon icon={faUsers} /> {data?.subscribers ?? 0} {t('admin.newsletter.subscribers')}</div>
      </header>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h2 className="font-medium text-sm flex items-center gap-2"><FontAwesomeIcon icon={faEnvelopeOpenText} /> {t('admin.newsletter.compose')}</h2>
          <div>
            <label className="text-xs text-ink-500">{t('admin.newsletter.subject')}</label>
            <input className="input input-bordered w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('admin.newsletter.subject_ph')} />
          </div>
          <div>
            <label className="text-xs text-ink-500">{t('admin.newsletter.content')}</label>
            <textarea className="textarea textarea-bordered w-full h-48 text-[13px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('admin.newsletter.content_ph')} />
            <p className="text-[11px] text-ink-400 mt-1">{t('admin.newsletter.html_hint')}</p>
          </div>
          <div className="flex justify-end">
            <button onClick={send} disabled={!subject.trim() || !body.trim() || sendMut.isPending || (data?.subscribers ?? 0) === 0}
                    className="btn btn-primary btn-sm">
              <FontAwesomeIcon icon={faPaperPlane} /> {t('admin.newsletter.send')}
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-medium text-sm mb-2">{t('admin.newsletter.preview')}</h2>
          <div className="border border-ink-100 rounded-box p-4 bg-base-200/40 min-h-[12rem]">
            <div className="font-semibold mb-2">{subject || t('admin.newsletter.subject_ph')}</div>
            <div className="text-[13px] text-ink-700 prose-sm" dangerouslySetInnerHTML={{ __html: body || `<span class="text-ink-400">${t('admin.newsletter.content_ph')}</span>` }} />
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header"><span>{t('admin.newsletter.history')}</span></div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.newsletter.col.date')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.newsletter.col.subject')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.newsletter.col.recipients')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.newsletter.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.campaigns ?? []).length ? data!.campaigns.map((c: any) => (
              <tr key={c.id} className="border-t border-ink-100">
                <td className="px-4 py-2 text-[12px] text-ink-500">{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-2">{c.subject}</td>
                <td className="px-4 py-2 text-right">{c.recipients}</td>
                <td className="px-4 py-2"><span className="badge badge-success badge-sm">{c.status}</span></td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-400 text-[13px]">{t('admin.newsletter.empty')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  )
}
