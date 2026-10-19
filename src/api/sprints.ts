import { supabase } from '../lib/supabase'
import type { Sprint } from '../types'

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
