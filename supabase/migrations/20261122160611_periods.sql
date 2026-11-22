create table public.periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  typ text not null check (typ in ('monat', 'quartal', 'jahr')),
  von date not null,
  bis date not null,
  stundensatz_chf numeric(6, 2) not null check (stundensatz_chf > 0),
  status text not null default 'offen' check (status in ('offen', 'abgeschlossen')),
  abgeschlossen_am timestamptz,
  abgeschlossen_von uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint periods_von_vor_bis check (von <= bis)
);

-- Perioden dürfen sich nicht überlappen (unabhängig vom Typ). daterange hat
-- einen eingebauten GiST-Operator für "&&", keine zusätzliche Extension nötig.
alter table public.periods
  add constraint periods_no_overlap exclude using gist (daterange(von, bis, '[]') with &&);

create unique index periods_name_key on public.periods (lower(name));

create trigger periods_set_updated_at
  before update on public.periods
  for each row execute function public.set_updated_at();

-- Berechnet von/bis für einen Periodentyp, ausgehend von einem beliebigen
-- Datum innerhalb der Periode.
create function public.period_bounds(p_typ text, p_date date)
returns table (von date, bis date)
language plpgsql immutable as $$
begin
  if p_typ = 'monat' then
    von := date_trunc('month', p_date)::date;
    bis := (von + interval '1 month' - interval '1 day')::date;
  elsif p_typ = 'quartal' then
    von := date_trunc('quarter', p_date)::date;
    bis := (von + interval '3 months' - interval '1 day')::date;
  elsif p_typ = 'jahr' then
    von := date_trunc('year', p_date)::date;
    bis := (von + interval '1 year' - interval '1 day')::date;
  else
    raise exception 'Unbekannter Periodentyp: %', p_typ;
  end if;
  return next;
end;
$$;

create function public.period_name(p_typ text, p_von date)
returns text
language plpgsql immutable as $$
begin
  if p_typ = 'monat' then
    return to_char(p_von, 'YYYY-MM');
  elsif p_typ = 'quartal' then
    return to_char(p_von, 'YYYY') || '-Q' || to_char(p_von, 'Q');
  elsif p_typ = 'jahr' then
    return to_char(p_von, 'YYYY');
  else
    raise exception 'Unbekannter Periodentyp: %', p_typ;
  end if;
end;
$$;

-- Legt die laufende und die nächste Periode an, falls sie fehlen: gleicher
-- Typ wie die letzte vorhandene Periode, Stundensatz von dort übernommen.
-- Nur für Admins. Setzt eine erste Periode (per Migration/Seed) voraus.
create function public.ensure_periods() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_last public.periods%rowtype;
  v_von date;
  v_bis date;
  v_heute date := (now() at time zone 'Europe/Zurich')::date;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen Perioden anlegen';
  end if;

  loop
    select * into v_last from public.periods order by von desc limit 1;
    if not found then
      raise exception 'Keine bestehende Periode gefunden - lege die erste Periode per Migration/Seed an';
    end if;

    exit when (select count(*) from public.periods where bis >= v_heute) >= 2;

    select von, bis into v_von, v_bis
      from public.period_bounds(v_last.typ, v_last.bis + 1);

    insert into public.periods (name, typ, von, bis, stundensatz_chf, status)
    values (
      public.period_name(v_last.typ, v_von),
      v_last.typ,
      v_von,
      v_bis,
      v_last.stundensatz_chf,
      'offen'
    );
  end loop;
end;
$$;

revoke all on function public.ensure_periods() from public;
grant execute on function public.ensure_periods() to authenticated;
