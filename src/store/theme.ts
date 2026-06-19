import { create } from 'zustand'

// DROP-391: temas pastel (luz/oscuro) reemplazan corporate/business como default.
export type ThemeMode = 'nx036-pastel' | 'nx036-pastel-dark'

interface ThemeState {
  theme: ThemeMode
  toggle: () => void
  set: (t: ThemeMode) => void
  init: () => void
}

const STORAGE_KEY = 'nx036-theme'
const LIGHT: ThemeMode = 'nx036-pastel'
const DARK:  ThemeMode = 'nx036-pastel-dark'

// Migración: si el storage tenía 'corporate'/'business' del esquema anterior, mapearlo.
function normalize(value: string | null): ThemeMode | null {
  if (value === LIGHT || value === DARK) return value
  if (value === 'corporate') return LIGHT
  if (value === 'business')  return DARK
  return null
}

function detect(): ThemeMode {
  try {
    const stored = normalize(localStorage.getItem(STORAGE_KEY))
    if (stored) return stored
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return DARK
  } catch { /* SSR / no localStorage */ }
  return LIGHT
}

function apply(t: ThemeMode) {
  document.documentElement.setAttribute('data-theme', t)
}

// DROP-429: detectamos el tema en la inicialización del store (no en init() que
// corre con delay) — así el icono del switcher refleja el tema activo en el
// primer render sin esperar al efecto.
const INITIAL_THEME: ThemeMode = (() => {
  try { return detect() } catch { return LIGHT }
})()
if (typeof document !== 'undefined') apply(INITIAL_THEME)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: INITIAL_THEME,
  init() {
    const t = detect()
    apply(t)
    set({ theme: t })
  },
  set(t) {
    localStorage.setItem(STORAGE_KEY, t)
    apply(t)
    set({ theme: t })
  },
  toggle() {
    get().set(get().theme === LIGHT ? DARK : LIGHT)
  },
}))
