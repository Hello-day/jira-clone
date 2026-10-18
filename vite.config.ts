import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// base 需与 GitHub 仓库名一致，部署到 https://<user>.github.io/<repo>/
// 可通过环境变量 VITE_BASE 覆盖（部署脚本里注入）；默认 '/jira-clone/'。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: env.VITE_BASE || '/jira-clone/',
  }
})
