-- שלב 3: עדכוני ייבוא ועריכה.
-- להריץ אחרי 0002_schools.sql.

-- ===== בתי ספר: רמה "פנימייה" וסימון הוספה ידנית =====
alter table public.schools drop constraint if exists schools_level_check;
alter table public.schools add constraint schools_level_check
  check (level in ('','יסודי','חטיבה','תיכון','אחר','פנימייה'));
alter table public.schools add column if not exists manual boolean not null default false;

-- ===== אנשי קשר: תפקידים חדשים, הערות, איש קשר ראשי, וקישור זמני לסמל מוסד =====
-- העברת ערכי התפקיד הישנים לחדשים לפני החלפת ההגבלה
alter table public.contacts drop constraint if exists contacts_role_check;
update public.contacts set role = 'מנהל/ת' where role = 'מנהל';
update public.contacts set role = 'יועצ/ת' where role = 'יועצת';
update public.contacts set role = 'רכז/ת חברתי/ת' where role = 'רכז חברתי';
alter table public.contacts add constraint contacts_role_check
  check (role in ('מנהל/ת','יועצ/ת','רכז/ת חברתי/ת','אחר'));

alter table public.contacts add column if not exists notes text not null default '';
alter table public.contacts add column if not exists is_primary boolean not null default false;
-- לייבוא מ-CSV בלי מזהה UUID: מזהים לפי סמל מוסד, ואחרי הייבוא מקשרים ל-school_id
alter table public.contacts add column if not exists school_symbol text;
-- שם העמודה ב-CSV הוא school_symbol; שדה school_id הופך לאופציונלי לצורך הייבוא
alter table public.contacts alter column school_id drop not null;

-- אחרי ייבוא schools ו-contacts, לקשר את אנשי הקשר לבתי הספר לפי סמל מוסד:
-- update public.contacts c set school_id = s.id from public.schools s
--   where s.symbol_code = c.school_symbol and c.school_id is null;
