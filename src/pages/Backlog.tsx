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
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { useData } from '../store/data'
import { useAuth } from '../store/auth'
import type { Issue, Sprint } from '../types'
import { STATUS_LABELS, TYPE_META } from '../types'
import { computeRank } from '../api/issues'
import { createSprint, startSprint, completeSprint, deleteSprint } from '../api/sprints'
import { Avatar } from '../components/Avatar'
import { IssueModal } from '../components/IssueModal'
import { SprintModal } from '../components/SprintModal'

const STATUS_COLORS: Record<string, string> = {
  todo: '#42526e',
  in_progress: '#0052cc',
  done: '#36b37e',
}

// 一行可拖拽的 backlog issue
function IssueRow({ issue, onOpen }: { issue: Issue; onOpen: (i: Issue) => void }) {
  const { profiles } = useAuth()
  const assignee = profiles.find((p) => p.id === issue.assignee_id)
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
    <div ref={setNodeRef} style={style} className="issue-row" {...attributes} {...listeners}
      onClick={() => onOpen(issue)}>
      <span className="type-icon" style={{ color: TYPE_META[issue.type].color }}>
        {TYPE_META[issue.type].icon}
      </span>
      <span className="key">{issue.key}</span>
      <span className="title">{issue.title}</span>
      <span className="status-pill" style={{ background: STATUS_COLORS[issue.status] + '22', color: STATUS_COLORS[issue.status] }}>
        {STATUS_LABELS[issue.status]}
      </span>
      {issue.estimated_hours != null && (
        <span className="points" title="预估/剩余时长">
          {issue.remaining_hours != null ? `${issue.remaining_hours}h / ${issue.estimated_hours}h` : `${issue.estimated_hours}h`}
        </span>
      )}
      <Avatar profile={assignee} />
    </div>
  )
}

// 可放置的分组容器（sprint 或 backlog）
function Group({
  id,
  title,
  meta,
  issues,
  onOpen,
  onCreate,
  onEdit,
  headerExtra,
}: {
  id: string
  title: string
  meta?: string
  issues: Issue[]
  onOpen: (i: Issue) => void
  onCreate: () => void
  onEdit?: () => void
  headerExtra?: React.ReactNode
}) {
  // 注册整个分组为放置目标，空分组也能接收拖入
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className={id === 'backlog' ? 'backlog-block' : 'sprint-block'}>
      <div className="block-head">
        <div className="block-title">
          <span className="title">{title}</span>
          {meta && <span className="meta">{meta}</span>}
          {onEdit && (
            <button
              className="btn btn-subtle btn-sm"
              title="编辑 Sprint"
              onClick={onEdit}
              style={{ padding: '0 4px' }}
            >
              ✏️
            </button>
          )}
        </div>
        <div className="block-actions">
          {headerExtra}
          <span className="meta">{issues.length} issues</span>
        </div>
      </div>
      <div className="block-body" ref={setNodeRef} style={isOver ? { background: 'rgba(0,82,204,0.08)' } : undefined}>
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.length === 0 && <div className="drop-empty">把任务拖到这里</div>}
          {issues.map((i) => (
            <IssueRow key={i.id} issue={i} onOpen={onOpen} />
          ))}
        </SortableContext>

        <button className="btn btn-subtle btn-sm" style={{ margin: 6 }} onClick={onCreate}>
          + Create issue
        </button>
      </div>
    </div>
  )
}

export function Backlog() {
  const { currentProjectId, sprints, issues, reloadBoard, patchIssueOptimistic, upsertIssueLocal, upsertSprintLocal, removeSprintLocal } = useData()
  const [active, setActive] = useState<Issue | null>(null)
  const [opened, setOpened] = useState<Issue | null>(null)
  const [creating, setCreating] = useState<{ sprintId: string | null } | null>(null)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [expandedCompleted, setExpandedCompleted] = useState<Record<string, boolean>>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // 分组：每个未完成 sprint 一组 + backlog 一组
  const openSprints = useMemo(() => sprints.filter((s) => s.status !== 'completed'), [sprints])
  const completedSprints = useMemo(() => sprints.filter((s) => s.status === 'completed'), [sprints])

  const grouped = useMemo(() => {
    const map: Record<string, Issue[]> = { backlog: [] }
    openSprints.forEach((s) => (map[s.id] = []))
    const completedIds = new Set(completedSprints.map((s) => s.id))
    issues.forEach((i) => {
      // 已完成 Sprint 里的完成任务只在下方折叠区展示，不再落入 Backlog
      if (i.sprint_id && completedIds.has(i.sprint_id) && i.status === 'done') return
      const g = i.sprint_id && map[i.sprint_id] ? i.sprint_id : 'backlog'
      map[g].push(i)
    })
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.rank - b.rank))
    return map
  }, [issues, openSprints, completedSprints])

  function groupOf(issueId: string): string {
    const i = issues.find((x) => x.id === issueId)
    if (!i) return 'backlog'
    return i.sprint_id && grouped[i.sprint_id] ? i.sprint_id : 'backlog'
  }

  function onDragStart(e: DragStartEvent) {
    const i = issues.find((x) => x.id === e.active.id)
    setActive(i ?? null)
  }

  async function onDragEnd(e: DragEndEvent) {
    setActive(null)
    const { active, over } = e
    if (!over) return
    const activeId = active.id as string

    // over 可能是某个 issue（落在某行附近）或某个分组容器空处
    let targetGroup: string
    let targetList: Issue[]
    const overId = over.id as string

    if (overId === 'backlog' || openSprints.some((s) => s.id === overId)) {
      // 落在空分组
      targetGroup = overId
      targetList = grouped[targetGroup].filter((i) => i.id !== activeId)
      // 放末尾
      const before = targetList.length ? targetList[targetList.length - 1].rank : null
      await applyMove(activeId, targetGroup, computeRank(before, null))
      return
    }

    // 落在某个 issue 行上
    targetGroup = groupOf(overId)
    targetList = grouped[targetGroup].filter((i) => i.id !== activeId)
    const overIndex = targetList.findIndex((i) => i.id === overId)
    const insertAt = overIndex < 0 ? targetList.length : overIndex
    const before = insertAt > 0 ? targetList[insertAt - 1].rank : null
    const after = insertAt < targetList.length ? targetList[insertAt].rank : null
    await applyMove(activeId, targetGroup, computeRank(before, after))
  }

  async function applyMove(issueId: string, group: string, rank: number) {
    const sprintId = group === 'backlog' ? null : group
    await patchIssueOptimistic(issueId, { sprint_id: sprintId, rank })
  }

  function openCreate(group: string) {
    setCreating({ sprintId: group === 'backlog' ? null : group })
  }

  async function onCreateSprint() {
    if (!currentProjectId) return
    const n = sprints.length + 1
    try {
      const s = await createSprint(currentProjectId, `Sprint ${n}`)
      upsertSprintLocal(s)
    } catch (e: any) {
      alert(e?.message ?? 'Create sprint failed')
    }
  }

  async function onStartSprint(s: Sprint) {
    const now = new Date()
    const startDate = s.start_date ?? now.toISOString()
    const endDate = s.end_date ?? new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString()
    const updated = await startSprint(s.id, startDate, endDate)
    upsertSprintLocal(updated)
  }

  async function onCompleteSprint(s: Sprint) {
    if (!confirm(`完成 ${s.name}？未完成的任务会回到 Backlog，已完成的任务保留在 Sprint 中。`)) return
    // 把该 sprint 下未完成的 issue 移回 backlog
    const unfinished = issues.filter((i) => i.sprint_id === s.id && i.status !== 'done')
    await Promise.all(unfinished.map((i) => patchIssueOptimistic(i.id, { sprint_id: null })))
    const updated = await completeSprint(s.id)
    upsertSprintLocal(updated)
    await reloadBoard()
  }

  async function onDeleteSprint(s: Sprint) {
    if (!confirm(`删除 ${s.name}？Sprint 中所有任务会回到 Backlog。`)) return
    const inSprint = issues.filter((i) => i.sprint_id === s.id)
    await Promise.all(inSprint.map((i) => patchIssueOptimistic(i.id, { sprint_id: null })))
    await deleteSprint(s.id)
    removeSprintLocal(s.id)
    await reloadBoard()
  }

  if (!currentProjectId) {
    return <div className="center-note">请从左侧菜单选择或新建一个项目。</div>
  }

  return (
    <div className="page">
      <h1>Backlog</h1>
      <div className="page-sub">规划 Sprint，把任务拖入/拖出 Sprint。</div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {openSprints.map((s) => (
          <Group
            key={s.id}
            id={s.id}
            title={s.name}
            meta={
              s.status === 'active'
                ? `● 进行中${s.end_date ? ' · 截止 ' + format(new Date(s.end_date), 'MM/dd') : ''}`
                : '未开始'
            }
            issues={grouped[s.id] ?? []}
            onOpen={setOpened}
            onCreate={() => openCreate(s.id)}
            onEdit={() => setEditingSprint(s)}
            headerExtra={
              s.status === 'future' ? (
                <>
                  <button className="btn btn-sm btn-primary" onClick={() => onStartSprint(s)}>Start sprint</button>
                  <button className="btn btn-sm btn-danger" onClick={() => onDeleteSprint(s)}>Delete</button>
                </>
              ) : (
                <>
                  <button className="btn btn-sm" onClick={() => onCompleteSprint(s)}>Complete sprint</button>
                  <button className="btn btn-sm btn-danger" onClick={() => onDeleteSprint(s)}>Delete</button>
                </>
              )
            }
          />
        ))}

        <Group
          id="backlog"
          title="Backlog"
          issues={grouped.backlog}
          onOpen={setOpened}
          onCreate={() => openCreate('backlog')}
          headerExtra={
            <button className="btn btn-sm" onClick={onCreateSprint}>+ Create sprint</button>
          }
        />

        {completedSprints.map((s) => {
          const doneIssues = issues.filter((i) => i.sprint_id === s.id && i.status === 'done')
          const expanded = !!expandedCompleted[s.id]
          return (
            <div key={s.id} className="sprint-block sprint-block--completed">
              <div className="block-head">
                <div className="block-title">
                  <button
                    className="btn btn-subtle btn-sm"
                    onClick={() => setExpandedCompleted((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                    style={{ padding: '0 4px' }}
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                  <span className="title" style={{ opacity: 0.6 }}>{s.name}</span>
                  <span className="meta">✓ 已完成</span>
                </div>
                <div className="block-actions">
                  <span className="meta">{doneIssues.length} issues</span>
                  <button className="btn btn-sm btn-danger" onClick={() => onDeleteSprint(s)}>Delete</button>
                </div>
              </div>
              {expanded && (
                <div className="block-body">
                  {doneIssues.length === 0 && <div className="drop-empty">没有已完成的任务</div>}
                  {doneIssues.map((i) => (
                    <div key={i.id} className="issue-row" onClick={() => setOpened(i)}>
                      <span className="type-icon" style={{ color: TYPE_META[i.type].color }}>{TYPE_META[i.type].icon}</span>
                      <span className="key">{i.key}</span>
                      <span className="title">{i.title}</span>
                      <span className="status-pill" style={{ background: STATUS_COLORS[i.status] + '22', color: STATUS_COLORS[i.status] }}>
                        {STATUS_LABELS[i.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <DragOverlay>
          {active ? (
            <div className="issue-row" style={{ boxShadow: '0 4px 12px rgba(9,30,66,.3)' }}>
              <span className="type-icon" style={{ color: TYPE_META[active.type].color }}>{TYPE_META[active.type].icon}</span>
              <span className="key">{active.key}</span>
              <span className="title">{active.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {opened && <IssueModal issue={issues.find((i) => i.id === opened.id) ?? opened} onClose={() => setOpened(null)} />}
      {creating && (
        <IssueModal
          create={creating}
          onClose={() => setCreating(null)}
          onCreated={(issue) => upsertIssueLocal(issue)}
        />
      )}
      {editingSprint && (
        <SprintModal
          sprint={sprints.find((s) => s.id === editingSprint.id) ?? editingSprint}
          onClose={() => setEditingSprint(null)}
        />
      )}
    </div>
  )
}
