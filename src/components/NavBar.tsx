import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MODE_OPTIONS } from '../types'

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // close dropdown on navigation
  useEffect(() => { setOpen(false) }, [location.pathname])

  // close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isDrillActive = location.pathname.startsWith('/drill') || location.pathname === '/defense'

  return (
    <header className="nav-bar">
      <NavLink to="/" className="brand-link">
        <span className="brand-mark">🀄</span>
        <span>牌效训练器</span>
      </NavLink>

      <nav className="nav-links" aria-label="主导航">
        <div className="nav-dropdown" ref={menuRef}>
          <button
            className={`nav-link nav-dropdown-trigger${isDrillActive ? ' is-active' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            训练 ▾
          </button>
          {open && (
            <div className="nav-dropdown-menu">
              {MODE_OPTIONS.map((mode) => (
                <NavLink
                  key={mode.key}
                  to={mode.key === 'defense' ? '/defense' : `/drill/${mode.key}`}
                  className="nav-dropdown-item"
                >
                  <span className="dropdown-item-label">{mode.label}</span>
                  <span className="dropdown-item-sub">{mode.subtitle}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <NavLink to="/stats" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>统计</NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>设置</NavLink>
      </nav>
    </header>
  )
}
