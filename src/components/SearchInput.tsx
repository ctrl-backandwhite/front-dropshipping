import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Debounce window in ms. Defaults to 280. */
  debounce?: number
  className?: string
  autoFocus?: boolean
}

/**
 * Debounced search input with a clear button. The parent receives the value only after
 * the user pauses typing for `debounce` ms, which keeps server fetches off the keystroke
 * critical path.
 */
export function SearchInput({ value, onChange, placeholder, debounce = 280, className, autoFocus }: Props) {
  const t = useT()
  const [local, setLocal] = useState(value)

  // sync external resets (e.g. when filters are cleared)
  useEffect(() => { setLocal(value) }, [value])

  useEffect(() => {
    if (local === value) return
    const id = setTimeout(() => onChange(local), debounce)
    return () => clearTimeout(id)
  }, [local, value, debounce, onChange])

  return (
    <label className={`input input-bordered input-sm flex items-center gap-2 ${className ?? ''}`}>
      <FontAwesomeIcon icon={faMagnifyingGlass} className="opacity-60 text-[12px]" />
      <input
        type="search"
        autoFocus={autoFocus}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder ?? t('common.search')}
        className="grow bg-transparent focus:outline-none text-[13px]"
      />
      {local && (
        <button type="button" onClick={() => { setLocal(''); onChange('') }}
                className="opacity-60 hover:opacity-100"
                aria-label={t('common.cancel')}>
          <FontAwesomeIcon icon={faXmark} className="text-[11px]" />
        </button>
      )}
    </label>
  )
}
