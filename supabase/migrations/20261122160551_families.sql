-- Familien. WICHTIG: Diese Migration enthält und erhält NIE echte Namen.
-- Namen werden ausschliesslich über die Admin-UI in der produktiven
-- Datenbank erfasst, siehe docs/PLAN.md Abschnitt 2 ("Namen in Git").

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint families_name_not_blank check (btrim(name) <> '')
);

create unique index families_name_key on public.families (lower(name));

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger families_set_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();
