-- Profile: ein Profil pro Auth-User, verknüpft mit Rolle und (bei hauswart)
-- einer Familie. Login erfolgt über profiles.username, nicht per E-Mail
-- (siehe docs/PLAN.md Abschnitt 5/8). Supabase Auth braucht trotzdem eine
-- E-Mail; hauswart-User bekommen dafür eine interne Pseudo-Adresse
-- (<id>@hauswart.internal), die nirgends angezeigt wird.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid references public.families (id),
  username text not null,
  name text not null,
  rolle text not null check (rolle in ('hauswart', 'admin')),
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_not_blank check (btrim(username) <> ''),
  constraint profiles_name_not_blank check (btrim(name) <> ''),
  constraint profiles_family_matches_rolle check (
    (rolle = 'hauswart' and family_id is not null)
    or (rolle = 'admin' and family_id is null)
  )
);

create unique index profiles_username_key on public.profiles (lower(username));

-- Höchstens ein aktives hauswart-Profil pro Familie.
create unique index profiles_one_active_hauswart_per_family
  on public.profiles (family_id)
  where rolle = 'hauswart' and aktiv;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Security-definer-Helfer, damit RLS-Policies auf profiles nicht rekursiv
-- werden (siehe docs/PLAN.md Abschnitt 7 "Keine Selbstbeförderung").

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rolle = 'admin' and aktiv
  );
$$;

create function public.my_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.profiles
  where id = auth.uid() and aktiv;
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and aktiv
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.my_family_id() from public;
revoke all on function public.is_active_user() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_family_id() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- Keine Selbstbeförderung: rolle, family_id, username und aktiv dürfen nur
-- von einem Admin geändert werden (auch nicht im eigenen Profil).
create function public.profiles_prevent_self_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if new.rolle is distinct from old.rolle
       or new.family_id is distinct from old.family_id
       or new.aktiv is distinct from old.aktiv
       or new.username is distinct from old.username then
      raise exception 'rolle, family_id, username und aktiv können nur von einem Admin geändert werden';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_escalation
  before update on public.profiles
  for each row execute function public.profiles_prevent_self_escalation();
