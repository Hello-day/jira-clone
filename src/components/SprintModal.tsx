import { useState } from 'react'
import type { Sprint } from '../types'
import { updateSprint } from '../api/sprints'
import { useData } from '../store/data'

// 把 ISO 时间转成 <input type="date"> 需要的 yyyy-MM-dd
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function SprintModal({
  sprint,
  onClose,
}: {
  sprint: Sprint
  onClose: () => void
}) {
  const { upsertSprintLocal } = useData()
  const [name, setName] = useState(sprint.name)
  const [goal, setGoal] = useState(sprint.goal ?? '')
  const [start, setStart] = useState(toDateInput(sprint.start_date))
  const [end, setEnd] = useState(toDateInput(sprint.end_date))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) { setErr('名称不能为空'); return }
    if (start && end && new Date(end) < new Date(start)) {
      setErr('结束日期不能早于开始日期')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const updated = await updateSprint(sprint.id, {
        name: name.trim(),
        goal: goal.trim() || null,
        start_date: start ? new Date(start).toISOString() : null,
        end_date: end ? new Date(end).toISOString() : null,
      })
      upsertSprintLocal(updated)
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? '保存失败')
    } finally {
      setBusy(false)
    }
  }

  // 显示时长（天数）
  const days =
    start && end
      ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
      : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 style={{ margin: 0, fontSize: 18 }}>编辑 Sprint</h2>
          <button className="btn btn-subtle" onClick={onClose}>✕</button>
        </div>

        {err && (
          <div style={{ background: '#ffebe6', color: '#bf2600', padding: '8px 12px', borderRadius: 3, marginBottom: 12, fontSize: 13 }}>
            {err}
          </div>
        )}

        <div className="field">
          <label>Sprint 名称</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label>Sprint 目标（可选）</label>
          <textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="本次 Sprint 要达成什么…" />
        </div>

        <div className="row-2">
          <div className="field">
            <label>开始日期</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label>结束日期</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        {days != null && (
          <div style={{ color: 'var(--j-subtle)', fontSize: 13, marginBottom: 8 }}>
            时长：{days} 天
          </div>
        )}

        <div className="modal-actions modal-actions-end">
          <button className="btn" onClick={onClose} disabled={busy}>取消</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>保存</button>
        </div>
      </div>
    </div>
  )
}
