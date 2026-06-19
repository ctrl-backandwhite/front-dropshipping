// DROP-554: página dedicada para gestionar direcciones de envío. Accesible
// desde el perfil ("Mis direcciones") y como destino sugerido cuando el
// usuario llega al checkout sin direcciones guardadas. El form usa el
// componente compartido AddressFields para mantener consistencia con el
// checkout (mismo dropdown de país, mismo dropdown de estado).

import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { addresses, AddressInput, UserAddress } from '../../../api/addresses'
import { useT } from '../../../store/locale'
import { dialog } from '../../../store/dialog'
import AddressFields from '../../../components/AddressFields'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faLocationDot, faPlus, faStar, faPen, faTrashCan, faCheck, faChevronLeft,
} from '@fortawesome/free-solid-svg-icons'

const EMPTY: AddressInput = {
  label: '', fullName: '', phone: '', line1: '', line2: '',
  city: '', state: '', postalCode: '', country: '', isDefault: false,
}

export default function AddressesPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data: addrs = [], isLoading } = useQuery({ queryKey: ['addresses'], queryFn: addresses.list })

  const [editing, setEditing] = useState<UserAddress | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AddressInput>(EMPTY)
  const [label, setLabel] = useState('')
  const [setDefault, setSetDefault] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setLabel('')
    setSetDefault(addrs.length === 0)
    setShowForm(true)
  }

  function openEdit(a: UserAddress) {
    setEditing(a)
    setForm({
      fullName: a.fullName, phone: a.phone ?? '', line1: a.line1, line2: a.line2 ?? '',
      city: a.city, state: a.state ?? '', postalCode: a.postalCode ?? '', country: a.country,
    })
    setLabel(a.label ?? '')
    setSetDefault(a.default)
    setShowForm(true)
  }

  const save = useMutation({
    mutationFn: () => {
      const body: AddressInput = { ...form, label, isDefault: setDefault }
      return editing
        ? addresses.update(editing.id, body)
        : addresses.create(body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['addresses'] })
      setShowForm(false)
      setEditing(null)
      setSavedMsg(t('profile.saved'))
      setTimeout(() => setSavedMsg(null), 2500)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => addresses.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  })

  const formValid =
    form.fullName.trim() && form.line1.trim() && form.city.trim() && form.country.trim()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formValid) return
    save.mutate()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <Link to="/profile" className="text-xs text-ink-500 hover:underline inline-flex items-center gap-1">
            <FontAwesomeIcon icon={faChevronLeft} /> {t('addresses.back_to_profile')}
          </Link>
          <h1 className="mt-1 flex items-center gap-2">
            <FontAwesomeIcon icon={faLocationDot} className="text-brand-600" />
            {t('addresses.title')}
          </h1>
          <p className="text-sm text-ink-500 mt-1">{t('addresses.subtitle')}</p>
        </div>
        {!showForm && (
          <button onClick={openCreate} className="btn btn-primary">
            <FontAwesomeIcon icon={faPlus} /> {t('addresses.add_new')}
          </button>
        )}
      </header>

      {savedMsg && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 flex items-center gap-2">
          <FontAwesomeIcon icon={faCheck} /> {savedMsg}
        </div>
      )}

      {isLoading && <p className="text-sm text-ink-500">{t('common.loading')}…</p>}

      {!isLoading && addrs.length === 0 && !showForm && (
        <div className="card p-8 text-center">
          <FontAwesomeIcon icon={faLocationDot} className="text-3xl text-ink-300" />
          <h3 className="mt-3">{t('addresses.empty_title')}</h3>
          <p className="text-sm text-ink-500 mt-1">{t('addresses.empty_desc')}</p>
          <button onClick={openCreate} className="btn btn-primary mt-4 inline-flex">
            <FontAwesomeIcon icon={faPlus} /> {t('addresses.add_first')}
          </button>
        </div>
      )}

      {addrs.length > 0 && !showForm && (
        <div className="grid sm:grid-cols-2 gap-3">
          {addrs.map((a) => (
            <div key={a.id} className="card p-4 text-sm relative">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium truncate">{a.label || a.fullName}</div>
                {a.default && (
                  <span className="badge bg-brand-50 text-brand-700 inline-flex items-center gap-1">
                    <FontAwesomeIcon icon={faStar} /> {t('checkout.default')}
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-600 mt-1">{a.fullName}</div>
              {a.phone && <div className="text-xs text-ink-500">{a.phone}</div>}
              <div className="text-xs text-ink-500 mt-1">
                {a.line1}{a.line2 ? `, ${a.line2}` : ''}
              </div>
              <div className="text-xs text-ink-500">
                {a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode}
              </div>
              <div className="text-xs text-ink-500">{a.country}</div>
              <div className="flex gap-3 mt-3 pt-3 border-t border-ink-100">
                <button onClick={() => openEdit(a)} className="text-xs text-brand-700 hover:underline">
                  <FontAwesomeIcon icon={faPen} /> {t('common.edit')}
                </button>
                <button onClick={async () => {
                  if (!(await dialog.confirm(t('profile.confirm_delete')))) return
                  remove.mutate(a.id)
                }} className="text-xs text-red-600 hover:underline">
                  <FontAwesomeIcon icon={faTrashCan} /> {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="card p-5 space-y-4">
          <h3>{editing ? t('addresses.edit_title') : t('addresses.new_title')}</h3>

          <input className="input"
                 placeholder={t('profile.label_placeholder')}
                 value={label}
                 onChange={(e) => setLabel(e.target.value)} />

          <AddressFields value={form} onChange={setForm} />

          <label className="text-xs text-ink-600 flex items-center gap-2">
            <input type="checkbox" checked={setDefault}
                   onChange={(e) => setSetDefault(e.target.checked)} />
            {t('profile.set_default')}
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={!formValid || save.isPending} className="btn btn-primary">
              {save.isPending ? t('common.saving') : (editing ? t('profile.update') : t('profile.save_address'))}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="btn btn-ghost">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
