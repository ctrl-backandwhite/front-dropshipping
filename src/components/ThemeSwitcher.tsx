import { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons'
import { useThemeStore } from '../store/theme'

export function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  const init = useThemeStore((s) => s.init)
  useEffect(() => { init() }, [init])

  const isDark = theme === 'nx036-pastel-dark'
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-sm btn-square"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Tema claro' : 'Tema oscuro'}
    >
      <FontAwesomeIcon icon={isDark ? faSun : faMoon} />
    </button>
  )
}
