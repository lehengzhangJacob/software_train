import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: '今日' },
  { to: '/recognize', label: '识别' },
  { to: '/calendar', label: '日历' },
  { to: '/trends', label: '趋势' },
  { to: '/exercise', label: '运动' },
  { to: '/profile', label: '我的' },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">智膳</div>
          <div className="brand-sub">AI 食物热量估计与饮食管理</div>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
