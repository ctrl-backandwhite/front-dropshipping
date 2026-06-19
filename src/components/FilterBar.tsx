import { ReactNode, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faFilter, faCheck, faChevronDown, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'

interface Option {
  value: string
  label: string
  count?: number
}

interface SelectFilterProps {
  label: string
  value: string | null
  options: Option[]
  onChange: (v: string | null) => void
  placeholder?: string
  /** Show an inline search input inside the popover when there are many options. */
  searchable?: boolean
  /** Optional icon shown before the label inside the trigger button. */
  icon?: any
}

/**
 * Popover-based single-select. Renders as a chip-style button that opens a small
 * scrollable menu with check-mark indicators. Falls back to native semantics via
 * keyboard handling and `aria-expanded`.
 */
export function SelectFilter({ label, value, options, onChange, placeholder, searchable, icon }: SelectFilterProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = value ? options.find((o) => o.value === value) : null
  const showSearch = (searchable ?? options.length > 8)
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors focus-ring ${
          selected
            ? 'border-brand-300 bg-brand-50 text-brand-800'
            : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
        }`}
      >
        {icon && <FontAwesomeIcon icon={icon} className="text-[10px] text-ink-400 group-hover:text-ink-600" />}
        <span className="text-ink-500">{label}:</span>
        <span className="font-medium truncate max-w-[140px]">
          {selected ? selected.label : (placeholder ?? t('filters.all'))}
        </span>
        <FontAwesomeIcon icon={faChevronDown}
                         className={`text-[9px] text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="listbox"
             className="absolute left-0 top-full mt-1 min-w-[14rem] max-w-[20rem] bg-white border border-ink-200 rounded-lg shadow-lg z-30 overflow-hidden">
          {showSearch && (
            <div className="p-2 border-b border-ink-100 relative">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('filters.search')}
                autoFocus
                className="w-full pl-7 pr-2 py-1.5 text-[12px] border border-ink-200 rounded-md focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          )}
          <ul className="max-h-64 overflow-y-auto scrollbar-thin py-1">
            <li>
              <button type="button"
                      onClick={() => { onChange(null); setOpen(false) }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-left hover:bg-ink-50 ${value == null ? 'text-brand-700 font-medium' : 'text-ink-600'}`}>
                <span>{placeholder ?? t('filters.all')}</span>
                {value == null && <FontAwesomeIcon icon={faCheck} className="text-[10px]" />}
              </button>
            </li>
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-[12px] text-ink-400 text-center">{t('filters.no_results')}</li>
            )}
            {filtered.map((o) => {
              const isActive = o.value === value
              return (
                <li key={o.value}>
                  <button type="button"
                          onClick={() => { onChange(o.value); setOpen(false) }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-ink-50 ${isActive ? 'text-brand-700 font-medium' : 'text-ink-700'}`}>
                    <span className="truncate">{o.label}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {o.count != null && (
                        <span className={`text-[10px] ${isActive ? 'text-brand-600' : 'text-ink-400'}`}>{o.count}</span>
                      )}
                      {isActive && <FontAwesomeIcon icon={faCheck} className="text-[10px]" />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

interface PillToggleProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  icon?: any
}

/** Compact on/off chip for boolean filters — daisyUI toggle inside a chip label. */
export function PillToggle({ label, checked, onChange, icon }: PillToggleProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] cursor-pointer transition-colors ${
        checked
          ? 'border-primary/40 bg-primary/5 text-base-content'
          : 'border-base-300 bg-base-100 text-base-content/80 hover:border-base-content/30'
      }`}
    >
      {icon && <FontAwesomeIcon icon={icon} className="text-[10px] opacity-70" />}
      <span>{label}</span>
      <input
        type="checkbox"
        className="toggle toggle-primary toggle-xs"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

interface FilterBarProps {
  children: ReactNode
  /** Optional clear-all callback. Shown only if provided. */
  onClear?: () => void
  /** True if any filter is currently active — controls the visibility of "Clear". */
  hasActive?: boolean
  /** Number of currently active filters — drives the badge next to the label. */
  activeCount?: number
}

export function FilterBar({ children, onClear, hasActive, activeCount }: FilterBarProps) {
  const t = useT()
  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 uppercase tracking-wider font-medium pr-2 border-r border-ink-100">
          <FontAwesomeIcon icon={faFilter} className="text-[10px]" />
          {t('filters.label')}
          {activeCount != null && activeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-medium">
              {activeCount}
            </span>
          )}
        </span>
        {children}
        {onClear && hasActive && (
          <button type="button" onClick={onClear}
                  className="ml-auto inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-red-600">
            <FontAwesomeIcon icon={faXmark} className="text-[10px]" /> {t('filters.clear')}
          </button>
        )}
      </div>
    </div>
  )
}

interface RangeInputProps {
  label: string
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
  prefix?: string
  placeholderMin?: string
  placeholderMax?: string
}

/** Min/max range input with a unified label and prefix (e.g. currency symbol). */
export function RangeInput({ label, min, max, onMin, onMax, prefix, placeholderMin, placeholderMax }: RangeInputProps) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] rounded-full border border-ink-200 bg-white px-2 py-0.5">
      <span className="text-ink-500 pl-1">{label}:</span>
      {prefix && <span className="text-ink-400">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        placeholder={placeholderMin ?? '0'}
        value={min}
        onChange={(e) => onMin(e.target.value)}
        className="w-14 px-1 py-1 text-[12px] focus:outline-none bg-transparent"
      />
      <span className="text-ink-300">–</span>
      <input
        type="number"
        inputMode="decimal"
        placeholder={placeholderMax ?? '∞'}
        value={max}
        onChange={(e) => onMax(e.target.value)}
        className="w-14 px-1 py-1 text-[12px] focus:outline-none bg-transparent"
      />
    </div>
  )
}
