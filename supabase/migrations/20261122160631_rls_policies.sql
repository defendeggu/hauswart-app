-- RLS-Policies. Rechte werden in der Datenbank durchgesetzt, nicht nur im
-- Frontend (docs/PLAN.md Abschnitt 7). AAL2-Pflicht für Admin-Aktionen kommt
-- erst in M4, sobald 2FA eingerichtet werden kann.

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.periods enable row level security;
alter table public.entries enable row level security;
alter table public.audit_log enable row level security;

-- families: Admin sieht alle, hauswart nur die eigene Familie. Schreiben nur
-- durch Admin; kein hartes Löschen (keine DELETE-Policy).
create policy families_select on public.families
  for select
  using (public.is_admin() or id = public.my_family_id());

create policy families_insert on public.families
  for insert
  with check (public.is_admin());

create policy families_update on public.families
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- profiles: jeder sieht das eigene Profil, Admin sieht alle. Schreiben: Admin
-- auf alle, jeder auf das eigene (eingeschränkt durch den
-- profiles_prevent_self_escalation-Trigger aus der profiles-Migration).
create policy profiles_select on public.profiles
  for select
  using (public.is_admin() or id = auth.uid());

create policy profiles_insert on public.profiles
  for insert
  with check (public.is_admin());

create policy profiles_update on public.profiles
  for update
  using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());

-- activities: aktive Tätigkeiten sind für alle aktiven Benutzer sichtbar,
-- inaktive nur für Admin. Schreiben nur Admin.
create policy activities_select on public.activities
  for select
  using (public.is_active_user() and (aktiv or public.is_admin()));

create policy activities_insert on public.activities
  for insert
  with check (public.is_admin());

create policy activities_update on public.activities
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- periods: für alle aktiven Benutzer lesbar (keine Personendaten), Schreiben
-- nur Admin.
create policy periods_select on public.periods
  for select
  using (public.is_active_user());

create policy periods_insert on public.periods
  for insert
  with check (public.is_admin());

create policy periods_update on public.periods
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- entries: Admin sieht/schreibt alles, hauswart nur die eigene Familie.
-- Schreiben in abgeschlossenen Perioden wird zusätzlich vom
-- entries_before_write-Trigger verhindert (gilt auch für Admin).
create policy entries_select on public.entries
  for select
  using (public.is_admin() or family_id = public.my_family_id());

create policy entries_insert on public.entries
  for insert
  with check (
    public.is_admin()
    or (family_id = public.my_family_id() and public.is_active_user())
  );

create policy entries_update on public.entries
  for update
  using (
    public.is_admin()
    or (family_id = public.my_family_id() and public.is_active_user())
  )
  with check (
    public.is_admin()
    or (family_id = public.my_family_id() and public.is_active_user())
  );

create policy entries_delete on public.entries
  for delete
  using (
    exists (
      select 1 from public.periods p
      where p.id = entries.period_id and p.status = 'offen'
    )
    and (
      public.is_admin()
      or (family_id = public.my_family_id() and public.is_active_user())
    )
  );

-- audit_log: nur Admin darf lesen. Geschrieben wird ausschliesslich durch
-- die SECURITY DEFINER-Trigger-Funktion write_audit_log (umgeht RLS), keine
-- INSERT/UPDATE/DELETE-Policy für Clients.
create policy audit_log_select on public.audit_log
  for select
  using (public.is_admin());
