import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getMyProfile, listProfiles } from '../api/auth'
import type { Profile } from '../types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  profiles: Profile[] // 所有用户（指派下拉用）
  loading: boolean
  init: () => Promise<void>
  loadProfiles: () => Promise<void>
  clear: () => void
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  profiles: [],
  loading: true,

  init: async () => {
    // 显式读取当前会话，不依赖 onAuthStateChange 的初始触发
    try {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      let profile: Profile | null = null
      if (session) {
        try {
          profile = await getMyProfile(session.user.id)
        } catch { /* profiles 表未就绪时不崩溃 */ }
      }
      set({ session, profile, loading: false })
      if (session) get().loadProfiles()
    } catch {
      set({ loading: false })
    }

    // 订阅后续登录/登出变化
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return // 已由上面 getSession 处理
      let profile: Profile | null = null
      if (session) {
        try { profile = await getMyProfile(session.user.id) } catch { /* ignore */ }
      }
      set({ session, profile, loading: false })
      if (session) get().loadProfiles()
      else set({ profiles: [] })
    })
  },

  loadProfiles: async () => {
    try {
      const profiles = await listProfiles()
      set({ profiles })
    } catch {
      // RLS 或网络问题时静默
    }
  },

  clear: () => set({ session: null, profile: null, profiles: [] }),
}))
