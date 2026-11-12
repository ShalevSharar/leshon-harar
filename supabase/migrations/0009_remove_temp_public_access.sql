-- שלב 6: סגירת הגישה הזמנית לאנונימיים. להריץ רק אחרי שהתחברתם למערכת בהצלחה
-- (אחרת תינעלו מהנתונים). בטוח להרצה חוזרת.
-- אחרי ההרצה: הטפסים הציבוריים (מתנדבים, סקר, בקשות מדף הנחיתה) וקישור היומן
-- ממשיכים לעבוד, כי הם עוברים דרך פונקציות SECURITY DEFINER ומדיניות INSERT משלהם.

drop policy if exists "schools_temp_public_read" on public.schools;
drop policy if exists "schools_temp_public_update" on public.schools;
drop policy if exists "interactions_temp_public_insert" on public.interactions;
drop policy if exists "contacts_temp_public_insert" on public.contacts;
drop policy if exists "contacts_temp_public_update" on public.contacts;
drop policy if exists "lectures_temp_public_insert" on public.lectures;
drop policy if exists "lectures_temp_public_update" on public.lectures;
drop policy if exists "lectures_temp_public_select" on public.lectures;
drop policy if exists "lectures_temp_public_delete" on public.lectures;
drop policy if exists "lecturers_temp_public_all" on public.lecturers;
drop policy if exists "lecture_types_temp_public_all" on public.lecture_types;
