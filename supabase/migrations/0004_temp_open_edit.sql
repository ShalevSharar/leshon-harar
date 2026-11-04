-- זמני: עריכה פתוחה לכל מי שיש לו את הכתובת. לבטל לפני שמכניסים נתונים אמיתיים (ראו בתחתית).

-- קריאה: בתי ספר בלבד (נתונים ציבוריים ממשרד החינוך)
create policy "schools_temp_public_read" on public.schools for select to anon using (true);

-- עריכת בתי ספר (שלב, טלפון, פרטים)
create policy "schools_temp_public_update" on public.schools for update to anon using (true) with check (true);

-- תיעוד פניות
create policy "interactions_temp_public_insert" on public.interactions for insert to anon with check (true);

-- אנשי קשר: הוספה ועריכה
create policy "contacts_temp_public_insert" on public.contacts for insert to anon with check (true);
create policy "contacts_temp_public_update" on public.contacts for update to anon using (true) with check (true);

-- הרצאות: הוספה ועדכון סטטוס
create policy "lectures_temp_public_insert" on public.lectures for insert to anon with check (true);
create policy "lectures_temp_public_update" on public.lectures for update to anon using (true) with check (true);

-- ביטול (להריץ כשמחזירים את ההתחברות של דוד):
-- drop policy if exists "schools_temp_public_read" on public.schools;
-- drop policy if exists "schools_temp_public_update" on public.schools;
-- drop policy if exists "interactions_temp_public_insert" on public.interactions;
-- drop policy if exists "contacts_temp_public_insert" on public.contacts;
-- drop policy if exists "contacts_temp_public_update" on public.contacts;
-- drop policy if exists "lectures_temp_public_insert" on public.lectures;
-- drop policy if exists "lectures_temp_public_update" on public.lectures;
