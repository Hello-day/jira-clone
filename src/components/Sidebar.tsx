import { NavLink } from 'react-router-dom'
import { useData } from '../store/data'

export function Sidebar({ onNewProject }: { onNewProject: () => void }) {
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
          onChange={(e) => {
            if (e.target.value === '__new__') onNewProject()
            else selectProject(e.target.value)
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
          <NavLink to="/backlog" className="nav-item">
            📋 Backlog
          </NavLink>
          <NavLink to="/board" className="nav-item">
            📊 Board
          </NavLink>
          <div className="nav-section">Personal</div>
          <NavLink to="/dashboard" className="nav-item">
            🏠 My Dashboard
          </NavLink>
        </>
      )}
    </aside>
  )
}
