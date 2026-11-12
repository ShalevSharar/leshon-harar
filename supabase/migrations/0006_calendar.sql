-- שלב 3: לוח שנה להרצאות. מרצים, סוגי הרצאה, שעות והרצאה למרצה אחד.
-- להריץ אחרי 0005_survey_questions.sql. בטוח להרצה חוזרת.

-- ===== מרצים =====
create table if not exists public.lecturers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 100),
  phone text not null default '',
  email text not null default '',
  color text not null default '#4a4a4a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active boolean not null default true,
  is_sample boolean not null default false
);

-- ===== סוגי הרצאה =====
-- PLACEHOLDER: שמות הסוגים הסופיים יעודכנו אחרי אישור דוד
create table if not exists public.lecture_types (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 100),
  color text not null default '#4a4a4a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active boolean not null default true,
  is_sample boolean not null default false
);

insert into public.lecture_types (name, color)
select v.name, v.color from (values
  ('סוג א''', '#1565c0'),
  ('סוג ב''', '#2e7d32')
) as v(name, color)
where not exists (select 1 from public.lecture_types);

-- ===== שדות חדשים בהרצאות =====
-- הרצאות קיימות נשארות עם שעות ריקות; בלוח הן יוצגו כברירת מחדל.
alter table public.lectures add column if not exists start_time time;
alter table public.lectures add column if not exists end_time time;
alter table public.lectures add column if not exists lecturer_id uuid references public.lecturers(id) on delete set null;
alter table public.lectures add column if not exists lecture_type_id uuid references public.lecture_types(id) on delete set null;

alter table public.lectures drop constraint if exists lectures_time_order;
alter table public.lectures add constraint lectures_time_order
  check (start_time is null or end_time is null or end_time > start_time);

create index if not exists lectures_date_idx on public.lectures (lecture_date);

-- ===== RLS =====
alter table public.lecturers enable row level security;
alter table public.lecture_types enable row level security;

drop policy if exists "lecturers_admin_all" on public.lecturers;
create policy "lecturers_admin_all" on public.lecturers for all to authenticated using (true) with check (true);

drop policy if exists "lecture_types_admin_all" on public.lecture_types;
create policy "lecture_types_admin_all" on public.lecture_types for all to authenticated using (true) with check (true);

-- זמני (כמו 0004): בלי התחברות, הדפדפן פועל כ-anon. להסיר כשמחזירים את ההתחברות.
drop policy if exists "lecturers_temp_public_all" on public.lecturers;
create policy "lecturers_temp_public_all" on public.lecturers for all to anon using (true) with check (true);

drop policy if exists "lecture_types_temp_public_all" on public.lecture_types;
create policy "lecture_types_temp_public_all" on public.lecture_types for all to anon using (true) with check (true);

-- הרצאות: קריאה (נדרש ללוח השנה ולרשימה בזמן שאין התחברות). הוספה ועדכון כבר פתוחים מ-0004.
drop policy if exists "lectures_temp_public_select" on public.lectures;
create policy "lectures_temp_public_select" on public.lectures for select to anon using (true);

-- ביטול (להריץ כשמחזירים את ההתחברות):
-- drop policy if exists "lecturers_temp_public_all" on public.lecturers;
-- drop policy if exists "lecture_types_temp_public_all" on public.lecture_types;
-- drop policy if exists "lectures_temp_public_select" on public.lectures;
