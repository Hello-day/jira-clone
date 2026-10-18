import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useData } from '../store/data'
import { signOut } from '../api/auth'
import { Avatar } from './Avatar'
import { MembersModal } from './MembersModal'

const PAGE_TITLES: Record<string, string> = {
  '/backlog': 'Backlog',
  '/board': 'Board',
  '/dashboard': 'My Dashboard',
}

export function Navbar() {
  const { profile, clear } = useAuth()
  const { projects, currentProjectId } = useData()
  const [open, setOpen] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const loc = useLocation()
  const project = projects.find((p) => p.id === currentProjectId)
  const page = PAGE_TITLES[loc.pathname] ?? ''

  async function doLogout() {
    await signOut()
    clear()
  }

  return (
    <div className="navbar">
      <div className="crumbs">
        {project ? `${project.name} / ${page}` : page}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {project && (
          <button className="btn btn-sm" onClick={() => setShowMembers(true)}>
            👥 成员
          </button>
        )}
        <div className="user-menu">
          <button className="btn-subtle" onClick={() => setOpen((o) => !o)} style={{ border: 'none', background: 'none' }}>
            <Avatar profile={profile} size="lg" />
          </button>
          {open && (
            <div className="menu-pop" onMouseLeave={() => setOpen(false)}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--j-border)' }}>
                <div style={{ fontWeight: 600 }}>{profile?.name}</div>
              </div>
              <button onClick={doLogout}>Log out</button>
            </div>
          )}
        </div>
      </div>

      {showMembers && project && (
        <MembersModal project={project} onClose={() => setShowMembers(false)} />
      )}
    </div>
  )
}
