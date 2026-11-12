-- שלב 7: כניסה עם Google, והגבלת יצירת חשבונות למיילים מאושרים בלבד.
-- להריץ אחרי 0009. בטוח להרצה חוזרת.
-- בלי הרשימה הזו, כל מי שיש לו חשבון Google היה נרשם ומקבל גישה מלאה לנתונים.

-- ===== רשימת מיילים מאושרים =====
-- אין מדיניות גישה לטבלה: רק הפונקציה (security definer) קוראת ממנה.
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email) and char_length(email) between 5 and 254),
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- הוספת מנהלים: להוסיף כאן שורה לכל מייל מאושר (באותיות קטנות)
insert into public.allowed_emails (email, note) values
  ('shalevsharar@gmail.com', 'פיתוח')
on conflict (email) do nothing;
-- להוסיף את המייל של דוד (באותיות קטנות):
-- insert into public.allowed_emails (email, note) values ('<מייל של דוד>', 'מנהל') on conflict (email) do nothing;

-- ===== חסימת יצירת חשבון למי שלא ברשימה =====
create or replace function public.enforce_allowed_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'המייל % אינו מאושר לגישה למערכת', new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_allowed_signup on auth.users;
create trigger enforce_allowed_signup
  before insert on auth.users
  for each row execute function public.enforce_allowed_signup();

-- ביטול (להריץ רק אם רוצים לפתוח את ההרשמה לכולם, לא מומלץ):
-- drop trigger if exists enforce_allowed_signup on auth.users;
