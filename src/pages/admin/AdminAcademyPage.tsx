import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPen, faTrash, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../../api/admin'
import { dialog } from '../../store/dialog'
import { useT } from '../../store/locale'

type Course = { id: string; slug: string; title: string; description: string; instructor: string;
  durationMinutes: number; coverUrl: string; videoUrl: string; locale: string; level: string; published: boolean }

const EMPTY: any = { title: '', description: '', instructor: '', durationMinutes: '', coverUrl: '', videoUrl: '', locale: 'es', level: 'BEGINNER', published: true }

/** DROP-691: gestión admin (CRUD) de cursos de Academia. */
export default function AdminAcademyPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data: courses = [] } = useQuery({ queryKey: ['admin-courses'], queryFn: () => admin.academyCourses() })
  const [editing, setEditing] = useState<any | null>(null)

  const save = useMutation({
    mutationFn: (c: any) => {
      const body = { ...c, durationMinutes: c.durationMinutes ? Number(c.durationMinutes) : undefined }
      return c.id ? admin.updateCourse(c.id, body) : admin.createCourse(body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-courses'] }); setEditing(null) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? 'Error' }),
  })
  const del = useMutation({
    mutationFn: (id: string) => admin.deleteCourse(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-courses'] }),
  })

  const inp = 'input input-bordered input-sm w-full'
  const lbl = 'text-[12px] font-medium text-ink-600 mb-1 block'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('admin.academy.title')}</h1>
          <p className="text-ink-500 text-sm">{t('admin.academy.subtitle')}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          <FontAwesomeIcon icon={faPlus} /> {t('admin.academy.new')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2">{t('admin.academy.col.title')}</th>
              <th className="px-3 py-2">{t('admin.academy.col.instructor')}</th>
              <th className="px-3 py-2">{t('admin.academy.col.level')}</th>
              <th className="px-3 py-2 text-center">{t('admin.academy.col.published')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(courses as Course[]).map((c) => (
              <tr key={c.id} className="border-t border-ink-100">
                <td className="px-3 py-2">{c.title}</td>
                <td className="px-3 py-2">{c.instructor || '—'}</td>
                <td className="px-3 py-2">{c.level}</td>
                <td className="px-3 py-2 text-center">
                  <FontAwesomeIcon icon={c.published ? faCheck : faXmark} className={c.published ? 'text-success' : 'text-ink-400'} />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setEditing({ ...c })} className="btn btn-ghost btn-xs btn-square" title={t('actions.edit')} aria-label={t('actions.edit')}><FontAwesomeIcon icon={faPen} /></button>
                  <button onClick={() => dialog.confirm({ variant: 'error', message: t('admin.academy.delete_confirm') }).then((ok) => ok && del.mutate(c.id))} className="btn btn-ghost btn-xs btn-square text-error" title={t('actions.delete')} aria-label={t('actions.delete')}><FontAwesomeIcon icon={faTrash} /></button>
                </td>
              </tr>
            ))}
            {courses.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-400 text-[12px]">{t('admin.academy.empty')}</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto space-y-3">
            <h3 className="font-semibold text-lg">{editing.id ? t('actions.edit') : t('admin.academy.new')}</h3>
            <div><label className={lbl}>{t('admin.academy.col.title')} *</label><input className={inp} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div><label className={lbl}>{t('admin.academy.col.instructor')}</label><input className={inp} value={editing.instructor} onChange={(e) => setEditing({ ...editing, instructor: e.target.value })} /></div>
            <div><label className={lbl}>Descripción</label><textarea className="textarea textarea-bordered textarea-sm w-full h-20" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className={lbl}>Duración (min)</label><input type="number" className={inp} value={editing.durationMinutes} onChange={(e) => setEditing({ ...editing, durationMinutes: e.target.value })} /></div>
              <div><label className={lbl}>{t('admin.academy.col.level')}</label>
                <select className="select select-bordered select-sm w-full" value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })}>
                  <option value="BEGINNER">BEGINNER</option><option value="INTERMEDIATE">INTERMEDIATE</option><option value="ADVANCED">ADVANCED</option>
                </select>
              </div>
              <div><label className={lbl}>Idioma</label><input className={inp} value={editing.locale} onChange={(e) => setEditing({ ...editing, locale: e.target.value })} /></div>
            </div>
            <div><label className={lbl}>Portada (URL)</label><input className={inp} value={editing.coverUrl} onChange={(e) => setEditing({ ...editing, coverUrl: e.target.value })} /></div>
            <div><label className={lbl}>Vídeo (URL)</label><input className={inp} value={editing.videoUrl} onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="checkbox checkbox-sm" checked={editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} /> {t('admin.academy.col.published')}</label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
              <button onClick={() => { if (!editing.title.trim()) { dialog.alert({ variant: 'error', message: t('admin.academy.title_required') }); return } save.mutate(editing) }} disabled={save.isPending} className="btn btn-primary btn-sm">{t('actions.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
