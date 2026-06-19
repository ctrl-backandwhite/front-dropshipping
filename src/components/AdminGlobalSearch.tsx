import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faBoxesStacked, faTruck, faUsers, faKey } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../store/locale'

/**
 * DROP-434: búsqueda global del admin. Ctrl/Cmd+K abre, escribe para filtrar
 * entre productos, órdenes, usuarios y partner_app. Es una palette client-side
 * sobre el sitemap del admin — no requiere endpoint nuevo y se complementa con
 * las queries de cada página al hacer click.
 */
type Entry = { label: string; to: string; icon: any; group: string }

const INDEX: Entry[] = [
  { group: 'Catálogo',  label: 'Productos',          to: '/admin/catalog',      icon: faBoxesStacked },
  { group: 'Catálogo',  label: 'Categorías',         to: '/admin/categories',   icon: faBoxesStacked },
  { group: 'Catálogo',  label: 'Proveedores',        to: '/admin/suppliers',    icon: faBoxesStacked },
  { group: 'Catálogo',  label: 'Almacenes',          to: '/admin/warehouses',   icon: faBoxesStacked },
  { group: 'Catálogo',  label: 'Reglas de precio',   to: '/admin/pricing',      icon: faBoxesStacked },
  { group: 'Ventas',    label: 'Pedidos',            to: '/admin/orders',       icon: faTruck },
  { group: 'Ventas',    label: 'Tiendas',            to: '/admin/shops',        icon: faTruck },
  { group: 'Finanzas',  label: 'Facturación',        to: '/admin/billing',      icon: faKey },
  { group: 'Finanzas',  label: 'Wallets',            to: '/admin/wallets',      icon: faKey },
  { group: 'Sistema',   label: 'Usuarios',           to: '/admin/users',        icon: faUsers },
  { group: 'Sistema',   label: 'Partners / API',     to: '/admin/partners',     icon: faKey },
  { group: 'Sistema',   label: 'Notificaciones',     to: '/admin/notifications',icon: faKey },
  { group: 'Cuenta',    label: 'Perfil',             to: '/admin/profile',      icon: faUsers },
  { group: 'Cuenta',    label: 'Guía de estilo',     to: '/admin/styleguide',   icon: faUsers },
]

export function AdminGlobalSearch() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = q.trim()
    ? INDEX.filter((e) => e.label.toLowerCase().includes(q.trim().toLowerCase())
                       || e.group.toLowerCase().includes(q.trim().toLowerCase()))
    : INDEX

  // Agrupar por sección
  const byGroup: Record<string, Entry[]> = {}
  for (const e of filtered) (byGroup[e.group] ??= []).push(e)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
              className="btn btn-ghost btn-sm gap-2 hidden md:inline-flex"
              title={t('admin.search.placeholder') + ' (Ctrl+K)'}>
        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-[12px] opacity-70" />
        <span className="opacity-60 text-[12px]">{t('admin.search.placeholder')}</span>
        <kbd className="kbd kbd-xs">⌘K</kbd>
      </button>
      {open && (
        /* DROP-560: el modal antes quedaba recortado por max-h-96 (24rem) y se
            centraba verticalmente con el contenido cropped. Lo subimos al top
            (mt-[10vh]) y le damos altura responsiva (max-h-[75vh]) para que
            todos los resultados sean accesibles en cualquier viewport. */
        <div className="modal modal-open items-start" onClick={() => setOpen(false)}>
          <div className="modal-box max-w-2xl p-0 overflow-hidden mt-[10vh] max-h-[75vh] flex flex-col"
               onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-base-300 p-3 flex items-center gap-2 shrink-0">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="opacity-60" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                     placeholder={t('admin.search.placeholder')}
                     className="grow bg-transparent focus:outline-none text-sm" />
              <kbd className="kbd kbd-xs">Esc</kbd>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {Object.entries(byGroup).map(([group, entries]) => (
                <div key={group} className="py-2">
                  <div className="px-3 text-[10px] uppercase tracking-wider opacity-60">{group}</div>
                  {entries.map((e) => (
                    <Link key={e.to} to={e.to} onClick={() => setOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-primary/10">
                      <FontAwesomeIcon icon={e.icon} className="w-4 text-center opacity-60" />
                      <span>{e.label}</span>
                      <code className="ml-auto text-[10px] opacity-50">{e.to}</code>
                    </Link>
                  ))}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center opacity-60 text-sm p-6">{t('filters.no_results')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
