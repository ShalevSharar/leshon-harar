-- שלב 4: שאלות סקר ניתנות לעריכה, סקר לפי הרצאה, ותשובות מסוג בחירה (1-5) ופתוחות.
-- להריץ אחרי 0004_temp_open_edit.sql (או לפני, לא תלוי בו).

-- ===== שאלות =====
create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('student','teacher')),
  position int not null default 0,
  text text not null check (char_length(text) between 2 and 300),
  type text not null default 'scale' check (type in ('scale','open')),
  active boolean not null default true
);

alter table public.survey_questions enable row level security;
create policy "survey_questions_admin_all" on public.survey_questions for all to authenticated using (true) with check (true);

-- ערכי התחלה (ניתנים לעריכה בהמשך מתוך המערכת)
insert into public.survey_questions (audience, position, text, type) values
  ('student', 1, 'עד כמה ההרצאה הייתה מעניינת עבורך?', 'scale'),
  ('student', 2, 'עד כמה ההרצאה חידשה לך דברים שלא ידעת קודם?', 'scale'),
  ('student', 3, 'עד כמה ההרצאה עזרה לך להבין כיצד מילים ולשון הרע יכולים לפגוע באחרים?', 'scale'),
  ('student', 4, 'עד כמה ההרצאה גרמה לך לחשוב על הדרך שבה את/ה מדבר/ת על אחרים?', 'scale'),
  ('student', 5, 'עד כמה ההרצאה גרמה לך לרצות לשנות משהו בהתנהגות שלך כלפי אחרים?', 'scale'),
  ('student', 6, 'עד כמה ההרצאה נתנה לך כלים להתמודד עם מצב שבו פוגעים במישהו באמצעות מילים או חרם?', 'scale'),
  ('student', 7, 'עד כמה היית ממליץ/ה לתלמידים אחרים להשתתף בהרצאה הזאת?', 'scale'),
  ('student', 8, 'מה הדבר החשוב ביותר שלקחת מההרצאה?', 'open'),
  ('student', 9, 'האם היה משהו שחסר לך בהרצאה, או משהו שהיית רוצה שנשפר?', 'open'),
  ('teacher', 1, 'עד כמה ההרצאה הייתה רלוונטית לכיתה? (1 בכלל לא, 5 מאוד)', 'scale'),
  ('teacher', 2, 'עד כמה ראית שינוי בכיתה אחרי ההרצאה? (1 בכלל לא, 5 שינוי גדול)', 'scale'),
  ('teacher', 3, 'עד כמה תמליץ/י לבית ספר אחר? (1 בכלל לא, 5 בהחלט)', 'scale'),
  ('teacher', 4, 'מה היה טוב ומה אפשר לשפר בהרצאה?', 'open');

-- ===== טעינת הסקר לפי טוקן (בלי מזהים אישיים, בלי נתוני בית ספר מלאים) =====
create or replace function public.get_survey(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lec record;
begin
  select l.id, l.lecture_date, l.grade, s.name as school_name
    into lec
  from public.lectures l
  join public.schools s on s.id = l.school_id
  where l.survey_token = p_token;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'school_name', lec.school_name,
    'lecture_date', lec.lecture_date,
    'grade', lec.grade,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'audience', q.audience, 'text', q.text, 'type', q.type
      ) order by q.audience, q.position), '[]'::jsonb)
      from public.survey_questions q
      where q.active
    )
  );
end;
$$;

-- ===== הגשת סקר: מאמת טוקן, שאלות פעילות, וטווח ערכים 1-5 =====
create or replace function public.submit_survey(p_token uuid, p_audience text, p_answers jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  k text;
  v jsonb;
  q record;
  cleaned jsonb := '{}'::jsonb;
begin
  if p_audience not in ('student','teacher') then
    return false;
  end if;
  select id into lid from public.lectures where survey_token = p_token;
  if lid is null then
    return false;
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    return false;
  end if;

  for k, v in select key, value from jsonb_each(p_answers) loop
    select * into q from public.survey_questions
      where id::text = k and active and audience = p_audience;
    if not found then
      return false;                       -- שאלה לא קיימת/לא פעילה/לא לקהל הזה
    end if;
    if q.type = 'scale' then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::int not between 1 and 5 then
        return false;
      end if;
    elsif q.type = 'open' then
      if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 1000 then
        return false;
      end if;
    end if;
    cleaned := cleaned || jsonb_build_object(k, v);
  end loop;

  insert into public.survey_responses (lecture_id, audience, answers)
    values (lid, p_audience, cleaned);
  return true;
end;
$$;

grant execute on function public.get_survey(uuid) to anon, authenticated;
grant execute on function public.submit_survey(uuid, text, jsonb) to anon, authenticated;

-- ביטול עריכה זמנית (אם נוסף): לא נדרש כאן, העריכה מוגבלת למחוברים בלבד.
