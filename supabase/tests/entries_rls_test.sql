-- RLS-Tests für entries: Familienisolation, Admin-Zugriff, gesperrte
-- Benutzer. Lokal/CI noch nicht gegen eine laufende Supabase-Instanz
-- gelaufen (hier kein Docker verfügbar) - bitte mit
-- `npx supabase test db` verifizieren.

BEGIN;
SELECT plan(8);

-- Fixtures -------------------------------------------------------------

CREATE TEMPORARY TABLE test_ids (key text PRIMARY KEY, val uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO test_ids (key) VALUES
  ('family_a'), ('family_b'), ('user_a'), ('user_b'), ('admin'),
  ('activity'), ('period');

CREATE FUNCTION pg_temp.id(p_key text) RETURNS uuid AS $$
  SELECT val FROM test_ids WHERE key = p_key;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION pg_temp.make_auth_user(p_id uuid, p_email text) RETURNS void AS $$
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
  );
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.login_as(p_user uuid, p_aal text DEFAULT 'aal2') RETURNS void AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.logout() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
END;
$$ LANGUAGE plpgsql;

INSERT INTO public.families (id, name) VALUES
  (pg_temp.id('family_a'), 'Test Familie A'),
  (pg_temp.id('family_b'), 'Test Familie B');

SELECT pg_temp.make_auth_user(pg_temp.id('user_a'), 'test-user-a@test.local');
SELECT pg_temp.make_auth_user(pg_temp.id('user_b'), 'test-user-b@test.local');
SELECT pg_temp.make_auth_user(pg_temp.id('admin'), 'test-admin@test.local');

INSERT INTO public.profiles (id, family_id, username, name, rolle, aktiv) VALUES
  (pg_temp.id('user_a'), pg_temp.id('family_a'), 'test-user-a', 'Test A', 'hauswart', true),
  (pg_temp.id('user_b'), pg_temp.id('family_b'), 'test-user-b', 'Test B', 'hauswart', true),
  (pg_temp.id('admin'), null, 'test-admin', 'Test Admin', 'admin', true);

INSERT INTO public.activities (id, name, einheit) VALUES
  (pg_temp.id('activity'), 'Test Tätigkeit', 'stunden');

INSERT INTO public.periods (id, name, typ, von, bis, stundensatz_chf, status) VALUES
  (pg_temp.id('period'), 'Test-Periode', 'quartal', current_date - 10, current_date + 80, 30, 'offen');

-- Ein Eintrag pro Familie, direkt als postgres (RLS greift hier nicht, da
-- Tabellenbesitzer) eingefügt, damit die SELECT-Tests unabhängig von den
-- INSERT-Policies sind.
INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h)
VALUES (pg_temp.id('family_a'), pg_temp.id('period'), pg_temp.id('user_a'), current_date, pg_temp.id('activity'), 2);

INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h)
VALUES (pg_temp.id('family_b'), pg_temp.id('period'), pg_temp.id('user_b'), current_date, pg_temp.id('activity'), 3);

-- Tests ------------------------------------------------------------------

SELECT pg_temp.login_as(pg_temp.id('user_a'));

SELECT is(
  (SELECT count(*) FROM public.entries)::int, 1,
  'hauswart sieht nur Einträge der eigenen Familie'
);

SELECT lives_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h)
         VALUES ('%s', '%s', '%s', current_date, '%s', 1)$sql$,
    pg_temp.id('family_a'), pg_temp.id('period'), pg_temp.id('user_a'), pg_temp.id('activity')
  ),
  'hauswart kann für die eigene Familie erfassen'
);

SELECT throws_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h)
         VALUES ('%s', '%s', '%s', current_date, '%s', 1)$sql$,
    pg_temp.id('family_b'), pg_temp.id('period'), pg_temp.id('user_a'), pg_temp.id('activity')
  ),
  '42501',
  'hauswart kann nicht für eine fremde Familie erfassen'
);

SELECT pg_temp.logout();

-- Gesperrter Benutzer: aktiv = false muss als postgres gesetzt werden (RLS
-- verbietet Hauswarten ohnehin, das eigene aktiv zu ändern).
UPDATE public.profiles SET aktiv = false WHERE id = pg_temp.id('user_a');

SELECT pg_temp.login_as(pg_temp.id('user_a'));

SELECT is(
  (SELECT count(*) FROM public.entries)::int, 0,
  'gesperrter Benutzer sieht keine Einträge mehr'
);

SELECT pg_temp.logout();
UPDATE public.profiles SET aktiv = true WHERE id = pg_temp.id('user_a');

-- Admin ohne bestätigte 2FA (aal1) hat keine Admin-Rechte.
SELECT pg_temp.login_as(pg_temp.id('admin'), 'aal1');

SELECT is(
  (SELECT count(*) FROM public.entries)::int, 0,
  'admin ohne 2FA (aal1) sieht keine Einträge'
);

SELECT pg_temp.logout();

-- Admin mit 2FA (aal2) sieht und schreibt alles (mit Pflicht-Kommentar).
SELECT pg_temp.login_as(pg_temp.id('admin'));

SELECT is(
  (SELECT count(*) FROM public.entries)::int, 3,
  'admin sieht Einträge aller Familien'
);

SELECT throws_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h)
         VALUES ('%s', '%s', '%s', current_date, '%s', 1)$sql$,
    pg_temp.id('family_a'), pg_temp.id('period'), pg_temp.id('admin'), pg_temp.id('activity')
  ),
  'P0001',
  'admin braucht einen Kommentar, wenn er einen Eintrag erfasst'
);

SELECT lives_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h, admin_kommentar)
         VALUES ('%s', '%s', '%s', current_date, '%s', 1, 'Nachtrag laut Absprache')$sql$,
    pg_temp.id('family_a'), pg_temp.id('period'), pg_temp.id('admin'), pg_temp.id('activity')
  ),
  'admin kann mit Kommentar für jede Familie nachtragen'
);

SELECT pg_temp.logout();

SELECT * FROM finish();
ROLLBACK;
