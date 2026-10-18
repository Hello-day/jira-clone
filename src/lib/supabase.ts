import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 缺少配置时给出清晰的报错（而不是运行时神秘崩溃）
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // 不抛出，让应用能渲染出"未配置"提示页；仅在控制台警告
  console.warn(
    '[jira-clone] Supabase 未配置：请在 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
