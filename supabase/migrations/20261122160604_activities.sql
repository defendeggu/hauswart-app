create table public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  einheit text not null check (einheit in ('stunden', 'franken')),
  bemerkung_pflicht boolean not null default false,
  -- NULL = für alle Familien erlaubt; sonst nur für die aufgeführten family_id.
  nur_familien uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint activities_name_not_blank check (btrim(name) <> '')
);

create unique index activities_name_key on public.activities (lower(name));

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();
