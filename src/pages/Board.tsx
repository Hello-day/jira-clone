import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useData } from '../store/data'
import { useAuth } from '../store/auth'
import type { Issue, IssueStatus } from '../types'
import { STATUS_LABELS, STATUS_ORDER, TYPE_META, PRIORITY_META } from '../types'
import { computeRank } from '../api/issues'
import { Avatar } from '../components/Avatar'
import { IssueModal } from '../components/IssueModal'

function CardInner({ issue }: { issue: Issue }) {
  const { profiles } = useAuth()
  const assignee = profiles.find((p) => p.id === issue.assignee_id)
  return (
    <>
      <div className="card-title">{issue.title}</div>
      <div className="card-foot">
        <div className="left">
          <span style={{ color: TYPE_META[issue.type].color }}>{TYPE_META[issue.type].icon}</span>
          <span>{issue.key}</span>
          <span style={{ color: PRIORITY_META[issue.priority].color }}>{PRIORITY_META[issue.priority].icon}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {issue.remaining_hours != null && (
            <span className="points" title="剩余时长">{issue.remaining_hours}h 剩</span>
          )}
          <Avatar profile={assignee} />
        </div>
      </div>
    </>
  )
}

function Card({ issue, onOpen }: { issue: Issue; onOpen: (i: Issue) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { issue },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="card" {...attributes} {...listeners} onClick={() => onOpen(issue)}>
      <CardInner issue={issue} />
    </div>
  )
}

function Column({
  status,
  issues,
  onOpen,
}: {
  status: IssueStatus
  issues: Issue[]
  onOpen: (i: Issue) => void
}) {
  const { setNodeRef } = useDroppable({ id: status })
  return (
    <div className="board-col">
      <h3>
        <span>{STATUS_LABELS[status]}</span>
        <span>{issues.length}</span>
      </h3>
      <div className="col-body" ref={setNodeRef}>
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((i) => (
            <Card key={i.id} issue={i} onOpen={onOpen} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

export function Board() {
  const { currentProjectId, sprints, issues, memberIds, patchIssueOptimistic } = useData()
  const { profiles } = useAuth()
  const projectMembers = useMemo(() => profiles.filter((p) => memberIds.includes(p.id)), [profiles, memberIds])
  const [active, setActive] = useState<Issue | null>(null)
  const [opened, setOpened] = useState<Issue | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const activeSprint = useMemo(() => sprints.find((s) => s.status === 'active'), [sprints])

  // 只显示 active sprint 的 issue；无 active sprint 则显示所有未归档（无 sprint 或任意）
  const boardIssues = useMemo(() => {
    let list = activeSprint ? issues.filter((i) => i.sprint_id === activeSprint.id) : issues.filter((i) => i.sprint_id)
    if (filterAssignee) list = list.filter((i) => i.assignee_id === filterAssignee)
    return list
  }, [issues, activeSprint, filterAssignee])

  const byStatus = useMemo(() => {
    const map: Record<IssueStatus, Issue[]> = { todo: [], in_progress: [], in_review: [], done: [] }
    boardIssues.forEach((i) => map[i.status].push(i))
    STATUS_ORDER.forEach((s) => map[s].sort((a, b) => a.rank - b.rank))
    return map
  }, [boardIssues])

  function statusOf(id: string): IssueStatus | null {
    return issues.find((i) => i.id === id)?.status ?? null
  }

  function onDragStart(e: DragStartEvent) {
    setActive(issues.find((i) => i.id === e.active.id) ?? null)
  }

  async function onDragEnd(e: DragEndEvent) {
    setActive(null)
    const { active, over } = e
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    // 落点所属列：over 是列 id，或是某卡片
    let targetStatus: IssueStatus
    if (STATUS_ORDER.includes(overId as IssueStatus)) {
      targetStatus = overId as IssueStatus
    } else {
      targetStatus = statusOf(overId) ?? 'todo'
    }

    const targetList = byStatus[targetStatus].filter((i) => i.id !== activeId)
    const overIndex = targetList.findIndex((i) => i.id === overId)
    const insertAt = overIndex < 0 ? targetList.length : overIndex
    const before = insertAt > 0 ? targetList[insertAt - 1].rank : null
    const after = insertAt < targetList.length ? targetList[insertAt].rank : null
    const rank = computeRank(before, after)

    await patchIssueOptimistic(activeId, { status: targetStatus, rank })
  }

  if (!currentProjectId) return <div className="center-note">请先在左上角创建一个项目。</div>

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Board</h1>
          <div className="page-sub">
            {activeSprint ? `${activeSprint.name}${activeSprint.goal ? ' · ' + activeSprint.goal : ''}` : '没有进行中的 Sprint，显示所有 Sprint 任务。去 Backlog 开始一个 Sprint。'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {projectMembers.map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterAssignee(filterAssignee === p.id ? null : p.id)}
              title={p.name}
              style={{
                border: filterAssignee === p.id ? '2px solid var(--j-blue)' : '2px solid transparent',
                borderRadius: '50%',
                background: 'none',
                padding: 1,
              }}
            >
              <Avatar profile={p} />
            </button>
          ))}
          {filterAssignee && (
            <button className="btn btn-sm" onClick={() => setFilterAssignee(null)}>清除</button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="board">
          {STATUS_ORDER.map((s) => (
            <Column key={s} status={s} issues={byStatus[s]} onOpen={setOpened} />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className="card" style={{ boxShadow: '0 4px 12px rgba(9,30,66,.3)' }}>
              <CardInner issue={active} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {opened && <IssueModal issue={issues.find((i) => i.id === opened.id) ?? opened} onClose={() => setOpened(null)} />}
    </div>
  )
}
