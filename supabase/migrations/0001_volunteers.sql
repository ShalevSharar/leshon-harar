-- שלב 1: מתנדבים. טבלה אחת, הוספה ציבורית בלבד.
create table if not exists public.volunteers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text not null check (char_length(phone) between 7 and 20),
  email text not null check (char_length(email) between 5 and 150),
  city text not null check (char_length(city) between 2 and 80),
  areas text[] not null default '{}',
  availability text check (char_length(availability) <= 300),
  source text not null default 'other' check (source in ('stand','instagram','facebook','other')),
  consent boolean not null check (consent = true),
  status text not null default 'new' check (status in ('new','contacted','active','not_relevant')),
  is_sample boolean not null default false
);

alter table public.volunteers enable row level security;

-- אנונימי: הוספה בלבד, בלי קריאה.
create policy "volunteers_public_insert" on public.volunteers
  for insert to anon with check (true);

-- דוד (מחובר): קריאה, עדכון ומחיקה.
create policy "volunteers_admin_all" on public.volunteers
  for all to authenticated using (true) with check (true);
