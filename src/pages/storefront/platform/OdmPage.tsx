import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faBoxesPacking, faPen, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { odmApi, type OdmProject } from '../../../api/platform'
import { useT } from '../../../store/locale'
import { useCurrencyStore } from '../../../store/currency'
import { dialog } from '../../../store/dialog'

const KINDS = ['ODM_FREE', 'ODM_PAID', 'OEM', 'CUSTOM_PACKAGING']
const STATUSES = ['INTAKE', 'REVIEW', 'APPROVED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED']

export default function OdmPage() {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  // DROP-539 (v2): selector multi-divisa para el presupuesto. El backend almacena
  // en USD canónico — convertimos en el cliente antes de enviar.
  const displayCurrency = useCurrencyStore((s) => s.current)
  const currencies = useCurrencyStore((s) => s.currencies)
  const [budgetCurrency, setBudgetCurrency] = useState<string>(displayCurrency || 'USD')
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['my-odm'], queryFn: odmApi.mine })
  const [show, setShow] = useState(false)
  const [kind, setKind] = useState('ODM_FREE')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [budget, setBudget] = useState('')
  // DROP-539: convertir presupuesto del input a USD canónico antes de enviar.
  const budgetUsd = (() => {
    const v = parseFloat(budget) || 0
    if (!v) return 0
    if (budgetCurrency === 'USD') return v
    const cur = currencies.find((c) => c.code === budgetCurrency)
    return v * (cur?.rateVsUsd ?? 1)
  })()
  const create = useMutation({
    mutationFn: () => odmApi.create({ kind, title, brief, budgetUsdCents: budgetUsd ? Math.round(budgetUsd * 100) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-odm'] }); setShow(false); setTitle(''); setBrief(''); setBudget(''); setBudgetCurrency(displayCurrency || 'USD') },
  })

  // DROP-600: detalle, edición, eliminación y avance de estado.
  const [detail, setDetail] = useState<OdmProject | null>(null)
  const [edit, setEdit] = useState({ title: '', brief: '', budget: '' })
  const refetchOdm = () => { qc.invalidateQueries({ queryKey: ['my-odm'] }) }
  const onErr = (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('odm.action.error') })
  const saveEdit = useMutation({
    mutationFn: () => odmApi.update(detail!.id, { kind: detail!.kind, title: edit.title, brief: edit.brief,
      budgetUsdCents: edit.budget ? Math.round(parseFloat(edit.budget) * 100) : undefined }),
    onSuccess: (p) => { refetchOdm(); setDetail(p); dialog.alert({ variant: 'success', message: t('odm.action.saved') }) },
    onError: onErr,
  })
  const statusMut = useMutation({
    mutationFn: (status: string) => odmApi.adminUpdate(detail!.id, status),
    onSuccess: (p) => { refetchOdm(); setDetail(p) },
    onError: onErr,
  })
  const delMut = useMutation({
    mutationFn: () => odmApi.remove(detail!.id),
    onSuccess: () => { refetchOdm(); setDetail(null); dialog.alert({ variant: 'success', message: t('odm.action.deleted') }) },
    onError: onErr,
  })
  function openDetail(p: OdmProject) {
    setDetail(p)
    setEdit({ title: p.title, brief: p.brief ?? '', budget: p.budgetUsdCents ? String(p.budgetUsdCents / 100) : '' })
  }
  async function onDelete() {
    if (await dialog.confirm({ variant: 'error', message: t('odm.action.delete_confirm').replace('{title}', detail!.title) })) delMut.mutate()
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1>{t('odm.title')}</h1><p className="text-sm text-ink-500 mt-1">{t('odm.subtitle')}</p></div>
        <button onClick={() => setShow(true)} className="btn btn-primary"><FontAwesomeIcon icon={faPlus} /> {t('odm.new')}</button>
      </header>
      {data.length === 0 && (
        <div className="card p-10 text-center text-ink-500">
          <FontAwesomeIcon icon={faBoxesPacking} className="text-3xl text-ink-300 mb-2" />
          <p>No tienes proyectos ODM/OEM/Custom Packaging</p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((p) => (
          <button key={p.id} onClick={() => openDetail(p)} className="card p-4 text-left hover:border-brand-300 transition-colors">
            <div className="flex items-baseline justify-between mb-2">
              <span className="badge bg-brand-50 text-brand-700">{t(`odm.kind.${p.kind}`)}</span>
              <span className="badge bg-ink-100 text-ink-700">{p.status}</span>
            </div>
            <div className="font-medium">{p.title}</div>
            {p.brief && <p className="text-[12px] text-ink-600 mt-1 line-clamp-3">{p.brief}</p>}
            <div className="text-[11px] text-ink-500 mt-2">
              {p.budgetUsdCents && <>{format(p.budgetUsdCents/100, 'USD')} · </>}
              SLA {p.slaDays}d
            </div>
          </button>
        ))}
      </div>
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2">{t(`odm.kind.${detail.kind}`)}</h3>
              <button onClick={() => setDetail(null)} className="btn btn-ghost btn-sm btn-square"><FontAwesomeIcon icon={faXmark} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-500">{t('odm.status')}</label>
                <select value={detail.status} onChange={(e) => statusMut.mutate(e.target.value)} className="input mt-1">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-ink-500">{t('odm.field.title')}</label>
                <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="input mt-1" /></div>
              <div><label className="text-xs text-ink-500">{t('odm.field.brief')}</label>
                <textarea value={edit.brief} onChange={(e) => setEdit({ ...edit, brief: e.target.value })} rows={3} className="input mt-1" /></div>
              <div><label className="text-xs text-ink-500">{t('odm.field.budget')} (USD)</label>
                <input type="number" step="0.01" value={edit.budget} onChange={(e) => setEdit({ ...edit, budget: e.target.value })} className="input mt-1" /></div>
              <div className="text-[11px] text-ink-500">SLA {detail.slaDays}d</div>
            </div>
            <div className="flex justify-between gap-2 mt-4">
              <button onClick={onDelete} className="btn btn-outline btn-error btn-sm"><FontAwesomeIcon icon={faTrash} /> {t('odm.action.delete')}</button>
              <div className="flex gap-2">
                <button onClick={() => setDetail(null)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
                <button onClick={() => saveEdit.mutate()} disabled={!edit.title.trim() || saveEdit.isPending} className="btn btn-primary btn-sm"><FontAwesomeIcon icon={faPen} /> {t('odm.action.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {show && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md p-5">
            <h3>{t('odm.new')}</h3>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-3 mt-3">
              <div><label className="text-xs text-ink-500">{t('odm.kind')}</label>
                <select value={kind} onChange={(e) => setKind(e.target.value)} className="input mt-1">
                  {KINDS.map((k) => <option key={k} value={k}>{t(`odm.kind.${k}`)}</option>)}
                </select></div>
              {/* DROP-506: labels en i18n y aclaración de moneda (el backend almacena en USD canon). */}
              <div><label className="text-xs text-ink-500">{t('odm.field.title')}</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" /></div>
              <div><label className="text-xs text-ink-500">{t('odm.field.brief')}</label>
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className="input mt-1" /></div>
              <div><label className="text-xs text-ink-500">{t('odm.field.budget')}</label>
                <div className="flex items-center gap-2 mt-1">
                  <select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)}
                          className="select select-bordered text-sm w-auto">
                    {['USD','EUR','GBP','BRL','MXN','JPY','CNY','CAD'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} className="input flex-1" />
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">{t('odm.field.budget_hint')}</div>
                {budgetCurrency !== 'USD' && Number(budget) > 0 && (
                  <div className="text-[11px] text-ink-500 mt-1">
                    {t('odm.budget_stored_usd')}: <strong>{format(budgetUsd, 'USD')}</strong>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShow(false)} className="btn btn-ghost">{t('common.cancel')}</button>
                <button type="submit" disabled={create.isPending} className="btn btn-primary">{t('odm.new')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
