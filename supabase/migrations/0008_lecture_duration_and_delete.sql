-- שלב 5: משך משוער לכל סוג הרצאה, ומחיקה של הרצאות מהממשק.
-- להריץ אחרי 0007_calendar_feed.sql. בטוח להרצה חוזרת.

-- ===== משך משוער לסוג הרצאה (בדקות) =====
-- ריק = אין משך קבוע, השעה מוזנת ידנית.
alter table public.lecture_types add column if not exists default_minutes int;
alter table public.lecture_types drop constraint if exists lecture_types_default_minutes_check;
alter table public.lecture_types add constraint lecture_types_default_minutes_check
  check (default_minutes is null or default_minutes between 5 and 480);

-- ===== מחיקת הרצאות (זמני, כמו שאר המדיניות הזמנית) =====
-- מרצים וסוגי הרצאה כבר מאפשרים מחיקה מ-0006 (for all). הרצאות צריכות מדיניות מחיקה ל-anon.
drop policy if exists "lectures_temp_public_delete" on public.lectures;
create policy "lectures_temp_public_delete" on public.lectures for delete to anon using (true);

-- ביטול (להריץ כשמחזירים את ההתחברות):
-- drop policy if exists "lectures_temp_public_delete" on public.lectures;
