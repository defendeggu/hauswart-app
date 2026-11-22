create table public.audit_log (
  id bigint generated always as identity primary key,
  wer uuid references public.profiles (id),
  wann timestamptz not null default now(),
  tabelle text not null,
  zeile_id uuid not null,
  aktion text not null check (aktion in ('insert', 'update', 'delete')),
  alt jsonb,
  neu jsonb
);

create index audit_log_tabelle_zeile_idx on public.audit_log (tabelle, zeile_id);
create index audit_log_wann_idx on public.audit_log (wann desc);

-- Generische Trigger-Funktion: protokolliert jede Änderung an den
-- angehängten Tabellen. Läuft als SECURITY DEFINER mit den Rechten des
-- Funktionsbesitzers, umgeht also RLS auf audit_log selbst (siehe
-- rls_policies-Migration: dort gibt es keine INSERT-Policy für Clients).
create function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (wer, tabelle, zeile_id, aktion, alt, neu)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger families_audit
  after insert or update or delete on public.families
  for each row execute function public.write_audit_log();

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.write_audit_log();

create trigger activities_audit
  after insert or update or delete on public.activities
  for each row execute function public.write_audit_log();

create trigger periods_audit
  after insert or update or delete on public.periods
  for each row execute function public.write_audit_log();

create trigger entries_audit
  after insert or update or delete on public.entries
  for each row execute function public.write_audit_log();
