import { useState } from 'react'
import { createProject } from '../api/projects'
import { useData } from '../store/data'

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { loadProjects, selectProject } = useData()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 名字变化时自动生成 key（取首字母大写，最多 4 位）
  function onName(v: string) {
    setName(v)
    if (!key || key === autoKey(name)) setKey(autoKey(v))
  }
  function autoKey(v: string): string {
    const letters = v.replace(/[^a-zA-Z]/g, '')
    return letters.slice(0, 4).toUpperCase()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const proj = await createProject(key || autoKey(name) || 'PROJ', name.trim())
      await loadProjects()
      await selectProject(proj.id)
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 style={{ margin: 0, fontSize: 18 }}>New project</h2>
          <button className="btn btn-subtle" onClick={onClose}>✕</button>
        </div>
        {err && <div className="err">{err}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Name</label>
            <input autoFocus value={name} onChange={(e) => onName(e.target.value)} placeholder="My Project" required />
          </div>
          <div className="field">
            <label>Key（任务编号前缀，如 PROJ-1）</label>
            <input value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="PROJ" maxLength={8} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !name.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}
