-- Einstellungen der App (genau eine Zeile). Der Name der Siedlung steht nur
-- hier in der Datenbank, nicht im öffentlichen Repo (siehe docs/PLAN.md
-- Abschnitt 2, "Namen in Git"). Er erscheint im Kopf der PDF-Abrechnungen.
create table public.einstellungen (
  id boolean primary key default true check (id),
  siedlung text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.einstellungen (id) values (true);

create trigger einstellungen_set_updated_at
  before update on public.einstellungen
  for each row execute function public.set_updated_at();

alter table public.einstellungen enable row level security;

create policy einstellungen_select on public.einstellungen
  for select
  using (public.is_active_user());

create policy einstellungen_update on public.einstellungen
  for update
  using (public.is_admin())
  with check (public.is_admin());
