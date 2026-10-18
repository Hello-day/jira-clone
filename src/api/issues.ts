import { supabase } from '../lib/supabase'
import type { Issue, IssueType, Priority } from '../types'

export async function listIssues(projectId: string): Promise<Issue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('project_id', projectId)
    .order('rank', { ascending: true })
  if (error) throw error
  return (data ?? []) as Issue[]
}

export async function createIssue(params: {
  projectId: string
  type: IssueType
  title: string
  sprintId?: string | null
  assigneeId?: string | null
  priority?: Priority
  estimatedHours?: number | null
}): Promise<Issue> {
  const { data, error } = await supabase.rpc('create_issue', {
    p_project_id: params.projectId,
    p_type: params.type,
    p_title: params.title,
    p_sprint_id: params.sprintId ?? null,
    p_assignee_id: params.assigneeId ?? null,
    p_priority: params.priority ?? 'medium',
    p_estimated_hours: params.estimatedHours ?? null,
  })
  if (error) throw error
  return data as Issue
}

// 通用部分更新（拖拽改 status/sprint_id/rank，或编辑字段都走这里）
export async function updateIssue(id: string, patch: Partial<Issue>): Promise<Issue> {
  const { data, error } = await supabase
    .from('issues')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Issue
}

export async function deleteIssue(id: string): Promise<void> {
  const { error } = await supabase.from('issues').delete().eq('id', id)
  if (error) throw error
}

// 计算把一个 issue 放到 before/after 两项之间时应有的 rank。
// before/after 为相邻项的 rank（可为空表示放到首/尾）。
export function computeRank(before: number | null, after: number | null): number {
  if (before == null && after == null) return 1000
  if (before == null) return (after as number) - 1000
  if (after == null) return before + 1000
  return (before + after) / 2
}
