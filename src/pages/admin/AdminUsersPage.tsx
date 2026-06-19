import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { admin } from '../../api/admin'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faLock, faLockOpen, faCircleCheck, faKey, faEnvelope, faUserPlus, faPen, faTrash, faUserShield,
} from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'
import { useT } from '../../store/locale'
import { SearchInput } from '../../components/SearchInput'
import { FilterBar, SelectFilter } from '../../components/FilterBar'
import { Pagination } from './AdminOrdersPage'

const ROLES = ['ADMIN', 'OPERATOR', 'PARTNER', 'USER']
const PAGE_SIZE = 25

export default function AdminUsersPage() {
  const t = useT()
  const qc = useQueryClient()
  const [role, setRole] = useState<string | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [confirmRole, setConfirmRole] = useState<{ id: string; email: string; from: string; to: string } | null>(null)
  const [invite, setInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  const roleLabel = (r: string) => {
    const k = `admin.users.role.${r}`
    const v = t(k)
    return v === k ? r : v
  }

  const { data } = useQuery({
    queryKey: ['admin-users', role, country, q, page],
    queryFn: () => admin.users({ role: role ?? undefined, country: country ?? undefined, q: q || undefined, page, size: PAGE_SIZE }),
  })
  const rows = data?.items ?? []
  const total = data?.totalElements ?? 0
  const pages = data?.totalPages ?? 1

  const refetch = () => qc.invalidateQueries({ queryKey: ['admin-users'] })
  const changeRole = useMutation({ mutationFn: ({ id, r }: { id: string; r: string }) => admin.changeRole(id, r), onSuccess: refetch })
  const lock     = useMutation({ mutationFn: (id: string) => admin.lockUser(id, 60), onSuccess: refetch })
  const unlock   = useMutation({ mutationFn: (id: string) => admin.unlockUser(id),   onSuccess: refetch })
  const activate = useMutation({ mutationFn: (id: string) => admin.forceActivate(id), onSuccess: refetch })
  // DROP-586: edición inline de usuario — antes era un dialog "soon".
  const [editing, setEditing] = useState<any | null>(null)
  const editUserMut = useMutation({
    mutationFn: (body: any) => admin.editUser(editing!.id, body),
    onSuccess: () => { refetch(); setEditing(null) },
    onError: (e: any) => dialog.alert(e?.response?.data?.message ?? 'No se pudo actualizar'),
  })
  // DROP-607: reset de contraseña, eliminar e invitar — antes eran placeholders 'soon'.
  const resetPwMut = useMutation({
    mutationFn: (id: string) => admin.resetPassword(id),
    onSuccess: (_d, _id) => dialog.alert({ variant: 'success', message: t('admin.users.actions.reset_sent') }),
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.users.actions.action_error') }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => admin.deleteUser(id),
    onSuccess: () => { refetch(); dialog.alert({ variant: 'success', message: t('admin.users.actions.delete_done') }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.users.actions.action_error') }),
  })
  const inviteMut = useMutation({
    mutationFn: ({ email, role: r }: { email: string; role?: string }) => admin.inviteUser(email, r),
    onSuccess: () => { refetch(); setInvite(false); setInviteEmail(''); dialog.alert({ variant: 'success', message: t('admin.users.actions.invite_sent') }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.users.actions.action_error') }),
  })

  // Selección + acciones masivas (sobre la página actual).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkRole, setBulkRole] = useState('USER')
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const pageIds = rows.map((u) => u.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id))
    return n
  })
  async function runBulk(
    fn: (ids: string[]) => Promise<{ succeeded: number; failed: number; errors: string[] }>,
    opts?: { confirm?: { title?: string; message: string; variant?: 'error' } },
  ) {
    const ids = [...selected]
    if (!ids.length) return
    if (opts?.confirm && !await dialog.confirm({ ...opts.confirm })) return
    setBulkBusy(true)
    try {
      const r = await fn(ids)
      setSelected(new Set())
      await refetch()
      dialog.alert({
        variant: r.failed ? 'warning' : 'success',
        message: t('admin.bulk.done').replace('{ok}', String(r.succeeded)).replace('{fail}', String(r.failed))
          + (r.failed ? '\n' + r.errors.slice(0, 8).join('\n') : ''),
      })
    } finally {
      setBulkBusy(false)
    }
  }

  const countryOptions = Array.from(new Set(rows.map((u) => u.country).filter(Boolean) as string[]))
    .sort()
    .map((c) => ({ value: c, label: c }))

  const hasActive = !!role || !!country || !!q
  const clearAll = () => { setRole(null); setCountry(null); setQ(''); setPage(0) }

  function onRoleSelect(u: any, newRole: string) {
    if (newRole === u.role) return
    setConfirmRole({ id: u.id, email: u.email, from: u.role, to: newRole })
  }

  async function resetPassword(u: any) {
    if (!(await dialog.confirm(t('admin.users.actions.reset_confirm').replace('{email}', u.email)))) return
    resetPwMut.mutate(u.id)
  }

  async function deleteUser(u: any) {
    if (!(await dialog.confirm({ variant: 'error', message: t('admin.users.actions.delete_confirm').replace('{email}', u.email) }))) return
    deleteMut.mutate(u.id)
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1>{t('admin.users.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.users.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <div className="flex items-center gap-1 flex-wrap mr-1">
              <span className="text-[11px] text-ink-500 mr-1">{t('admin.bulk.selected').replace('{n}', String(selected.size))}</span>
              <button onClick={() => runBulk(admin.bulkActivateUsers)} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.users.actions.activate')}>
                <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.users.actions.activate')}
              </button>
              <button onClick={() => runBulk(admin.bulkLockUsers)} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.users.actions.lock')}>
                <FontAwesomeIcon icon={faLock} /> {t('admin.users.actions.lock')}
              </button>
              <button onClick={() => runBulk(admin.bulkUnlockUsers)} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.users.actions.unlock')}>
                <FontAwesomeIcon icon={faLockOpen} /> {t('admin.users.actions.unlock')}
              </button>
              <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}
                      className="border border-ink-200 rounded px-2 py-1 text-[11px]" aria-label={t('admin.bulk.role')}>
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              <button onClick={() => runBulk((ids) => admin.bulkRoleUsers(ids, bulkRole), {
                        confirm: { title: t('admin.bulk.role'), message: t('admin.bulk.role_confirm').replace('{n}', String(selected.size)).replace('{role}', roleLabel(bulkRole)) },
                      })} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.bulk.role')}>
                <FontAwesomeIcon icon={faUserShield} /> {t('admin.bulk.set_role')}
              </button>
              <button onClick={() => runBulk(admin.bulkDeleteUsers, {
                        confirm: { variant: 'error', title: t('admin.users.actions.delete'), message: t('admin.bulk.delete_confirm').replace('{n}', String(selected.size)) },
                      })} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px] border-red-300 text-red-700 hover:bg-red-50" title={t('admin.users.actions.delete')}>
                <FontAwesomeIcon icon={faTrash} /> {t('admin.users.actions.delete')}
              </button>
            </div>
          )}
          <button onClick={() => setInvite(true)} className="btn btn-primary text-[12px]">
            <FontAwesomeIcon icon={faUserPlus} /> {t('admin.users.actions.invite')}
          </button>
        </div>
      </header>

      <FilterBar onClear={clearAll} hasActive={hasActive}>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(0) }}
                     placeholder={t('admin.users.search_placeholder')} className="min-w-[280px]" />
        <SelectFilter label={t('filters.role')}
                      value={role}
                      options={ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
                      onChange={(v) => { setRole(v); setPage(0) }}
                      placeholder={t('filters.all')} />
        {countryOptions.length > 0 && (
          <SelectFilter label={t('filters.country')}
                        value={country}
                        options={countryOptions}
                        onChange={(v) => { setCountry(v); setPage(0) }}
                        placeholder={t('filters.all')} />
        )}
        <span className="text-[11px] text-ink-400 ml-auto">{t('pagination.showing')} <strong>{rows.length}</strong> / {total}</span>
      </FilterBar>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="checkbox checkbox-xs" checked={allSelected} onChange={toggleAll} aria-label={t('admin.categories.select_all')} />
              </th>
              <th className="px-4 py-2 font-medium">{t('admin.users.col.email')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.users.col.name')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.users.col.role')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.users.col.country')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.users.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.users.col.created')}</th>
              <th className="px-4 py-2 font-medium w-72">{t('admin.users.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((u: any) => (
              <tr key={u.id} className={`border-t border-ink-100 hover:bg-ink-50/50 ${selected.has(u.id) ? 'bg-brand-50/40' : ''}`}>
                <td className="px-3 py-2 w-8">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={selected.has(u.id)} onChange={() => toggleSel(u.id)} aria-label={u.email} />
                </td>
                <td className="px-4 py-2 text-[12px] font-mono">{u.email}</td>
                <td className="px-4 py-2 text-[12px]">{u.displayName ?? '—'}</td>
                <td className="px-4 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => onRoleSelect(u, e.target.value)}
                    className="border border-ink-200 rounded px-2 py-1 text-[11px] hover:border-ink-300 focus:border-brand-500 focus:outline-none">
                    {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-[12px] text-ink-500">{u.country ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`badge ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {u.active ? t('admin.users.active') : t('admin.users.inactive')}
                  </span>
                  {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                    <span className="ml-1 badge bg-red-100 text-red-700">{t('admin.users.locked')}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-[12px] text-ink-500">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : (u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—')}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {!u.active && (
                      <button onClick={() => activate.mutate(u.id)} className="btn btn-outline btn-square text-[11px]" title={t('admin.users.actions.activate')} aria-label={t('admin.users.actions.activate')}>
                        <FontAwesomeIcon icon={faCircleCheck} />
                      </button>
                    )}
                    {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                      <button onClick={() => unlock.mutate(u.id)} className="btn btn-outline btn-square text-[11px]" title={t('admin.users.actions.unlock')} aria-label={t('admin.users.actions.unlock')}>
                        <FontAwesomeIcon icon={faLockOpen} />
                      </button>
                    ) : (
                      <button onClick={() => lock.mutate(u.id)} className="btn btn-outline btn-square text-[11px]" title={t('admin.users.actions.lock')} aria-label={t('admin.users.actions.lock')}>
                        <FontAwesomeIcon icon={faLock} />
                      </button>
                    )}
                    <button onClick={() => resetPassword(u)} className="btn btn-outline btn-square text-[11px]" title={t('admin.users.actions.reset')} aria-label={t('admin.users.actions.reset')}>
                      <FontAwesomeIcon icon={faKey} />
                    </button>
                    <button onClick={() => setEditing({ ...u })} className="btn btn-outline btn-square text-[11px]" title={t('admin.users.actions.edit')} aria-label={t('admin.users.actions.edit')}>
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button onClick={() => deleteUser(u)} className="btn btn-outline btn-square text-[11px] hover:border-red-300 hover:text-red-700" title={t('admin.users.actions.delete')} aria-label={t('admin.users.actions.delete')}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-500 text-[13px]">
                {t('filters.no_results')}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} pages={Math.max(1, pages)} onPage={setPage} />

      {confirmRole && (
        <Modal onClose={() => setConfirmRole(null)} title={t('admin.users.role_change_title')}>
          <p className="text-sm text-ink-700">
            {t('admin.users.role_change_body')
              .replace('{email}', confirmRole.email)
              .replace('{from}', roleLabel(confirmRole.from))
              .replace('{to}', roleLabel(confirmRole.to))}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn btn-outline text-[12px]" onClick={() => setConfirmRole(null)}>{t('actions.cancel')}</button>
            <button className="btn btn-primary text-[12px]" onClick={() => {
              changeRole.mutate({ id: confirmRole.id, r: confirmRole.to })
              setConfirmRole(null)
            }}>{t('actions.confirm')}</button>
          </div>
        </Modal>
      )}

      {invite && (
        <Modal onClose={() => { setInvite(false); setInviteEmail('') }} title={t('admin.users.actions.invite')}>
          <label className="block text-[12px] text-ink-500 mb-1">{t('admin.users.col.email')}</label>
          <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                 className="input w-full" placeholder="alice@brand.com" />
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn btn-outline text-[12px]" onClick={() => { setInvite(false); setInviteEmail('') }}>
              {t('actions.cancel')}
            </button>
            <button className="btn btn-primary text-[12px]"
                    disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteEmail) || inviteMut.isPending}
                    onClick={() => inviteMut.mutate({ email: inviteEmail })}>
              <FontAwesomeIcon icon={faEnvelope} /> {t('admin.users.actions.send_invite')}
            </button>
          </div>
        </Modal>
      )}

      {/* DROP-586: modal de edición de usuario */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={t('admin.users.actions.edit') + ' · ' + editing.email}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="text-[12px] text-ink-500">{t('admin.users.col.name') ?? 'Nombre'}</span>
              <input className="input w-full mt-1" value={editing.displayName ?? ''}
                     onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[12px] text-ink-500">{t('admin.users.col.company') ?? 'Empresa'}</span>
              <input className="input w-full mt-1" value={editing.companyName ?? ''}
                     onChange={(e) => setEditing({ ...editing, companyName: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[12px] text-ink-500">{t('admin.users.col.country') ?? 'País'}</span>
              <input className="input w-full mt-1" value={editing.country ?? ''} maxLength={2}
                     onChange={(e) => setEditing({ ...editing, country: e.target.value.toUpperCase() })} />
            </label>
            <label className="block">
              <span className="text-[12px] text-ink-500">{t('admin.users.col.language') ?? 'Idioma'}</span>
              <select className="input w-full mt-1" value={editing.language ?? 'es'}
                      onChange={(e) => setEditing({ ...editing, language: e.target.value })}>
                <option value="es">Español</option><option value="en">English</option>
                <option value="pt">Português</option><option value="zh">中文</option>
              </select>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={!!editing.active}
                     onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              {t('admin.users.col.active') ?? 'Activo'}
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn btn-outline text-[12px]" onClick={() => setEditing(null)}>
              {t('actions.cancel')}
            </button>
            <button className="btn btn-primary text-[12px]" disabled={editUserMut.isPending}
                    onClick={() => editUserMut.mutate({
                      displayName: editing.displayName ?? null,
                      companyName: editing.companyName ?? null,
                      country: editing.country ?? null,
                      language: editing.language ?? null,
                      active: !!editing.active,
                    })}>
              {editUserMut.isPending ? t('common.saving') : t('actions.save') ?? 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, title, onClose }: { children: any; title: string; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md p-5">
        <div className="font-medium mb-3">{title}</div>
        {children}
      </div>
    </div>
  )
}
