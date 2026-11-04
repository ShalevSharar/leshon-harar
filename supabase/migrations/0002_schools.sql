-- שלב 2: בתי ספר, אנשי קשר, פניות, הרצאות, בקשות מדף הנחיתה, סקרים.
-- להריץ אחרי 0001_volunteers.sql.

-- ===== בתי ספר =====
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  symbol_code text unique,                       -- סמל מוסד ממשרד החינוך
  name text not null check (char_length(name) between 2 and 200),
  city text not null default '',
  district text not null default '',
  level text not null default '' check (level in ('','יסודי','חטיבה','תיכון','אחר')),
  sector text not null default '',
  phone text not null default '',
  address text not null default '',
  stage text not null default 'not_contacted' check (stage in (
    'not_contacted','contacted','interested','lecture_scheduled','lecture_done','feedback_received','not_relevant','refused'
  )),
  last_contact_at timestamptz,
  next_followup_at date,
  is_sample boolean not null default false
);
create index if not exists schools_name_city_idx on public.schools (lower(name), lower(city));

-- ===== אנשי קשר =====
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_id uuid not null references public.schools(id) on delete cascade,
  role text not null default 'אחר' check (role in ('יועצת','מנהל','רכז חברתי','אחר')),
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  is_sample boolean not null default false
);

-- ===== היסטוריית פניות =====
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_id uuid not null references public.schools(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  channel text not null check (channel in ('טלפון','מייל','ווטסאפ','דף נחיתה','אחר')),
  summary text not null default '',
  is_sample boolean not null default false
);

-- ===== הרצאות =====
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_id uuid not null references public.schools(id) on delete cascade,
  lecture_date date,
  grade text not null default '',
  est_students int check (est_students is null or est_students between 0 and 5000),
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  notes text not null default '',
  survey_token uuid not null unique default gen_random_uuid(),
  is_sample boolean not null default false
);

-- ===== בקשות מדף הנחיתה =====
create table if not exists public.lecture_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_symbol text check (school_symbol is null or char_length(school_symbol) <= 20),
  school_name text not null check (char_length(school_name) between 2 and 200),
  city text not null check (char_length(city) between 2 and 80),
  contact_name text not null check (char_length(contact_name) between 2 and 100),
  contact_role text not null default '' check (char_length(contact_role) <= 60),
  phone text not null check (char_length(phone) between 7 and 20),
  email text not null default '' check (char_length(email) <= 150),
  grades text not null default '' check (char_length(grades) <= 200),
  preferred_dates text not null default '' check (char_length(preferred_dates) <= 300),
  notes text not null default '' check (char_length(notes) <= 1000),
  school_id uuid references public.schools(id) on delete set null,
  match_status text not null default 'pending' check (match_status in ('pending','matched','review')),
  is_sample boolean not null default false
);

-- ===== תשובות לסקר =====
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  audience text not null check (audience in ('student','teacher')),
  answers jsonb not null,                         -- לתלמידים: בלי שום פרט מזהה
  is_sample boolean not null default false
);

-- ===== RLS =====
alter table public.schools enable row level security;
alter table public.contacts enable row level security;
alter table public.interactions enable row level security;
alter table public.lectures enable row level security;
alter table public.lecture_requests enable row level security;
alter table public.survey_responses enable row level security;

-- דוד (מחובר): גישה מלאה לכל הטבלאות.
create policy "schools_admin_all" on public.schools for all to authenticated using (true) with check (true);
create policy "contacts_admin_all" on public.contacts for all to authenticated using (true) with check (true);
create policy "interactions_admin_all" on public.interactions for all to authenticated using (true) with check (true);
create policy "lectures_admin_all" on public.lectures for all to authenticated using (true) with check (true);
create policy "lecture_requests_admin_all" on public.lecture_requests for all to authenticated using (true) with check (true);
create policy "survey_responses_admin_all" on public.survey_responses for all to authenticated using (true) with check (true);

-- אנונימי: רק הוספת בקשה מדף הנחיתה. אין קריאה, אין עדכון.
create policy "lecture_requests_public_insert" on public.lecture_requests for insert to anon with check (true);

-- ===== התאמת בקשה לבית ספר (רץ כ-SECURITY DEFINER, כך ש-anon לא קורא את schools) =====
create or replace function public.match_lecture_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  found_id uuid;
begin
  -- 1. לפי סמל מוסד
  if new.school_symbol is not null and new.school_symbol <> '' then
    select id into found_id from public.schools where symbol_code = new.school_symbol limit 1;
  end if;
  -- 2. לפי שם + עיר (בלי תלות באותיות גדולות/קטנות ורווחים מיותרים)
  if found_id is null then
    select id into found_id from public.schools
    where lower(trim(name)) = lower(trim(new.school_name))
      and lower(trim(city)) = lower(trim(new.city))
    limit 1;
  end if;

  if found_id is not null then
    new.school_id := found_id;
    new.match_status := 'matched';
    update public.schools
      set stage = 'interested',
          last_contact_at = now()
      where id = found_id and stage in ('not_contacted','contacted');
    insert into public.interactions (school_id, channel, summary)
      values (found_id, 'דף נחיתה', 'נשלחה בקשה להרצאה מדף הנחיתה');
  else
    new.match_status := 'review';                 -- דוד ישייך ידנית
  end if;
  return new;
end;
$$;

drop trigger if exists lecture_requests_match on public.lecture_requests;
create trigger lecture_requests_match
  before insert on public.lecture_requests
  for each row execute function public.match_lecture_request();

-- ===== סקר: גישה רק דרך פונקציות, לפי טוקן =====
-- קבלת פרטי ההרצאה להצגה בסקר (בלי מזהים פנימיים ובלי נתוני בית הספר המלאים)
create or replace function public.get_survey_context(p_token uuid)
returns table (school_name text, lecture_date date, grade text)
language sql
security definer
set search_path = public
as $$
  select s.name, l.lecture_date, l.grade
  from public.lectures l
  join public.schools s on s.id = l.school_id
  where l.survey_token = p_token
  limit 1;
$$;

-- הגשת סקר: מאמת את הטוקן, ושומר תשובה. מחזיר false אם הטוקן לא תקין.
create or replace function public.submit_survey(p_token uuid, p_audience text, p_answers jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  if p_audience not in ('student','teacher') then
    return false;
  end if;
  select id into lid from public.lectures where survey_token = p_token;
  if lid is null then
    return false;
  end if;
  insert into public.survey_responses (lecture_id, audience, answers)
    values (lid, p_audience, p_answers);
  return true;
end;
$$;

grant execute on function public.get_survey_context(uuid) to anon, authenticated;
grant execute on function public.submit_survey(uuid, text, jsonb) to anon, authenticated;
