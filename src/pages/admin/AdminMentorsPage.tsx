import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPen, faTrash, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../../api/admin'
import { dialog } from '../../store/dialog'
import { useT } from '../../store/locale'

type Mentor = { id: string; userEmail: string; name: string; avatarUrl?: string; headline: string; bio: string;
  timezone: string; hourlyRateUsd: number; expertise: string[]; languages: string[]; active: boolean }

const EMPTY: any = { userEmail: '', headline: '', bio: '', timezone: '', hourlyRateUsd: '', expertise: '', languages: '', active: true }

/** DROP-692: gestión admin (CRUD) de mentores. El mentor se asocia a un usuario por email. */
export default function AdminMentorsPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data: mentors = [] } = useQuery({ queryKey: ['admin-mentors'], queryFn: () => admin.mentors() })
  const [editing, setEditing] = useState<any | null>(null)

  const save = useMutation({
    mutationFn: (m: any) => {
      const body = {
        ...m,
        hourlyRateUsd: m.hourlyRateUsd ? Number(m.hourlyRateUsd) : 0,
        expertise: typeof m.expertise === 'string' ? m.expertise.split(',').map((s: string) => s.trim()).filter(Boolean) : m.expertise,
        languages: typeof m.languages === 'string' ? m.languages.split(',').map((s: string) => s.trim()).filter(Boolean) : m.languages,
      }
      return m.id ? admin.updateMentor(m.id, body) : admin.createMentor(body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-mentors'] }); setEditing(null) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? 'Error' }),
  })
  const del = useMutation({
    mutationFn: (id: string) => admin.deleteMentor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-mentors'] }),
  })

  const inp = 'input input-bordered input-sm w-full'
  const lbl = 'text-[12px] font-medium text-ink-600 mb-1 block'

  function openEdit(m: Mentor) {
    setEditing({ ...m, expertise: (m.expertise ?? []).join(', '), languages: (m.languages ?? []).join(', '), hourlyRateUsd: String(m.hourlyRateUsd ?? '') })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('admin.mentors.title')}</h1>
          <p className="text-ink-500 text-sm">{t('admin.mentors.subtitle')}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          <FontAwesomeIcon icon={faPlus} /> {t('admin.mentors.new')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2">{t('admin.mentors.col.name')}</th>
              <th className="px-3 py-2">{t('admin.mentors.col.headline')}</th>
              <th className="px-3 py-2">{t('admin.mentors.col.rate')}</th>
              <th className="px-3 py-2 text-center">{t('admin.mentors.col.active')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(mentors as Mentor[]).map((m) => (
              <tr key={m.id} className="border-t border-ink-100">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-ink-100" />}
                    <div><div>{m.name}</div><div className="text-[11px] text-ink-400">{m.userEmail}</div></div>
                  </div>
                </td>
                <td className="px-3 py-2">{m.headline}</td>
                <td className="px-3 py-2">${m.hourlyRateUsd}/h</td>
                <td className="px-3 py-2 text-center"><FontAwesomeIcon icon={m.active ? faCheck : faXmark} className={m.active ? 'text-success' : 'text-ink-400'} /></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(m)} className="btn btn-ghost btn-xs btn-square" title={t('actions.edit')} aria-label={t('actions.edit')}><FontAwesomeIcon icon={faPen} /></button>
                  <button onClick={() => dialog.confirm({ variant: 'error', message: t('admin.mentors.delete_confirm') }).then((ok) => ok && del.mutate(m.id))} className="btn btn-ghost btn-xs btn-square text-error" title={t('actions.delete')} aria-label={t('actions.delete')}><FontAwesomeIcon icon={faTrash} /></button>
                </td>
              </tr>
            ))}
            {mentors.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-400 text-[12px]">{t('admin.mentors.empty')}</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto space-y-3">
            <h3 className="font-semibold text-lg">{editing.id ? t('actions.edit') : t('admin.mentors.new')}</h3>
            {!editing.id && (
              <div><label className={lbl}>{t('admin.mentors.user_email')} *</label><input className={inp} value={editing.userEmail} onChange={(e) => setEditing({ ...editing, userEmail: e.target.value })} placeholder="usuario@nx036.local" /></div>
            )}
            <div><label className={lbl}>{t('admin.mentors.col.headline')} *</label><input className={inp} value={editing.headline} onChange={(e) => setEditing({ ...editing, headline: e.target.value })} /></div>
            <div><label className={lbl}>Bio</label><textarea className="textarea textarea-bordered textarea-sm w-full h-20" value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={lbl}>{t('admin.mentors.col.rate')} (USD/h)</label><input type="number" step="0.01" className={inp} value={editing.hourlyRateUsd} onChange={(e) => setEditing({ ...editing, hourlyRateUsd: e.target.value })} /></div>
              <div><label className={lbl}>Zona horaria</label><input className={inp} value={editing.timezone} onChange={(e) => setEditing({ ...editing, timezone: e.target.value })} placeholder="Europe/Madrid" /></div>
            </div>
            <div><label className={lbl}>Especialidades (separadas por coma)</label><input className={inp} value={editing.expertise} onChange={(e) => setEditing({ ...editing, expertise: e.target.value })} placeholder="paid-ads, branding" /></div>
            <div><label className={lbl}>Idiomas (separados por coma)</label><input className={inp} value={editing.languages} onChange={(e) => setEditing({ ...editing, languages: e.target.value })} placeholder="es, en" /></div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="checkbox checkbox-sm" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> {t('admin.mentors.col.active')}</label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
              <button onClick={() => { if (!editing.headline.trim() || (!editing.id && !editing.userEmail.trim())) { dialog.alert({ variant: 'error', message: t('admin.mentors.required') }); return } save.mutate(editing) }} disabled={save.isPending} className="btn btn-primary btn-sm">{t('actions.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
