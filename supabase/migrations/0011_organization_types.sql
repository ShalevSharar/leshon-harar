-- שלב 8: ארגונים נוספים מלבד בתי ספר (מתנסים, חברתון וכו').
-- להריץ אחרי 0010_allowed_signups.sql. בטוח להרצה חוזרת.
-- כל הרשומות הקיימות הן בתי ספר, לכן ברירת המחדל היא 'בית ספר'.

alter table public.schools add column if not exists org_type text not null default 'בית ספר';
alter table public.schools drop constraint if exists schools_org_type_check;
alter table public.schools add constraint schools_org_type_check
  check (org_type in ('בית ספר','מתנסים','חברתון','ארגון אחר'));

create index if not exists schools_org_type_idx on public.schools (org_type);
