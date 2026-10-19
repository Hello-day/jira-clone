// 与数据库对齐的 TypeScript 类型

export type IssueType = 'epic' | 'story' | 'task' | 'bug'
export type IssueStatus = 'todo' | 'in_progress' | 'done'
export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'
export type SprintStatus = 'future' | 'active' | 'completed'

export interface Profile {
  id: string
  name: string
  avatar_color: string
  created_at: string
}

export interface Project {
  id: string
  key: string
  name: string
  lead_id: string | null
  issue_counter: number
  created_at: string
}

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal: string | null
  status: SprintStatus
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface Issue {
  id: string
  project_id: string
  key: string
  type: IssueType
  title: string
  description: string | null
  status: IssueStatus
  priority: Priority
  assignee_id: string | null
  reporter_id: string | null
  sprint_id: string | null
  estimated_hours: number | null
  remaining_hours: number | null
  rank: number
  created_at: string
  updated_at: string
}

export const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

export const STATUS_ORDER: IssueStatus[] = ['todo', 'in_progress', 'done']

export const PRIORITY_LABELS: Record<Priority, string> = {
  highest: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  lowest: 'Lowest',
}

export const TYPE_META: Record<IssueType, { label: string; icon: string; color: string }> = {
  epic: { label: 'Epic', icon: '⚡', color: '#6554C0' },
  story: { label: 'Story', icon: '🔖', color: '#36B37E' },
  task: { label: 'Task', icon: '✓', color: '#4BADE8' },
  bug: { label: 'Bug', icon: '●', color: '#FF5630' },
}

export const PRIORITY_META: Record<Priority, { icon: string; color: string }> = {
  highest: { icon: '⤒', color: '#CD1317' },
  high: { icon: '↑', color: '#E9494A' },
  medium: { icon: '=', color: '#E97F33' },
  low: { icon: '↓', color: '#2D8738' },
  lowest: { icon: '⤓', color: '#57A55A' },
}
