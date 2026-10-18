import { useState } from 'react'
import { signIn, signUp } from '../api/auth'

export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const res = await signUp(email, password, name || email.split('@')[0])
        // 若项目开启了邮箱验证，session 会为空
        if (!res.session) {
          setNotice('注册成功。如果开启了邮箱验证，请查收邮件后再登录；否则直接登录。')
          setMode('login')
        }
      } else {
        await signIn(email, password)
      }
      // 登录成功后由 auth store 的 onAuthStateChange 驱动跳转
    } catch (e: any) {
      setErr(e?.message ?? '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Jira Clone</h1>
        <div className="sub">{mode === 'login' ? '登录你的账号' : '创建新账号'}</div>

        {err && <div className="err">{err}</div>}
        {notice && (
          <div className="err" style={{ background: '#e3fcef', color: '#006644' }}>
            {notice}
          </div>
        )}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
            />
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '请稍候…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <div className="toggle">
          {mode === 'login' ? (
            <>
              没有账号？{' '}
              <a onClick={() => { setMode('signup'); setErr(null) }} style={{ cursor: 'pointer' }}>
                注册
              </a>
            </>
          ) : (
            <>
              已有账号？{' '}
              <a onClick={() => { setMode('login'); setErr(null) }} style={{ cursor: 'pointer' }}>
                登录
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
