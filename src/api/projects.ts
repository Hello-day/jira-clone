import { supabase } from '../lib/supabase'
import type { Project } from '../types'

// 当前用户可访问的所有项目（RLS 已限制为其为成员的项目）
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Project[]
}

// 经由 RPC 创建项目（原子地把创建者加为成员 + 设 lead）
export async function createProject(key: string, name: string): Promise<Project> {
  const { data, error } = await supabase.rpc('create_project', {
    p_key: key,
    p_name: name,
  })
  if (error) throw error
  return data as Project
}

// 删除项目（级联删除其 sprints / issues / members）
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw error
}

// 把某个用户加入项目成员
export async function addMember(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId })
  if (error) throw error
}

// 把某个用户移出项目
export async function removeMember(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)
  if (error) throw error
}

// 列出某项目的成员 user_id 列表
export async function listMemberIds(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)
  if (error) throw error
  return (data ?? []).map((r) => r.user_id as string)
}
