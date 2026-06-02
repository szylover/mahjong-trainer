import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/drill/ukeire', label: '訓練' },
  { to: '/defense', label: '防守' },
  { to: '/stats', label: '統計' },
  { to: '/settings', label: '設定' },
]

export default function NavBar() {
  return (
    <header className="nav-bar">
      <NavLink to="/" className="brand-link">
        <span className="brand-mark">🀄</span>
        <span>牌効訓練器</span>
      </NavLink>

      <nav className="nav-links" aria-label="主导航">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
