import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useData } from '../store/data'
import { signOut, updatePassword } from '../api/auth'
import { Avatar } from './Avatar'
import { MembersModal } from './MembersModal'

const PAGE_TITLES: Record<string, string> = {
  '/backlog': 'Backlog',
  '/board': 'Board',
  '/dashboard': 'My Dashboard',
}

export function Navbar({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  const { profile, clear, updateName } = useAuth()
  const { projects, currentProjectId, reloadMembers } = useData()
  const [open, setOpen] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameText, setNameText] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdText, setPwdText] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdErr, setPwdErr] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const loc = useLocation()
  const project = projects.find((p) => p.id === currentProjectId)
  const page = PAGE_TITLES[loc.pathname] ?? ''

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setEditingName(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function savePwd() {
    const p = pwdText.trim()
    if (!p) { setChangingPwd(false); return }
    if (p.length < 6) { setPwdErr('至少 6 位'); return }
    setSavingPwd(true)
    setPwdErr(null)
    try {
      await updatePassword(p)
      setChangingPwd(false)
      setPwdText('')
    } catch (e: any) {
      setPwdErr(e?.message ?? '修改失败')
    } finally {
      setSavingPwd(false)
    }
  }

  function doLogout() {
    clear()
    signOut().catch(() => {})
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
      <div className="navbar-left">
        <button
          type="button"
          className="menu-btn"
          aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={menuOpen}
          onClick={onMenu}
        >
          <span className="menu-icon" />
        </button>
        <div className="crumbs">
          {project ? `${project.name} / ${page}` : page}
        </div>
      </div>
      <div className="navbar-actions">
        {project && (
          <button className="btn btn-sm" onClick={() => setShowMembers(true)}>
            👥 成员
          </button>
        )}
        <div className="user-menu" ref={menuRef}>
          <button className="btn-subtle" onClick={() => setOpen((o) => !o)} style={{ border: 'none', background: 'none' }}>
            <Avatar profile={profile} size="lg" />
          </button>
          {open && (
            <div className="menu-pop">
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
              {changingPwd ? (
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--j-border)' }}>
                  <input
                    autoFocus
                    type="password"
                    value={pwdText}
                    disabled={savingPwd}
                    onChange={(e) => setPwdText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') savePwd()
                      if (e.key === 'Escape') { setChangingPwd(false); setPwdText(''); setPwdErr(null) }
                    }}
                    onBlur={() => { setChangingPwd(false); setPwdText(''); setPwdErr(null) }}
                    style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }}
                    placeholder="新密码（至少 6 位），回车保存"
                    minLength={6}
                  />
                  {pwdErr && <div style={{ color: '#de350b', fontSize: 12, marginTop: 4 }}>{pwdErr}</div>}
                </div>
              ) : (
                <button onMouseDown={e => e.preventDefault()} onClick={() => { setChangingPwd(true); setPwdText(''); setPwdErr(null) }}>修改密码</button>
              )}
              <button onMouseDown={e => e.preventDefault()} onClick={doLogout}>Log out</button>
            </div>
          )}
        </div>
      </div>

      {showMembers && project && (
        <MembersModal project={project} onClose={() => { setShowMembers(false); reloadMembers() }} />
      )}
    </div>
  )
}
