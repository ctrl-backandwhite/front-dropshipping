// DROP-554: formulario de dirección reutilizable. Lo usan CheckoutPage (cuando
// el usuario quiere agregar una dirección on-the-fly) y AddressesPage (CRUD
// completo del perfil). País + Estado son dropdowns; cuando el país no tiene
// estados curados, mostramos un input libre como fallback.

import { AddressInput } from '../api/addresses'
import { COUNTRIES } from '../data/countries'
import { RegionSelect } from './RegionSelect'
import { useT } from '../store/locale'

interface Props {
  value: AddressInput
  onChange: (next: AddressInput) => void
  compact?: boolean
}

export default function AddressFields({ value, onChange, compact }: Props) {
  const t = useT()

  const set = <K extends keyof AddressInput>(k: K, v: AddressInput[K]) =>
    onChange({ ...value, [k]: v })

  const inputCls = compact ? 'input input-sm w-full' : 'input w-full'
  const selectCls = compact ? 'select select-sm w-full' : 'select w-full'

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <input className={`${inputCls} sm:col-span-2`}
             placeholder={`${t('checkout.full_name')} *`}
             value={value.fullName}
             onChange={(e) => set('fullName', e.target.value)} />

      <input className={inputCls} placeholder={t('checkout.phone')}
             value={value.phone ?? ''}
             onChange={(e) => set('phone', e.target.value)} />

      <select className={selectCls}
              value={value.country}
              onChange={(e) => {
                // Al cambiar de país, limpiamos el estado seleccionado para
                // que no quede inconsistente con el dataset del nuevo país.
                onChange({ ...value, country: e.target.value, state: '' })
              }}>
        <option value="">{`${t('checkout.country_iso')} *`}</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>

      <input className={`${inputCls} sm:col-span-2`}
             placeholder={`${t('checkout.line1')} *`}
             value={value.line1}
             onChange={(e) => set('line1', e.target.value)} />

      <input className={`${inputCls} sm:col-span-2`}
             placeholder={t('checkout.line2')}
             value={value.line2 ?? ''}
             onChange={(e) => set('line2', e.target.value)} />

      <input className={inputCls} placeholder={`${t('checkout.city')} *`}
             value={value.city}
             onChange={(e) => set('city', e.target.value)} />

      {/* Estado/provincia desde el seed del backend: dropdown si el país tiene regiones
          (US/CA/BR y los que se añadan); texto libre si no. El código de región alimenta el IVA. */}
      <RegionSelect country={value.country}
                    value={value.state ?? ''}
                    onChange={(v) => set('state', v)}
                    selectClassName={selectCls}
                    inputClassName={inputCls}
                    placeholder={t('checkout.state')} />

      <input className={inputCls} placeholder={t('checkout.postal_code')}
             value={value.postalCode ?? ''}
             onChange={(e) => set('postalCode', e.target.value)} />
    </div>
  )
}
