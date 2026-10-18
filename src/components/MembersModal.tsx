import { useEffect, useState } from 'react'
import { useAuth } from '../store/auth'
import { addMember, removeMember, listMemberIds } from '../api/projects'
import { Avatar } from './Avatar'
import type { Project } from '../types'

export function MembersModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { profiles, session } = useAuth()
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pick, setPick] = useState('')

  async function reload() {
    setLoading(true)
    try {
      setMemberIds(await listMemberIds(project.id))
    } catch (e: any) {
      setErr(e?.message ?? '加载成员失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const members = profiles.filter((p) => memberIds.includes(p.id))
  const nonMembers = profiles.filter((p) => !memberIds.includes(p.id))

  async function add() {
    if (!pick) return
    setBusy(true)
    setErr(null)
    try {
      await addMember(project.id, pick)
      setPick('')
      await reload()
    } catch (e: any) {
      setErr(e?.message ?? '添加失败')
    } finally {
      setBusy(false)
    }
  }

  async function remove(userId: string) {
    if (userId === project.lead_id) {
      setErr('不能移除项目负责人')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await removeMember(project.id, userId)
      await reload()
    } catch (e: any) {
      setErr(e?.message ?? '移除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 style={{ margin: 0, fontSize: 18 }}>项目成员 · {project.name}</h2>
          <button className="btn btn-subtle" onClick={onClose}>✕</button>
        </div>

        {err && (
          <div style={{ background: '#ffebe6', color: '#bf2600', padding: '8px 12px', borderRadius: 3, marginBottom: 12, fontSize: 13 }}>
            {err}
          </div>
        )}

        <div className="field">
          <label>添加成员</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
              <option value="">选择一个用户…</option>
              {nonMembers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={add} disabled={busy || !pick}>添加</button>
          </div>
          {nonMembers.length === 0 && (
            <div style={{ color: 'var(--j-subtle)', fontSize: 12, marginTop: 6 }}>
              所有已注册用户都已是成员。其他人需要先注册账号，才会出现在这里。
            </div>
          )}
        </div>

        <div className="field">
          <label>当前成员（{members.length}）</label>
          {loading ? (
            <div className="drop-empty">加载中…</div>
          ) : (
            members.map((p) => (
              <div key={p.id} className="issue-row" style={{ cursor: 'default' }}>
                <Avatar profile={p} />
                <span className="title">{p.name}</span>
                {p.id === project.lead_id && <span className="points">负责人</span>}
                {p.id === session?.user.id && <span className="points">我</span>}
                {p.id !== project.lead_id && (
                  <button className="btn btn-sm" style={{ color: 'var(--j-red)' }} onClick={() => remove(p.id)} disabled={busy}>
                    移除
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
