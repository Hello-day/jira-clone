import { supabase } from '../lib/supabase'
import type { Issue, Sprint } from '../types'

/** 最近结束的已完成 Sprint。没有结束日期时用创建时间。 */
export function latestCompletedSprint(sprints: Sprint[], projectId: string): Sprint | undefined {
  return sprints
    .filter((s) => s.project_id === projectId && s.status === 'completed')
    .sort((a, b) => {
      const time = (s: Sprint) => new Date(s.end_date ?? s.created_at).getTime()
      return time(b) - time(a)
    })[0]
}

/**
 * 完成的任务如果不在任何 Sprint 里，归入上一个已完成 Sprint，这样会折叠在该 Sprint 下。
 * 已完成 Sprint 中的任务被改回未完成时，移回 Backlog。
 * 补丁里已经写了 sprint_id 时保持原样。
 */
export function adjustSprintForStatusChange(sprints: Sprint[], issue: Issue, patch: Partial<Issue>): Partial<Issue> {
  if (!patch.status || patch.status === issue.status || patch.sprint_id !== undefined) return patch
  if (patch.status === 'done') {
    if (issue.sprint_id) return patch
    const target = latestCompletedSprint(sprints, issue.project_id)
    return target ? { ...patch, sprint_id: target.id } : patch
  }
  const current = sprints.find((s) => s.id === issue.sprint_id)
  if (current?.status === 'completed') return { ...patch, sprint_id: null }
  return patch
}

export async function listSprints(projectId: string): Promise<Sprint[]> {
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Sprint[]
}

export async function createSprint(projectId: string, name: string, goal?: string): Promise<Sprint> {
  const { data, error } = await supabase
    .from('sprints')
    .insert({ project_id: projectId, name, goal: goal ?? null })
    .select()
    .single()
  if (error) throw error
  return data as Sprint
}

export async function startSprint(sprintId: string, startDate: string, endDate: string): Promise<Sprint> {
  const { data, error } = await supabase
    .from('sprints')
    .update({ status: 'active', start_date: startDate, end_date: endDate })
    .eq('id', sprintId)
    .select()
    .single()
  if (error) throw error
  return data as Sprint
}

export async function completeSprint(sprintId: string): Promise<Sprint> {
  const { data, error } = await supabase
    .from('sprints')
    .update({ status: 'completed' })
    .eq('id', sprintId)
    .select()
    .single()
  if (error) throw error
  return data as Sprint
}

export async function updateSprint(
  sprintId: string,
  patch: { name?: string; goal?: string | null; start_date?: string | null; end_date?: string | null; status?: 'future' | 'active' | 'completed' }
): Promise<Sprint> {
  const { data, error } = await supabase
    .from('sprints')
    .update(patch)
    .eq('id', sprintId)
    .select()
    .single()
  if (error) throw error
  return data as Sprint
}

export async function deleteSprint(sprintId: string): Promise<void> {
  const { error } = await supabase.from('sprints').delete().eq('id', sprintId)
  if (error) throw error
}
