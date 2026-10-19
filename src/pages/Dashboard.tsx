import { useMemo, useState } from 'react'
import { useData } from '../store/data'
import { useAuth } from '../store/auth'
import type { Issue } from '../types'
import { STATUS_LABELS, TYPE_META } from '../types'
import { IssueModal } from '../components/IssueModal'

function MiniRow({ issue, onOpen }: { issue: Issue; onOpen: (i: Issue) => void }) {
  return (
    <div className="issue-row" style={{ cursor: 'pointer' }} onClick={() => onOpen(issue)}>
      <span className="type-icon" style={{ color: TYPE_META[issue.type].color }}>
        {TYPE_META[issue.type].icon}
      </span>
      <span className="key">{issue.key}</span>
      <span className="title">{issue.title}</span>
      {issue.remaining_hours != null && (
        <span className="points" title="剩余时长">{issue.remaining_hours}h 剩</span>
      )}
    </div>
  )
}

export function Dashboard() {
  const { issues, currentProjectId } = useData()
  const { session, profile } = useAuth()
  const [opened, setOpened] = useState<Issue | null>(null)
  const uid = session?.user.id

  // 当前用户被指派的任务（当前项目）
  const mine = useMemo(() => issues.filter((i) => i.assignee_id === uid), [issues, uid])

  const todo = mine.filter((i) => i.status === 'todo')
  const inProgress = mine.filter((i) => i.status === 'in_progress')
  const done = mine.filter((i) => i.status === 'done')

  const totalEstimated = mine.reduce((s, i) => s + (i.estimated_hours ?? 0), 0)
  const totalRemaining = mine.filter((i) => i.status !== 'done').reduce((s, i) => s + (i.remaining_hours ?? i.estimated_hours ?? 0), 0)
  const totalDoneHours = done.reduce((s, i) => s + (i.estimated_hours ?? 0), 0)

  if (!currentProjectId) return <div className="center-note">请先在左上角创建一个项目。</div>

  return (
    <div className="page">
      <h1>👋 {profile?.name}，你好</h1>
      <div className="page-sub">当前项目中指派给你的工作</div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="n">{mine.length}</div>
          <div className="l">我的全部任务</div>
        </div>
        <div className="stat-card">
          <div className="n">{inProgress.length}</div>
          <div className="l">进行中</div>
        </div>
        <div className="stat-card">
          <div className="n">{done.length}</div>
          <div className="l">已完成</div>
        </div>
        <div className="stat-card">
          <div className="n">{totalEstimated > 0 ? `${totalEstimated}h` : '—'}</div>
          <div className="l">预估总时长</div>
        </div>
        <div className="stat-card">
          <div className="n" style={{ color: totalRemaining > 0 ? '#E97F33' : '#36b37e' }}>
            {totalRemaining > 0 ? `${totalRemaining}h` : '✓'}
          </div>
          <div className="l">剩余总时长</div>
        </div>
        <div className="stat-card">
          <div className="n">{totalDoneHours > 0 ? `${totalDoneHours}h` : '—'}</div>
          <div className="l">已完成工时</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <h3>
            {STATUS_LABELS.todo} <span className="count">{todo.length}</span>
          </h3>
          {todo.length === 0 && <div className="drop-empty">没有待办</div>}
          {todo.map((i) => <MiniRow key={i.id} issue={i} onOpen={setOpened} />)}
        </div>

        <div className="dash-col">
          <h3>
            进行中 <span className="count">{inProgress.length}</span>
          </h3>
          {inProgress.length === 0 && <div className="drop-empty">没有进行中的任务</div>}
          {inProgress.map((i) => <MiniRow key={i.id} issue={i} onOpen={setOpened} />)}
        </div>

        <div className="dash-col">
          <h3>
            已完成 <span className="count">{done.length}</span>
          </h3>
          {done.length === 0 && <div className="drop-empty">还没有完成的任务</div>}
          {done.map((i) => <MiniRow key={i.id} issue={i} onOpen={setOpened} />)}
        </div>
      </div>

      {opened && <IssueModal issue={issues.find((i) => i.id === opened.id) ?? opened} onClose={() => setOpened(null)} />}
    </div>
  )
}
