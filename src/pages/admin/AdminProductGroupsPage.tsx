import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPen, faTrash, faXmark, faUsers, faCheck } from '@fortawesome/free-solid-svg-icons'
import { admin, type ProductGroup } from '../../api/admin'
import { listStorefrontProducts } from '../../api/catalog'
import { dialog } from '../../store/dialog'
import { useT } from '../../store/locale'

const inp = 'input input-bordered input-sm w-full'

/** Gestión de grupos de productos: crear grupos y asignarles productos (scope PRODUCT_GROUP de margen). */
export default function AdminProductGroupsPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data: groups = [] } = useQuery({ queryKey: ['product-groups'], queryFn: admin.productGroups })
  const [editing, setEditing] = useState<Partial<ProductGroup> | null>(null)
  const [membersOf, setMembersOf] = useState<ProductGroup | null>(null)

  const save = useMutation({
    mutationFn: (g: Partial<ProductGroup>) => g.id
      ? admin.updateProductGroup(g.id, { name: g.name, description: g.description, active: g.active })
      : admin.createProductGroup({ name: g.name!, description: g.description, active: g.active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-groups'] }); setEditing(null) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? 'Error' }),
  })
  const del = useMutation({
    mutationFn: (id: string) => admin.deleteProductGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-groups'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('admin.groups.title')}</h1>
          <p className="text-ink-500 text-sm">{t('admin.groups.subtitle')}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ active: true })}>
          <FontAwesomeIcon icon={faPlus} /> {t('admin.groups.new')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2">{t('admin.groups.col.name')}</th>
              <th className="px-4 py-2">{t('admin.groups.col.description')}</th>
              <th className="px-4 py-2 text-center">{t('admin.groups.col.members')}</th>
              <th className="px-4 py-2 text-center">{t('admin.groups.col.active')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-t border-ink-100">
                <td className="px-4 py-2 font-medium">{g.name}</td>
                <td className="px-4 py-2 text-ink-500 text-[12px]">{g.description ?? '—'}</td>
                <td className="px-4 py-2 text-center">{g.memberCount}</td>
                <td className="px-4 py-2 text-center"><FontAwesomeIcon icon={g.active ? faCheck : faXmark} className={g.active ? 'text-success' : 'text-ink-400'} /></td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setMembersOf(g)} className="btn btn-ghost btn-xs btn-square" title={t('admin.groups.manage_members')} aria-label={t('admin.groups.manage_members')}><FontAwesomeIcon icon={faUsers} /></button>
                  <button onClick={() => setEditing(g)} className="btn btn-ghost btn-xs btn-square" title={t('actions.edit')} aria-label={t('actions.edit')}><FontAwesomeIcon icon={faPen} /></button>
                  <button onClick={() => dialog.confirm({ variant: 'error', message: t('admin.groups.delete_confirm') }).then((ok) => ok && del.mutate(g.id))} className="btn btn-ghost btn-xs btn-square text-error" title={t('actions.delete')} aria-label={t('actions.delete')}><FontAwesomeIcon icon={faTrash} /></button>
                </td>
              </tr>
            ))}
            {groups.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-400 text-[12px]">{t('admin.groups.empty')}</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-semibold text-lg">{editing.id ? t('actions.edit') : t('admin.groups.new')}</h3>
            <div><label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.groups.col.name')} *</label>
              <input className={inp} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.groups.col.description')}</label>
              <input className={inp} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="checkbox checkbox-sm" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> {t('admin.groups.col.active')}</label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
              <button onClick={() => { if (!editing.name?.trim()) { dialog.alert({ variant: 'error', message: t('admin.groups.name_required') }); return } save.mutate(editing) }} disabled={save.isPending} className="btn btn-primary btn-sm">{t('actions.save')}</button>
            </div>
          </div>
        </div>
      )}

      {membersOf && <MembersModal group={membersOf} onClose={() => { setMembersOf(null); qc.invalidateQueries({ queryKey: ['product-groups'] }) }} />}
    </div>
  )
}

/** Panel para añadir/quitar productos de un grupo. */
function MembersModal({ group, onClose }: { group: ProductGroup; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const { data: members = [] } = useQuery({ queryKey: ['group-members', group.id], queryFn: () => admin.productGroupMembers(group.id) })
  const { data: products } = useQuery({
    queryKey: ['group-product-pick', search],
    queryFn: () => listStorefrontProducts(0, 20, 'es', search ? { q: search } : {}),
    staleTime: 30_000,
  })
  const memberIds = new Set(members.map((m) => m.id))
  const refresh = () => qc.invalidateQueries({ queryKey: ['group-members', group.id] })

  const add = useMutation({ mutationFn: (id: string) => admin.addProductGroupMembers(group.id, [id]), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (id: string) => admin.removeProductGroupMember(group.id, id), onSuccess: refresh })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{t('admin.groups.members_of').replace('{name}', group.name)}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-square"><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        <div>
          <label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.groups.add_product')}</label>
          <input className={inp} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.groups.search_product')} />
          {search && (products?.items?.length ?? 0) > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto border border-ink-100 rounded-md divide-y divide-ink-100">
              {products!.items.filter((p) => !memberIds.has(p.id)).map((p) => (
                <button key={p.id} onClick={() => add.mutate(p.id)} className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-ink-50 flex items-center gap-2">
                  <FontAwesomeIcon icon={faPlus} className="text-ink-400" /> {p.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-[12px] font-medium text-ink-600 mb-1">{t('admin.groups.col.members')} ({members.length})</div>
          {members.length === 0 ? (
            <div className="text-[12px] text-ink-400 text-center py-4">{t('admin.groups.no_members')}</div>
          ) : (
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-[12px] bg-ink-50 rounded-md px-2 py-1">
                  <span className="flex-1 truncate">{m.title}</span>
                  <button onClick={() => remove.mutate(m.id)} className="btn btn-ghost btn-xs btn-square text-error"><FontAwesomeIcon icon={faTrash} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
