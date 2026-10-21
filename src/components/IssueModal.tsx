import { useEffect, useState } from 'react'
import type { Issue, IssueStatus, Priority } from '../types'
import { STATUS_LABELS, STATUS_ORDER, PRIORITY_LABELS, TYPE_META } from '../types'
import { useAuth } from '../store/auth'
import { useData } from '../store/data'
import { createIssue, deleteIssue, updateIssue } from '../api/issues'
import { Avatar } from './Avatar'

const PRIORITIES = Object.keys(PRIORITY_LABELS) as (keyof typeof PRIORITY_LABELS)[]

export function IssueModal({
  issue,
  create,
  onClose,
  onCreated,
}: {
  issue?: Issue
  create?: { sprintId: string | null }
  onClose: () => void
  onCreated?: (issue: Issue) => void
}) {
  const { profiles, session, profile } = useAuth()
  const { currentProjectId, patchIssueOptimistic, removeIssueLocal, memberIds } = useData()
  const isCreate = !issue
  const myId = session?.user.id ?? ''

  const [title, setTitle] = useState(issue?.title ?? '')
  const [description, setDescription] = useState(issue?.description ?? '')
  const [status, setStatus] = useState<IssueStatus>(issue?.status ?? 'todo')
  const [priority, setPriority] = useState<Priority>(issue?.priority ?? 'medium')
  const [assignee, setAssignee] = useState(issue?.assignee_id ?? (memberIds.includes(myId) ? myId : ''))
  const [estimated, setEstimated] = useState<string>(issue?.estimated_hours?.toString() ?? '')
  const [remaining, setRemaining] = useState<string>(issue?.remaining_hours?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  async function save() {
    const nextTitle = title.trim()
    if (isCreate && !nextTitle) return
    setBusy(true)
    setErr(null)
    try {
      if (isCreate) {
        if (!currentProjectId) throw new Error('请先选择项目')
        let created = await createIssue({
          projectId: currentProjectId,
          type: 'task',
          title: nextTitle,
          sprintId: create?.sprintId ?? null,
          assigneeId: assignee || null,
          priority,
          estimatedHours: estimated === '' ? null : Number(estimated),
        })
        const patch: Partial<Issue> = {}
        if (description.trim()) patch.description = description.trim()
        if (status !== 'todo') patch.status = status
        if (remaining !== '') patch.remaining_hours = Number(remaining)
        if (Object.keys(patch).length > 0) created = await updateIssue(created.id, patch)
        onCreated?.(created)
        onClose()
        return
      }
      await patchIssueOptimistic(issue.id, {
        title: nextTitle || issue.title,
        description: description.trim() || null,
        status,
        priority,
        assignee_id: assignee || null,
        estimated_hours: estimated === '' ? null : Number(estimated),
        remaining_hours: remaining === '' ? null : Number(remaining),
      })
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? '保存失败，请检查控制台')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!issue) return
    if (!confirm('确定删除该任务？')) return
    setBusy(true)
    try {
      await deleteIssue(issue.id)
      removeIssueLocal(issue.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const reporter = profiles.find((p) => p.id === (issue?.reporter_id ?? myId)) ?? (isCreate ? profile : undefined)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--j-subtle)', fontWeight: 600 }}>
            <span style={{ color: TYPE_META[issue?.type ?? 'task'].color }}>{TYPE_META[issue?.type ?? 'task'].icon}</span>
            {isCreate ? 'Create issue' : issue.key}
          </div>
          <button className="btn btn-subtle" onClick={onClose}>✕</button>
        </div>

        {err && (
          <div style={{ background: '#ffebe6', color: '#bf2600', padding: '8px 12px', borderRadius: 3, marginBottom: 12, fontSize: 13 }}>
            {err}
          </div>
        )}

        <div className="field">
          <label>Title</label>
          <input autoFocus={isCreate} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isCreate ? '任务标题' : undefined} />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="添加描述…" />
        </div>

        <div className="row-2">
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row-2">
          <div className="field">
            <label>Assignee</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {profiles.filter((p) => memberIds.includes(p.id)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>预估时长（小时）</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={estimated}
              onChange={(e) => setEstimated(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="field">
            <label>剩余时长（小时）</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>

        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--j-subtle)' }}>
          <span>Reporter:</span>
          <Avatar profile={reporter} />
          <span>{reporter?.name ?? '—'}</span>
        </div>

        <div className="modal-actions">
          {isCreate ? <span /> : (
            <button className="btn" onClick={remove} disabled={busy} style={{ color: 'var(--j-red)' }}>
              Delete
            </button>
          )}
          <div className="modal-actions-right">
            <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy || (isCreate && !title.trim())}>
              {isCreate ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
