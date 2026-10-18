import { create } from 'zustand'
import type { Issue, Project, Sprint } from '../types'
import { listProjects } from '../api/projects'
import { listSprints } from '../api/sprints'
import { listIssues, updateIssue as apiUpdateIssue } from '../api/issues'

interface DataState {
  projects: Project[]
  currentProjectId: string | null
  sprints: Sprint[]
  issues: Issue[]
  loading: boolean

  loadProjects: () => Promise<void>
  selectProject: (id: string) => Promise<void>
  reloadBoard: () => Promise<void>

  // 乐观更新单个 issue（拖拽/编辑用）；失败时回滚并重载
  patchIssueOptimistic: (id: string, patch: Partial<Issue>) => Promise<void>
  upsertIssueLocal: (issue: Issue) => void
  removeIssueLocal: (id: string) => void
  upsertSprintLocal: (sprint: Sprint) => void
}

export const useData = create<DataState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  sprints: [],
  issues: [],
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
      const [sprints, issues] = await Promise.all([listSprints(id), listIssues(id)])
      set({ sprints, issues, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  reloadBoard: async () => {
    const id = get().currentProjectId
    if (!id) return
    const [sprints, issues] = await Promise.all([listSprints(id), listIssues(id)])
    set({ sprints, issues })
  },

  patchIssueOptimistic: async (id, patch) => {
    const prev = get().issues
    set({ issues: prev.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
    try {
      const updated = await apiUpdateIssue(id, patch)
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
}))
