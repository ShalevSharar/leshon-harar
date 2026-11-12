-- שלב 9: ניהול רשימת המיילים המאושרים מתוך המערכת.
-- להריץ אחרי 0011_organization_types.sql. בטוח להרצה חוזרת.
-- רק משתמשים מחוברים (כלומר מיילים שכבר ברשימה) יכולים לקרוא ולערוך את הרשימה.

drop policy if exists "allowed_emails_admin_all" on public.allowed_emails;
create policy "allowed_emails_admin_all" on public.allowed_emails
  for all to authenticated using (true) with check (true);
