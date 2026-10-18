# Jira Clone

一个高度还原 Jira 的项目管理 Web 应用，支持 **Backlog**、**Sprint 看板（Board）**、以及**个人面板（My Dashboard）**。

- 前端：React + TypeScript + Vite + `@dnd-kit`（完整拖拽）
- 后端：**Supabase**（托管 Postgres + 认证 + 行级安全 RLS），前端直连，无需自建服务器
- 部署：**GitHub Pages**（通过 GitHub Actions 自动构建发布）

## 功能

- 🔐 邮箱 + 密码 注册 / 登录（多用户）
- 🗂️ 多项目，任务自动编号（`PROJ-1`、`PROJ-2`…）
- 📋 **Backlog**：Sprint 与 Backlog 分组，任务可在两者间拖拽；创建 / 开始 / 完成 Sprint
- 📊 **Board**：To Do / In Progress / In Review / Done 四列看板，卡片跨列拖拽改状态，可按经办人过滤
- 🏠 **My Dashboard**：指派给我的「待办 / 进行中 / 已完成」聚合与统计
- 任务类型（Epic/Story/Task/Bug）、优先级、经办人、故事点、描述

---

## 一、创建 Supabase 后端（一次性，约 5 分钟）

1. 打开 [supabase.com](https://supabase.com) → 注册 → **New project**（免费）。等待数据库初始化完成。
2. 进入项目 → 左侧 **SQL Editor** → **New query**，把本仓库 [`supabase/schema.sql`](supabase/schema.sql) 的全部内容粘贴进去 → **Run**。
   - 这会建表、开启行级安全（RLS）、创建注册触发器和两个 RPC。
3. （推荐，便于即时登录）左侧 **Authentication → Providers / Sign In → Email**，关闭 **Confirm email**（否则注册后需邮箱验证才能登录）。
4. 左侧 **Project Settings → API**，记下：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public** key（`anon` 那一行，可公开，安全性由 RLS 保证）

---

## 二、本地运行

```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

编辑 `.env`：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...（你的 anon key）
```

启动：

```bash
npm run dev
```

打开终端里显示的地址（默认 http://localhost:5173）。首次进入 → 注册一个账号 → 自动提示创建项目 → 开始用。

> 想验证多用户：再注册一个账号登录，即可把任务指派给不同人。注意每个项目只有其成员可见（RLS），把别人加入项目后对方才看得到。

---

## 三、发布到 GitHub Pages

1. 新建一个 GitHub 仓库（**建议仓库名就叫 `jira-clone`**，否则需改 base，见下）。把本项目推上去：

   ```bash
   git init
   git add .
   git commit -m "init jira clone"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/jira-clone.git
   git push -u origin main
   ```

2. 仓库 **Settings → Secrets and variables → Actions → New repository secret**，添加两个 secret：
   - `VITE_SUPABASE_URL` = 你的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = 你的 anon key

3. 若仓库名**不是** `jira-clone`：在 **Settings → Secrets and variables → Actions → Variables** 新增变量 `VITE_BASE`，值为 `/<你的仓库名>/`（注意前后斜杠）。

4. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。

5. 每次 push 到 `main` 会自动触发 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 构建并发布。完成后访问：

   ```
   https://<你的用户名>.github.io/<仓库名>/
   ```

> anon key 会被打进前端静态文件，这是 Supabase 的标准用法——真正的访问控制由数据库的 RLS 策略保证，公开 anon key 不会泄露他人数据。

---

## 目录结构

```
src/
├── lib/supabase.ts      # Supabase client
├── api/                 # 数据访问层（auth/projects/sprints/issues）
├── store/               # Zustand 状态（auth / data）
├── components/          # Avatar, Sidebar, Navbar, IssueModal, NewProjectModal
├── pages/               # Login, Backlog, Board, Dashboard
├── types.ts             # 与 DB 对齐的类型
├── theme.css            # Jira 风格样式
└── App.tsx              # 路由 + 守卫 + 布局
supabase/schema.sql      # 一次性执行的数据库建表 + RLS 脚本
.github/workflows/deploy.yml
```

## 常见问题

- **登录后一直转圈 / 报错**：检查 `.env` 的 URL/key 是否正确、`schema.sql` 是否已执行。
- **注册后登录失败**：多半是未关闭邮箱验证（见步骤一·3），去邮箱点确认链接，或关闭该选项。
- **Pages 打开空白**：多半是 `VITE_BASE` 与仓库名不一致。
