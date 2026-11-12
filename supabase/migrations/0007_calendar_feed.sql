-- שלב 4: קישור יומן אישי (iCal) לכל מרצה.
-- להריץ אחרי 0006_calendar.sql. בטוח להרצה חוזרת.

-- ===== טוקן ליומן של המרצה =====
-- הטוקן הוא הסוד שבקישור: מי שיש לו רואה את היומן של המרצה בלבד.
alter table public.lecturers add column if not exists calendar_token uuid not null default gen_random_uuid();
create unique index if not exists lecturers_calendar_token_key on public.lecturers (calendar_token);

-- ===== עדכון זמן שינוי בהרצאות =====
-- משמש ל-LAST-MODIFIED / SEQUENCE ביומן, כדי שאפליקציות היומן יזהו שינויים.
alter table public.lectures add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_lecture_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lectures_touch_updated_at on public.lectures;
create trigger lectures_touch_updated_at
  before update on public.lectures
  for each row execute function public.touch_lecture_updated_at();

-- ===== קריאת יומן לפי טוקן =====
-- security definer: הפונקציה רצה בהרשאות הבעלים ומחזירה רק את מה שמוגדר כאן.
-- טוקן לא קיים מחזיר null, בלי הבדל בין "לא קיים" לבין "אין הרצאות".
-- הוגבל ל-30 יום אחורה ואילך כדי שהיומן לא יכיל היסטוריה ארוכה.
create or replace function public.get_lecturer_calendar(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when l.id is null then null else jsonb_build_object(
    'lecturer', jsonb_build_object('name', l.name),
    'lectures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'lecture_date', x.lecture_date,
        'start_time', x.start_time,
        'end_time', x.end_time,
        'status', x.status,
        'grade', x.grade,
        'est_students', x.est_students,
        'notes', x.notes,
        'type_name', x.type_name,
        'school_name', x.school_name,
        'school_address', x.school_address,
        'school_city', x.school_city,
        'contact_name', x.contact_name,
        'contact_phone', x.contact_phone,
        'updated_at', x.updated_at
      ) order by x.lecture_date, x.start_time)
      from (
        select
          lec.id, lec.lecture_date, lec.start_time, lec.end_time, lec.status, lec.grade,
          lec.est_students, lec.notes, lec.updated_at,
          lt.name as type_name,
          s.name as school_name, s.address as school_address, s.city as school_city,
          c.name as contact_name, c.phone as contact_phone
        from public.lectures lec
        left join public.lecture_types lt on lt.id = lec.lecture_type_id
        join public.schools s on s.id = lec.school_id
        left join lateral (
          select ct.name, ct.phone
          from public.contacts ct
          where ct.school_id = s.id and ct.is_primary
          limit 1
        ) c on true
        where lec.lecturer_id = l.id
          and lec.lecture_date >= current_date - 30
      ) x
    ), '[]'::jsonb)
  ) end
  from (select 1) as anchor
  left join public.lecturers l on l.calendar_token = p_token and l.active
$$;

revoke all on function public.get_lecturer_calendar(uuid) from public;
grant execute on function public.get_lecturer_calendar(uuid) to anon, authenticated;
