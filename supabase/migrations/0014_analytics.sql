-- שלב 11 (redesign): פונקציות קריאה בלבד לדשבורד. לא משנות נתונים.
-- להריץ אחרי 0013_assignment_tasks.sql. בטוח להרצה חוזרת.
-- security invoker: הפונקציות רצות בהרשאות המשתמש המחובר, כך שחלות עליהן אותן מדיניות גישה.

-- ===== פעילות חודשית (הרצאות, בקשות, פניות) מהחודש שנבחר ועד היום =====
create or replace function public.analytics_monthly(p_from date)
returns table (month text, lectures bigint, requests bigint, interactions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with months as (
    select to_char(d, 'YYYY-MM') as m
    from generate_series(date_trunc('month', p_from), date_trunc('month', now()), interval '1 month') as d
  )
  select
    m.m,
    (select count(*) from public.lectures l where to_char(l.lecture_date, 'YYYY-MM') = m.m),
    (select count(*) from public.lecture_requests r where to_char(r.created_at, 'YYYY-MM') = m.m),
    (select count(*) from public.interactions i where to_char(i.occurred_at, 'YYYY-MM') = m.m)
  from months m
  order by m.m;
$$;

-- ===== בתי ספר לפי עיר: כמה במאגר, כמה נפנה אליהם, כמה הביעו עניין =====
create or replace function public.analytics_by_city()
returns table (city text, schools bigint, reached bigint, interested bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(nullif(s.city, ''), 'לא צוין') as city,
    count(*) as schools,
    count(*) filter (where s.stage <> 'not_contacted') as reached,
    count(*) filter (where s.stage = 'interested') as interested
  from public.schools s
  group by 1
  order by count(*) desc
  limit 20;
$$;

grant execute on function public.analytics_monthly(date) to authenticated;
grant execute on function public.analytics_by_city() to authenticated;
