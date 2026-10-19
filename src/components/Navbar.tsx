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
  const { profile, clear, updateName } = useAuth()
  const { projects, currentProjectId } = useData()
  const [open, setOpen] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameText, setNameText] = useState('')
  const [savingName, setSavingName] = useState(false)
  const loc = useLocation()
  const project = projects.find((p) => p.id === currentProjectId)
  const page = PAGE_TITLES[loc.pathname] ?? ''

  async function doLogout() {
    try { await signOut() } catch { /* 本地/网络异常时也要清除本地状态 */ }
    clear()
  }

  async function saveName() {
    const n = nameText.trim()
    if (!n || n === profile?.name) { setEditingName(false); return }
    setSavingName(true)
    try {
      await updateName(n)
      setEditingName(false)
    } catch {
      /* 失败保持编辑态 */
    } finally {
      setSavingName(false)
    }
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
            <div className="menu-pop" onMouseLeave={() => { setOpen(false); setEditingName(false) }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--j-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingName ? (
                  <input
                    autoFocus
                    value={nameText}
                    disabled={savingName}
                    onChange={(e) => setNameText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName()
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                    onBlur={() => setEditingName(false)}
                    style={{ flex: 1, padding: '4px 6px' }}
                    placeholder="输入新用户名，回车保存"
                  />
                ) : (
                  <>
                    <div style={{ fontWeight: 600, flex: 1 }}>{profile?.name}</div>
                    <button
                      className="btn btn-subtle btn-sm"
                      title="修改用户名"
                      onClick={() => { setNameText(profile?.name ?? ''); setEditingName(true) }}
                      style={{ padding: '0 4px' }}
                    >
                      ✏️
                    </button>
                  </>
                )}
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
