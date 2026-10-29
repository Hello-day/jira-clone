import { create } from 'zustand'
import type { Issue, Project, Sprint } from '../types'
import { listProjects, listMemberIds } from '../api/projects'
import { adjustSprintForStatusChange, latestCompletedSprint, listSprints } from '../api/sprints'
import { listIssues, updateIssue as apiUpdateIssue } from '../api/issues'

interface DataState {
  projects: Project[]
  currentProjectId: string | null
  sprints: Sprint[]
  issues: Issue[]
  memberIds: string[]
  loading: boolean

  loadProjects: () => Promise<void>
  selectProject: (id: string) => Promise<void>
  reloadBoard: () => Promise<void>
  reloadMembers: () => Promise<void>

  // 乐观更新单个 issue（拖拽/编辑用）；失败时回滚并重载
  patchIssueOptimistic: (id: string, patch: Partial<Issue>) => Promise<void>
  upsertIssueLocal: (issue: Issue) => void
  removeIssueLocal: (id: string) => void
  upsertSprintLocal: (sprint: Sprint) => void
  removeSprintLocal: (id: string) => void
}

export const useData = create<DataState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  sprints: [],
  issues: [],
  memberIds: [],
  loading: false,

  loadProjects: async () => {
    const projects = await listProjects()
    set({ projects })
    const cur = get().currentProjectId
    if (!cur && projects.length > 0) {
      await get().selectProject(projects[0].id)
    } else if (cur && !projects.find((p) => p.id === cur)) {
      // 当前项目已不存在
      if (projects.length > 0) await get().selectProject(projects[0].id)
      else set({ currentProjectId: null, sprints: [], issues: [] })
    }
  },

  selectProject: async (id: string) => {
    set({ currentProjectId: id, loading: true })
    try {
      const [sprints, issues, memberIds] = await Promise.all([listSprints(id), listIssues(id), listMemberIds(id)])
      set({ sprints, issues: await foldLooseDoneIssues(sprints, issues), memberIds, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  reloadBoard: async () => {
    const id = get().currentProjectId
    if (!id) return
    const [sprints, issues] = await Promise.all([listSprints(id), listIssues(id)])
    set({ sprints, issues: await foldLooseDoneIssues(sprints, issues) })
  },

  reloadMembers: async () => {
    const id = get().currentProjectId
    if (!id) return
    const memberIds = await listMemberIds(id)
    set({ memberIds })
  },

  patchIssueOptimistic: async (id, patch) => {
    const prev = get().issues
    const current = prev.find((i) => i.id === id)
    const nextPatch = current ? adjustSprintForStatusChange(get().sprints, current, patch) : patch
    set({ issues: prev.map((i) => (i.id === id ? { ...i, ...nextPatch } : i)) })
    try {
      const updated = await apiUpdateIssue(id, nextPatch)
      set({ issues: get().issues.map((i) => (i.id === id ? updated : i)) })
    } catch (e) {
      set({ issues: prev }) // 回滚
      throw e
    }
  },

  upsertIssueLocal: (issue) => {
    const exists = get().issues.find((i) => i.id === issue.id)
    set({
      issues: exists
        ? get().issues.map((i) => (i.id === issue.id ? issue : i))
        : [...get().issues, issue],
    })
  },

  removeIssueLocal: (id) => set({ issues: get().issues.filter((i) => i.id !== id) }),

  upsertSprintLocal: (sprint) => {
    const exists = get().sprints.find((s) => s.id === sprint.id)
    set({
      sprints: exists
        ? get().sprints.map((s) => (s.id === sprint.id ? sprint : s))
        : [...get().sprints, sprint],
    })
  },

  removeSprintLocal: (id) => set({ sprints: get().sprints.filter((s) => s.id !== id) }),
}))

/** 已经完成、但还留在 Backlog 的任务，归入上一个已完成 Sprint。 */
async function foldLooseDoneIssues(sprints: Sprint[], issues: Issue[]): Promise<Issue[]> {
  const loose = issues.filter((i) => i.status === 'done' && !i.sprint_id)
  if (loose.length === 0) return issues
  const replacements = new Map<string, Issue>()
  await Promise.all(loose.map(async (issue) => {
    const target = latestCompletedSprint(sprints, issue.project_id)
    if (!target) return
    try {
      replacements.set(issue.id, await apiUpdateIssue(issue.id, { sprint_id: target.id }))
    } catch {
      /* 下次进入项目再试 */
    }
  }))
  if (replacements.size === 0) return issues
  return issues.map((i) => replacements.get(i.id) ?? i)
}
