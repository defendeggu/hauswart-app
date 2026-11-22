-- M4: 2FA-Pflicht für Admin-Rechte, Periodenabschluss, Begründungen im
-- Audit-Log (siehe docs/PLAN.md Abschnitte 4, 6, 7).

-- 1. Admin-Rechte nur mit bestätigter 2FA (Authenticator Assurance Level 2).
--    Ein Admin ohne 2FA sieht dadurch nur noch sein eigenes Profil; das
--    Frontend leitet ihn zur 2FA-Einrichtung.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and rolle = 'admin' and aktiv
    );
$$;

-- 2. Begründung im Audit-Log. Wer eine Begründung mitgeben will, setzt vor
--    der Änderung in derselben Transaktion set_config('hauswart.grund', ...).
alter table public.audit_log add column grund text;

create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (wer, tabelle, zeile_id, aktion, alt, neu, grund)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    nullif(current_setting('hauswart.grund', true), '')
  );
  return coalesce(new, old);
end;
$$;

-- 3. Regeln für Perioden:
--    - abgeschlossene Perioden sind schreibgeschützt (auch für Admins)
--    - abschliessen erst nach Periodenende; Zeitpunkt und Admin werden gesetzt
--    - wieder öffnen nur mit Begründung (landet im Audit-Log)
--    - von/bis/typ nur ändern, solange keine Einträge daran hängen
create function public.periods_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_heute date := (now() at time zone 'Europe/Zurich')::date;
begin
  if old.status = 'abgeschlossen' and new.status = 'abgeschlossen' then
    raise exception 'Abgeschlossene Perioden sind schreibgeschützt';
  end if;

  if old.status = 'abgeschlossen' and new.status = 'offen' then
    if coalesce(btrim(current_setting('hauswart.grund', true)), '') = '' then
      raise exception 'Zum Wiederöffnen ist eine Begründung nötig';
    end if;
    new.abgeschlossen_am := null;
    new.abgeschlossen_von := null;
  end if;

  if old.status = 'offen' and new.status = 'abgeschlossen' then
    if new.bis >= v_heute then
      raise exception 'Eine Periode kann erst nach ihrem Ende abgeschlossen werden';
    end if;
    new.abgeschlossen_am := now();
    new.abgeschlossen_von := auth.uid();
  end if;

  if (new.von, new.bis, new.typ) is distinct from (old.von, old.bis, old.typ)
     and exists (select 1 from public.entries where period_id = old.id) then
    raise exception 'Zeitraum und Typ können nicht mehr geändert werden, weil schon Einträge existieren';
  end if;

  return new;
end;
$$;

create trigger periods_guard
  before update on public.periods
  for each row execute function public.periods_guard();

-- 4. Periode wieder öffnen (mit Begründung). SECURITY INVOKER: die
--    RLS-Policy periods_update prüft, dass der Aufrufer Admin ist.
create function public.reopen_period(p_period_id uuid, p_grund text) returns void
language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen Perioden wieder öffnen';
  end if;
  if coalesce(btrim(p_grund), '') = '' then
    raise exception 'Zum Wiederöffnen ist eine Begründung nötig';
  end if;
  perform set_config('hauswart.grund', btrim(p_grund), true);
  update public.periods set status = 'offen' where id = p_period_id;
  perform set_config('hauswart.grund', '', true);
end;
$$;

revoke all on function public.reopen_period(uuid, text) from public;
grant execute on function public.reopen_period(uuid, text) to authenticated;

-- 5. Typ einer künftigen Periode wechseln (z.B. von Quartal auf Monat). Nur
--    für die letzte Periode, solange sie noch nicht begonnen hat und leer ist.
--    Die Periode beginnt weiterhin am selben Tag; das Ende richtet sich nach
--    dem neuen Typ.
create function public.set_period_typ(p_period_id uuid, p_typ text) returns void
language plpgsql set search_path = public as $$
declare
  v_period public.periods%rowtype;
  v_heute date := (now() at time zone 'Europe/Zurich')::date;
  v_bis date;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen den Periodentyp ändern';
  end if;

  select * into v_period from public.periods where id = p_period_id;
  if not found then
    raise exception 'Periode nicht gefunden';
  end if;
  if v_period.von <= v_heute then
    raise exception 'Der Typ kann nur für eine Periode geändert werden, die noch nicht begonnen hat';
  end if;
  if exists (select 1 from public.periods where von > v_period.von) then
    raise exception 'Der Typ kann nur für die letzte Periode geändert werden';
  end if;

  select bis into v_bis from public.period_bounds(p_typ, v_period.von);

  update public.periods
  set typ = p_typ,
      bis = v_bis,
      name = public.period_name(p_typ, v_period.von)
  where id = p_period_id;
end;
$$;

revoke all on function public.set_period_typ(uuid, text) from public;
grant execute on function public.set_period_typ(uuid, text) to authenticated;
