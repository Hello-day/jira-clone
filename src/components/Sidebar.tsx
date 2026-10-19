import { NavLink } from 'react-router-dom'
import { useData } from '../store/data'

export function Sidebar({
  onNewProject,
  onNavigate,
}: {
  onNewProject: () => void
  onNavigate?: () => void
}) {
  const { projects, currentProjectId, selectProject } = useData()
  const current = projects.find((p) => p.id === currentProjectId)

  return (
    <aside className="sidebar">
      <div className="brand">
        <span style={{ fontSize: 18 }}>🗂️</span> Jira Clone
      </div>

      <div className="proj-switch">
        <select
          value={currentProjectId ?? ''}
          aria-label="切换项目"
          onChange={(e) => {
            if (e.target.value === '__new__') onNewProject()
            else {
              selectProject(e.target.value)
              onNavigate?.()
            }
          }}
        >
          {projects.length === 0 && <option value="">无项目</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.key} · {p.name}
            </option>
          ))}
          <option value="__new__">+ 新建项目…</option>
        </select>
      </div>

      {current && (
        <>
          <div className="nav-section">Planning</div>
          <NavLink to="/backlog" className="nav-item" onClick={onNavigate}>
            📋 Backlog
          </NavLink>
          <NavLink to="/board" className="nav-item" onClick={onNavigate}>
            📊 Board
          </NavLink>
          <div className="nav-section">Personal</div>
          <NavLink to="/dashboard" className="nav-item" onClick={onNavigate}>
            🏠 My Dashboard
          </NavLink>
        </>
      )}
    </aside>
  )
}

export function MobileTabBar() {
  const currentProjectId = useData((s) => s.currentProjectId)
  if (!currentProjectId) return null

  return (
    <nav className="mobile-tabbar" aria-label="页面导航">
      <NavLink to="/backlog" className="tab-item">
        <span className="tab-icon" aria-hidden>📋</span>
        Backlog
      </NavLink>
      <NavLink to="/board" className="tab-item">
        <span className="tab-icon" aria-hidden>📊</span>
        Board
      </NavLink>
      <NavLink to="/dashboard" className="tab-item">
        <span className="tab-icon" aria-hidden>🏠</span>
        我的
      </NavLink>
    </nav>
  )
}
