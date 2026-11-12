-- שלב 10 (redesign): אחראי על בית ספר, ומשימות ותזכורות.
-- להריץ אחרי 0012_allowed_emails_admin.sql. בטוח להרצה חוזרת. תוספות בלבד: לא נמחק ולא משנים נתונים קיימים.

-- ===== אחראי על מוסד =====
-- מייל של משתמש מורשה (מתוך allowed_emails). ריק = לא שויך.
alter table public.schools add column if not exists assigned_to text not null default '';

-- ===== משימות ותזכורות =====
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_id uuid references public.schools(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  due_date date,
  assigned_to text not null default '',
  done boolean not null default false,
  done_at timestamptz,
  is_sample boolean not null default false
);

create index if not exists tasks_due_idx on public.tasks (due_date) where done = false;
create index if not exists tasks_school_idx on public.tasks (school_id);

alter table public.tasks enable row level security;
drop policy if exists "tasks_admin_all" on public.tasks;
create policy "tasks_admin_all" on public.tasks for all to authenticated using (true) with check (true);
