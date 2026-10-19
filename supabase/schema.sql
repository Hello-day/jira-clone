-- ============================================================================
-- Jira Clone — Supabase schema
-- 在 Supabase 控制台 → SQL Editor 里，把本文件整段粘贴并执行一次即可。
-- 包含：建表、行级安全(RLS)策略、注册触发器、key 生成 RPC、以及可选种子数据。
-- ============================================================================

-- 需要用到 gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- profiles：每个 auth 用户对应一行（注册时由触发器自动创建）
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  avatar_color text not null default '#0052CC',
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  key           text not null,
  name          text not null,
  lead_id       uuid references public.profiles(id) on delete set null,
  issue_counter int not null default 0,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- project_members：谁能访问某个项目（驱动 RLS）
-- ----------------------------------------------------------------------------
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member',
  primary key (project_id, user_id)
);

-- ----------------------------------------------------------------------------
-- sprints
-- ----------------------------------------------------------------------------
create table if not exists public.sprints (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  goal       text,
  status     text not null default 'future' check (status in ('future','active','completed')),
  start_date timestamptz,
  end_date   timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- issues
-- ----------------------------------------------------------------------------
create table if not exists public.issues (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  key           text not null,
  type          text not null default 'task' check (type in ('epic','story','task','bug')),
  title         text not null,
  description   text,
  status        text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority      text not null default 'medium' check (priority in ('highest','high','medium','low','lowest')),
  assignee_id   uuid references public.profiles(id) on delete set null,
  reporter_id   uuid references public.profiles(id) on delete set null,
  sprint_id     uuid references public.sprints(id) on delete set null,
  estimated_hours double precision,
  remaining_hours double precision,
  rank          double precision not null default 1000,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists issues_project_idx on public.issues(project_id);
create index if not exists issues_sprint_idx  on public.issues(sprint_id);

-- ----------------------------------------------------------------------------
-- 注册触发器：auth.users 新增 → 自动插入 profiles
-- 用户注册时在 options.data 里传 name；没传就用邮箱前缀。
-- 邮件验证开启时，等 email_confirmed_at 有值后才写入 profiles。
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  colors text[] := array['#0052CC','#36B37E','#FF5630','#6554C0','#FFAB00','#00B8D9'];
begin
  -- 仅在邮件已确认时写入（关闭邮件验证时 confirmed_at 在 insert 时就非 null）
  if new.email_confirmed_at is not null then
    insert into public.profiles (id, name, avatar_color)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      colors[1 + floor(random() * array_length(colors,1))::int]
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 邮件确认完成时（update 导致 email_confirmed_at 从 null 变为非 null）写入 profiles
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  colors text[] := array['#0052CC','#36B37E','#FF5630','#6554C0','#FFAB00','#00B8D9'];
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.profiles (id, name, avatar_color)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      colors[1 + floor(random() * array_length(colors,1))::int]
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.handle_user_confirmed();

-- ----------------------------------------------------------------------------
-- 建项目的 RPC：原子地创建项目 + 把创建者加为成员，并设为 lead
-- 前端调用 create_project(p_key, p_name)
-- ----------------------------------------------------------------------------
create or replace function public.create_project(p_key text, p_name text)
returns public.projects
language plpgsql
security definer set search_path = public
as $$
declare
  proj public.projects;
begin
  insert into public.projects (key, name, lead_id)
  values (upper(p_key), p_name, auth.uid())
  returning * into proj;

  insert into public.project_members (project_id, user_id, role)
  values (proj.id, auth.uid(), 'admin');

  return proj;
end;
$$;

-- ----------------------------------------------------------------------------
-- 生成下一个 issue key 并新建 issue 的 RPC（原子自增 issue_counter）
-- ----------------------------------------------------------------------------
create or replace function public.create_issue(
  p_project_id uuid,
  p_type text,
  p_title text,
  p_sprint_id uuid default null,
  p_assignee_id uuid default null,
  p_priority text default 'medium',
  p_estimated_hours double precision default null
)
returns public.issues
language plpgsql
security definer set search_path = public
as $$
declare
  n int;
  proj_key text;
  new_issue public.issues;
  max_rank double precision;
begin
  -- 权限校验：必须是项目成员
  if not exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid()
  ) then
    raise exception 'not a member of this project';
  end if;

  update public.projects
    set issue_counter = issue_counter + 1
    where id = p_project_id
    returning issue_counter, key into n, proj_key;

  select coalesce(max(rank), 0) + 1000 into max_rank
    from public.issues where project_id = p_project_id;

  insert into public.issues (project_id, key, type, title, sprint_id, assignee_id, reporter_id, priority, estimated_hours, rank)
  values (p_project_id, proj_key || '-' || n, p_type, p_title, p_sprint_id, p_assignee_id, auth.uid(), p_priority, p_estimated_hours, max_rank)
  returning * into new_issue;

  return new_issue;
end;
$$;

-- updated_at 自动维护
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists issues_touch on public.issues;
create trigger issues_touch before update on public.issues
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 行级安全 (RLS)
-- 核心规则：用户只能访问自己是 project_members 的项目下的数据。
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.sprints         enable row level security;
alter table public.issues          enable row level security;

-- 辅助函数：当前用户是否是某项目成员（security definer 避免策略递归）
create or replace function public.is_member(p_project_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

-- profiles：所有登录用户可读（用于指派下拉显示他人名字/头像）；只能改自己的
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid());

-- projects：成员可读；任何登录用户可建（经由 create_project RPC，但也放开 insert 以防直连）
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select to authenticated using (public.is_member(id));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated using (public.is_member(id));
-- 只有项目负责人（lead）能删除项目（级联删除其 sprints/issues/members）
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated using (lead_id = auth.uid());

-- project_members：成员可读本项目成员；可把自己加入（供 RPC/直连）
drop policy if exists members_read on public.project_members;
create policy members_read on public.project_members
  for select to authenticated using (public.is_member(project_id));
drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members
  for insert to authenticated with check (user_id = auth.uid() or public.is_member(project_id));
drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members
  for delete to authenticated using (public.is_member(project_id));

-- sprints：成员可全权读写
drop policy if exists sprints_all on public.sprints;
create policy sprints_all on public.sprints
  for all to authenticated using (public.is_member(project_id)) with check (public.is_member(project_id));

-- issues：成员可全权读写
drop policy if exists issues_all on public.issues;
create policy issues_all on public.issues
  for all to authenticated using (public.is_member(project_id)) with check (public.is_member(project_id));

-- ============================================================================
-- 可选：示例数据说明
-- 由于 issue/project 需要绑定到真实 auth 用户，种子数据最简单的方式是：
--   1) 先在应用里注册 1~2 个账号；
--   2) 登录后用界面上的 "New project" / "New issue" 创建。
-- 如需脚本化种子，可在注册后把下面 <YOUR_USER_ID> 换成 auth.users 里的 id 再执行。
-- ============================================================================
