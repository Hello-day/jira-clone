import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './store/auth'
import { useData } from './store/data'
import { isSupabaseConfigured } from './lib/supabase'
import { Login } from './pages/Login'
import { Backlog } from './pages/Backlog'
import { Board } from './pages/Board'
import { Dashboard } from './pages/Dashboard'
import { Sidebar, MobileTabBar } from './components/Sidebar'
import { Navbar } from './components/Navbar'
import { NewProjectModal } from './components/NewProjectModal'

function NotConfigured() {
  return (
    <div className="center-note">
      <h2>需要配置 Supabase</h2>
      <p>
        请在项目根目录创建 <code>.env</code> 文件（可复制 <code>.env.example</code>），填入你的
        Supabase 项目信息：
      </p>
      <pre style={{ background: '#f4f5f7', padding: 12, borderRadius: 4 }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
      </pre>
      <p>详见 <code>README.md</code>。配置后重启 <code>npm run dev</code>。</p>
    </div>
  )
}

function Shell() {
  const { loadProjects: _lp, currentProjectId } = useData()
  const [showNewProject, setShowNewProject] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    useData.getState().loadProjects()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className={`app-shell${navOpen ? ' nav-open' : ''}`}>
      <button
        type="button"
        className="nav-backdrop"
        aria-label="关闭菜单"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />
      <Sidebar
        onNewProject={() => {
          setNavOpen(false)
          setShowNewProject(true)
        }}
        onNavigate={() => setNavOpen(false)}
      />
      <div className="main">
        <Navbar onMenu={() => setNavOpen((open) => !open)} menuOpen={navOpen} />
        <Routes>
          <Route path="/backlog" element={<Backlog />} />
          <Route path="/board" element={<Board />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to={currentProjectId ? '/board' : '/backlog'} replace />} />
        </Routes>
        <MobileTabBar />
      </div>
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  useEffect(() => {
    useAuth.getState().init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isSupabaseConfigured) return <NotConfigured />
  if (loading) return <div className="spinner">加载中…</div>

  return (
    <HashRouter>
      {session ? <Shell /> : <Login />}
    </HashRouter>
  )
}
