-- RLS-Tests für profiles: keine Selbstbeförderung, Sichtbarkeit.
-- Unverifiziert ohne lokale Supabase-Instanz (siehe entries_rls_test.sql).

BEGIN;
SELECT plan(5);

CREATE TEMPORARY TABLE test_ids (key text PRIMARY KEY, val uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO test_ids (key) VALUES ('family_a'), ('family_b'), ('user_a'), ('user_b'), ('admin');

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

-- Ein hauswart darf sein eigenes Profil sehen, aber keine fremden.
SELECT pg_temp.login_as(pg_temp.id('user_a'));

SELECT is(
  (SELECT count(*) FROM public.profiles)::int, 1,
  'hauswart sieht nur das eigene Profil'
);

-- Keine Selbstbeförderung: rolle, family_id, username, aktiv sind gesperrt.
SELECT throws_ok(
  format($sql$UPDATE public.profiles SET rolle = 'admin' WHERE id = '%s'$sql$, pg_temp.id('user_a')),
  'P0001',
  'hauswart kann sich nicht selbst zum Admin machen'
);

SELECT throws_ok(
  format($sql$UPDATE public.profiles SET family_id = '%s' WHERE id = '%s'$sql$,
    pg_temp.id('family_b'), pg_temp.id('user_a')),
  'P0001',
  'hauswart kann die eigene Familie nicht wechseln'
);

SELECT throws_ok(
  format($sql$UPDATE public.profiles SET aktiv = false WHERE id = '%s'$sql$, pg_temp.id('user_a')),
  'P0001',
  'hauswart kann sich nicht selbst sperren oder entsperren'
);

SELECT pg_temp.logout();

-- Admin darf alles sehen und ändern.
SELECT pg_temp.login_as(pg_temp.id('admin'));

SELECT is(
  (SELECT count(*) FROM public.profiles)::int, 3,
  'admin sieht alle Profile'
);

SELECT pg_temp.logout();

SELECT * FROM finish();
ROLLBACK;
