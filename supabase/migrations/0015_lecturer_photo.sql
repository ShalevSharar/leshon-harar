-- שלב 12: תמונה למרצה. התמונה נשמרת כ-data URL קטן (כ-256px, JPEG), כך שלא צריך אחסון נוסף.
-- להריץ אחרי 0014_analytics.sql. בטוח להרצה חוזרת.

alter table public.lecturers add column if not exists photo_data text;
alter table public.lecturers drop constraint if exists lecturers_photo_size_check;
alter table public.lecturers add constraint lecturers_photo_size_check
  check (photo_data is null or char_length(photo_data) <= 150000);
