-- Die Einheit einer Tätigkeit (stunden/franken) ist nicht mehr änderbar,
-- sobald Einträge daran hängen - sonst passten bestehende Einträge nicht
-- mehr zur Einheit (siehe docs/PLAN.md, M3 Stammdaten).
create function public.activities_lock_einheit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.einheit is distinct from old.einheit
     and exists (select 1 from public.entries where activity_id = old.id) then
    raise exception 'Die Einheit kann nicht mehr geändert werden, weil bereits Einträge zu dieser Tätigkeit existieren';
  end if;
  return new;
end;
$$;

create trigger activities_lock_einheit
  before update on public.activities
  for each row execute function public.activities_lock_einheit();
