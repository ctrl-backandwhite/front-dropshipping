import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt, faCircleCheck, faCircleInfo, faCircleExclamation, faTriangleExclamation,
  faPlus, faPencil, faTrashCan, faShieldHalved, faChartLine,
} from '@fortawesome/free-solid-svg-icons'
import { useThemeStore } from '../../store/theme'

// DROP-395: styleguide interno de la paleta pastel NX036.
// Documenta tokens, jerarquía, estados, botones y superficies para que el equipo
// pueda revisar el sistema sin tocar el navegador inspector.

const PALETTE: { name: string; token: string; description: string }[] = [
  { name: 'primary',    token: '--color-primary',    description: 'Lavanda pastel — acción principal, links activos, énfasis.' },
  { name: 'secondary',  token: '--color-secondary',  description: 'Aqua pastel — acción secundaria o data viz.' },
  { name: 'accent',     token: '--color-accent',     description: 'Melocotón pastel — destaques cálidos y promociones.' },
  { name: 'neutral',    token: '--color-neutral',    description: 'Gris neutro para textos secundarios y borders.' },
  { name: 'base-100',   token: '--color-base-100',   description: 'Superficie elevada (cards, modales).' },
  { name: 'base-200',   token: '--color-base-200',   description: 'Fondo de página y carriles de tabla zebra.' },
  { name: 'base-300',   token: '--color-base-300',   description: 'Borders y separadores.' },
  { name: 'success',    token: '--color-success',    description: 'Estados positivos (verificado, activo).' },
  { name: 'info',       token: '--color-info',       description: 'Estados informativos (pendiente, neutral).' },
  { name: 'warning',    token: '--color-warning',    description: 'Estados a revisar (atención requerida).' },
  { name: 'error',      token: '--color-error',      description: 'Estados negativos y acciones destructivas (papelera, cancelar).' },
]

export default function AdminStyleguidePage() {
  const theme = useThemeStore((s) => s.theme)
  return (
    <div className="space-y-8">
      <header>
        <h1>Style guide — Pastel NX036</h1>
        <p className="text-sm opacity-70 mt-1">
          Sistema de diseño basado en daisyUI 5 + tema custom <code>nx036-pastel</code>.
          Activo: <span className="badge badge-primary badge-sm">{theme}</span>
        </p>
      </header>

      {/* Paleta */}
      <section className="card">
        <div className="card-body">
          <h2 className="card-title">Paleta</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
            {PALETTE.map((p) => (
              <div key={p.name} className="card card-border bg-base-100">
                <div className="card-body p-3 gap-2">
                  <div className={`h-10 rounded-md border border-base-300 bg-${p.name}`}></div>
                  <div className="text-[13px] font-medium">{p.name}</div>
                  <code className="text-[10px] opacity-60">{p.token}</code>
                  <p className="text-[11px] opacity-70 leading-snug">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tipografía */}
      <section className="card">
        <div className="card-body">
          <h2 className="card-title">Tipografía</h2>
          <div className="space-y-2 mt-2">
            <h1>Heading 1 — 1.5rem / 500</h1>
            <h2>Heading 2 — 1.125rem / 500</h2>
            <h3>Heading 3 — 0.95rem / 500</h3>
            <p className="text-sm">Body — texto principal en <code>base-content</code>.</p>
            <p className="text-sm opacity-70">Body 70% — textos secundarios.</p>
            <p className="text-[12px] opacity-60">Caption 12px / 60% — metadatos, fechas.</p>
            <code className="font-mono text-[12px] block">code · monospace</code>
          </div>
        </div>
      </section>

      {/* Botones */}
      <section className="card">
        <div className="card-body">
          <h2 className="card-title">Botones</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-secondary">Secondary</button>
            <button className="btn btn-accent">Accent</button>
            <button className="btn btn-outline">Outline</button>
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn btn-primary btn-sm" disabled>Disabled</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn btn-ghost btn-sm btn-square" aria-label="add"><FontAwesomeIcon icon={faPlus} /></button>
            <button className="btn btn-ghost btn-sm btn-square" aria-label="edit"><FontAwesomeIcon icon={faPencil} /></button>
            <button className="btn btn-ghost btn-sm btn-square text-error" aria-label="delete"><FontAwesomeIcon icon={faTrashCan} /></button>
          </div>
        </div>
      </section>

      {/* Estados */}
      <section className="card">
        <div className="card-body">
          <h2 className="card-title">Estados (badges + alerts)</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="badge">default</span>
            <span className="badge badge-ghost">ghost</span>
            <span className="badge badge-primary">primary</span>
            <span className="badge badge-secondary">secondary</span>
            <span className="badge badge-accent">accent</span>
            <span className="badge badge-info">info</span>
            <span className="badge badge-success">success</span>
            <span className="badge badge-warning">warning</span>
            <span className="badge badge-error">error</span>
            <span className="badge badge-trustpass"><FontAwesomeIcon icon={faShieldHalved} className="mr-1" /> TrustPass</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div role="alert" className="alert alert-info"><FontAwesomeIcon icon={faCircleInfo} /><span>Información general</span></div>
            <div role="alert" className="alert alert-success"><FontAwesomeIcon icon={faCircleCheck} /><span>Operación completada</span></div>
            <div role="alert" className="alert alert-warning"><FontAwesomeIcon icon={faTriangleExclamation} /><span>Revisa los datos antes de continuar</span></div>
            <div role="alert" className="alert alert-error"><FontAwesomeIcon icon={faCircleExclamation} /><span>No se pudo completar la acción</span></div>
          </div>
        </div>
      </section>

      {/* Superficies */}
      <section className="card">
        <div className="card-body">
          <h2 className="card-title">Superficies + sombras</h2>
          <div className="grid sm:grid-cols-3 gap-3 mt-2">
            <div className="card card-border bg-base-100"><div className="card-body p-3 text-sm">card-border · base-100</div></div>
            <div className="card bg-base-100 shadow-pastel-sm"><div className="card-body p-3 text-sm">shadow-pastel-sm</div></div>
            <div className="card bg-base-100 shadow-pastel-lg"><div className="card-body p-3 text-sm">shadow-pastel-lg</div></div>
          </div>
        </div>
      </section>

      {/* Tabla zebra */}
      <section className="card">
        <div className="card-body">
          <h2 className="card-title">Tabla zebra + estados</h2>
          <div className="overflow-x-auto">
          <table className="table table-zebra table-sm mt-2">
            <thead><tr><th>SKU</th><th>Producto</th><th>Estado</th><th className="text-right">Stock</th></tr></thead>
            <tbody>
              <tr><td className="font-mono text-[11px]">SKU-001</td><td>Camiseta pastel</td><td><span className="badge badge-success badge-sm">Activo</span></td><td className="text-right">124</td></tr>
              <tr><td className="font-mono text-[11px]">SKU-002</td><td>Mochila lavanda</td><td><span className="badge badge-warning badge-sm">Revisión</span></td><td className="text-right">12</td></tr>
              <tr><td className="font-mono text-[11px]">SKU-003</td><td>Gorra accent</td><td><span className="badge badge-ghost badge-sm">Inactivo</span></td><td className="text-right">0</td></tr>
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* KPI sample + sparkline */}
      <section className="card">
        <div className="card-body">
          <h2 className="card-title">KPIs y sparklines</h2>
          <div className="stats stats-vertical sm:stats-horizontal shadow-pastel w-full bg-base-100 mt-2">
            {[
              { tone: 'primary', icon: faBolt,        label: 'Conversiones', value: '2,431' },
              { tone: 'success', icon: faCircleCheck, label: 'Activos',      value: '1,002' },
              { tone: 'info',    icon: faChartLine,   label: 'MRR',          value: '$ 38.2k' },
            ].map((k) => (
              <div className="stat" key={k.label}>
                <div className={`stat-figure text-${k.tone}`}>
                  <span className="kpi-icon"><FontAwesomeIcon icon={k.icon} className="text-lg" /></span>
                </div>
                <div className="stat-title text-[11px]">{k.label}</div>
                <div className="stat-value text-2xl">{k.value}</div>
                <div className="stat-desc">
                  <Sparkline data={[5, 7, 6, 8, 9, 7, 11, 13, 12, 14]} tone={k.tone as any} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="text-[11px] opacity-60">
        El sistema se aplica automáticamente vía <code>data-theme</code>. Para alternar entre modo claro y oscuro, usa el botón en la barra superior.
      </p>
    </div>
  )
}

// DROP-397: mini-sparkline pastel inline (sin librerías extra).
function Sparkline({ data, tone = 'primary' }: { data: number[]; tone?: 'primary' | 'secondary' | 'accent' | 'success' | 'info' | 'warning' | 'error' }) {
  if (data.length === 0) return null
  const W = 80, H = 22, P = 2
  const min = Math.min(...data), max = Math.max(...data)
  const span = Math.max(1, max - min)
  const points = data.map((v, i) => {
    const x = P + (i * (W - 2 * P)) / Math.max(1, data.length - 1)
    const y = H - P - ((v - min) / span) * (H - 2 * P)
    return `${x},${y}`
  }).join(' ')
  const colorVar = `var(--color-${tone})`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="inline-block h-5 w-20 align-middle" aria-hidden="true">
      <polyline fill="none" stroke={colorVar} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" points={points} />
      <polyline fill={colorVar} fillOpacity={0.12} stroke="none"
                points={`${P},${H - P} ${points} ${W - P},${H - P}`} />
    </svg>
  )
}
