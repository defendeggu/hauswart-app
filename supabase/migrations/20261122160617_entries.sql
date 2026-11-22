create table public.entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  period_id uuid not null references public.periods (id),
  erfasst_von uuid not null references public.profiles (id),
  datum date not null,
  activity_id uuid not null references public.activities (id),
  dauer_h numeric(4, 2),
  betrag_chf numeric(6, 2),
  bemerkung text,
  admin_kommentar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Genau eines von dauer_h/betrag_chf ist gesetzt.
  constraint entries_exactly_one_value check (
    (dauer_h is not null and betrag_chf is null)
    or (dauer_h is null and betrag_chf is not null)
  ),

  -- Dauer: > 0, <= 12 h, in 0.25er-Schritten.
  constraint entries_dauer_range check (
    dauer_h is null or (dauer_h > 0 and dauer_h <= 12)
  ),
  constraint entries_dauer_viertelstunden check (
    dauer_h is null or (dauer_h * 4) = floor(dauer_h * 4)
  ),

  -- Betrag: > 0, <= 500 CHF, auf 5 Rappen genau.
  constraint entries_betrag_range check (
    betrag_chf is null or (betrag_chf > 0 and betrag_chf <= 500)
  ),
  constraint entries_betrag_5rappen check (
    betrag_chf is null or (betrag_chf * 20) = floor(betrag_chf * 20)
  )
);

create index entries_family_period_idx on public.entries (family_id, period_id);
create index entries_period_idx on public.entries (period_id);
create index entries_activity_idx on public.entries (activity_id);

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- Regeln, die vom heutigen Datum oder anderen Tabellen abhängen, siehe
-- docs/PLAN.md Abschnitt 5 ("Regeln"):
-- - Datum nicht in der Zukunft (Europe/Zurich)
-- - period_id wird aus dem Datum gesetzt, Periode muss offen sein
-- - Tätigkeit muss für die Familie erlaubt sein (nur_familien)
-- - Wert (Dauer/Betrag) muss zur Einheit der Tätigkeit passen
-- - Bemerkung Pflicht, wenn die Tätigkeit es verlangt
-- - Kommentar Pflicht, wenn ein Admin einen Eintrag erfasst oder ändert
create function public.entries_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_activity public.activities%rowtype;
  v_period public.periods%rowtype;
  v_heute date := (now() at time zone 'Europe/Zurich')::date;
begin
  select * into v_activity from public.activities where id = new.activity_id;
  if not found then
    raise exception 'Unbekannte Tätigkeit';
  end if;

  if new.datum > v_heute then
    raise exception 'Das Datum darf nicht in der Zukunft liegen';
  end if;

  if v_activity.nur_familien is not null
     and not (new.family_id = any (v_activity.nur_familien)) then
    raise exception 'Diese Tätigkeit ist für diese Familie nicht erlaubt';
  end if;

  if v_activity.einheit = 'stunden' and new.dauer_h is null then
    raise exception 'Diese Tätigkeit wird in Stunden erfasst';
  end if;
  if v_activity.einheit = 'franken' and new.betrag_chf is null then
    raise exception 'Diese Tätigkeit wird in Franken erfasst';
  end if;

  if v_activity.bemerkung_pflicht and (new.bemerkung is null or btrim(new.bemerkung) = '') then
    raise exception 'Für diese Tätigkeit ist eine Bemerkung Pflicht';
  end if;

  select * into v_period from public.periods where new.datum between von and bis;
  if not found then
    raise exception 'Für dieses Datum existiert keine Periode';
  end if;
  if v_period.status <> 'offen' then
    raise exception 'Die Periode für dieses Datum ist abgeschlossen';
  end if;
  new.period_id := v_period.id;

  if public.is_admin() and (new.admin_kommentar is null or btrim(new.admin_kommentar) = '') then
    raise exception 'Kommentar Pflicht, wenn ein Admin einen Eintrag erfasst oder ändert';
  end if;

  return new;
end;
$$;

create trigger entries_before_write
  before insert or update on public.entries
  for each row execute function public.entries_before_write();
