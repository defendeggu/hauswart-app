-- Trigger-/Check-Constraint-Tests für entries: Einheit, Zukunftsdatum,
-- abgeschlossene Periode, Bemerkungspflicht, nur_familien.
-- Unverifiziert ohne lokale Supabase-Instanz (siehe entries_rls_test.sql).

BEGIN;
SELECT plan(10);

CREATE TEMPORARY TABLE test_ids (key text PRIMARY KEY, val uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO test_ids (key) VALUES
  ('family_a'), ('family_b'), ('user_a'), ('activity_stunden'),
  ('activity_franken'), ('activity_nur_a'), ('period_offen'), ('period_zu');

CREATE FUNCTION pg_temp.id(p_key text) RETURNS uuid AS $$
  SELECT val FROM test_ids WHERE key = p_key;
$$ LANGUAGE sql STABLE;

INSERT INTO public.families (id, name) VALUES
  (pg_temp.id('family_a'), 'Test Familie A'),
  (pg_temp.id('family_b'), 'Test Familie B');

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000', pg_temp.id('user_a'), 'authenticated', 'authenticated',
  'test-user-a@test.local', 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
);

INSERT INTO public.profiles (id, family_id, username, name, rolle, aktiv) VALUES
  (pg_temp.id('user_a'), pg_temp.id('family_a'), 'test-user-a', 'Test A', 'hauswart', true);

INSERT INTO public.activities (id, name, einheit, bemerkung_pflicht, nur_familien) VALUES
  (pg_temp.id('activity_stunden'), 'Test Stunden', 'stunden', false, null),
  (pg_temp.id('activity_franken'), 'Test Franken', 'franken', true, null),
  (pg_temp.id('activity_nur_a'), 'Test Nur A', 'stunden', false, array[pg_temp.id('family_a')]);

INSERT INTO public.periods (id, name, typ, von, bis, stundensatz_chf, status) VALUES
  (pg_temp.id('period_offen'), 'Test-Periode-Offen', 'quartal', current_date - 10, current_date + 80, 30, 'offen'),
  (pg_temp.id('period_zu'), 'Test-Periode-Zu', 'quartal', current_date - 100, current_date - 11, 30, 'abgeschlossen');

-- 1. Stunden-Tätigkeit mit Betrag statt Dauer wird abgelehnt.
SELECT throws_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, betrag_chf)
         VALUES ('%s', '%s', '%s', current_date, '%s', 10)$sql$,
    pg_temp.id('family_a'), pg_temp.id('period_offen'), pg_temp.id('user_a'), pg_temp.id('activity_stunden')
  ),
  'P0001',
  'Stunden-Tätigkeit mit Betrag statt Dauer wird abgelehnt'
);

-- 2. Franken-Tätigkeit mit Dauer statt Betrag wird abgelehnt.
SELECT throws_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h, bemerkung)
         VALUES ('%s', '%s', '%s', current_date, '%s', 1, 'x')$sql$,
    pg_temp.id('family_a'), pg_temp.id('period_offen'), pg_temp.id('user_a'), pg_temp.id('activity_franken')
  ),
  'P0001',
  'Franken-Tätigkeit mit Dauer statt Betrag wird abgelehnt'
);

-- 3. Datum in der Zukunft wird abgelehnt.
SELECT throws_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h)
         VALUES ('%s', '%s', '%s', current_date + 1, '%s', 1)$sql$,
    pg_temp.id('family_a'), pg_temp.id('period_offen'), pg_temp.id('user_a'), pg_temp.id('activity_stunden')
  ),
  'P0001',
  'ein Datum in der Zukunft wird abgelehnt'
);

-- 4. Eintrag in einer abgeschlossenen Periode wird abgelehnt.
SELECT throws_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h)
         VALUES ('%s', '%s', '%s', current_date - 50, '%s', 1)$sql$,
    pg_temp.id('family_a'), pg_temp.id('period_zu'), pg_temp.id('user_a'), pg_temp.id('activity_stunden')
  ),
  'P0001',
  'ein Eintrag in einer abgeschlossenen Periode wird abgelehnt'
);

-- 5. Bemerkung fehlt bei einer Tätigkeit mit Bemerkungspflicht.
SELECT throws_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, betrag_chf)
         VALUES ('%s', '%s', '%s', current_date, '%s', 10)$sql$,
    pg_temp.id('family_a'), pg_temp.id('period_offen'), pg_temp.id('user_a'), pg_temp.id('activity_franken')
  ),
  'P0001',
  'fehlende Pflicht-Bemerkung wird abgelehnt'
);

-- 6. nur_familien: eine nicht erlaubte Familie wird abgelehnt.
SELECT throws_ok(
  format(
    $sql$INSERT INTO public.entries (family_id, period_id, erfasst_von, datum, activity_id, dauer_h)
         VALUES ('%s', '%s', '%s', current_date, '%s', 1)$sql$,
    pg_temp.id('family_b'), pg_temp.id('period_offen'), pg_temp.id('user_a'), pg_temp.id('activity_nur_a')
  ),
  'P0001',
  'eine für nur_familien nicht erlaubte Familie wird abgelehnt'
);

-- 7. Laufende Periode kann nicht abgeschlossen werden (Ende noch nicht erreicht).
SELECT throws_ok(
  format($sql$UPDATE public.periods SET status = 'abgeschlossen' WHERE id = '%s'$sql$, pg_temp.id('period_offen')),
  'P0001',
  'eine laufende Periode kann nicht abgeschlossen werden'
);

-- 8. Abgeschlossene Periode ist schreibgeschützt (z.B. Stundensatz).
SELECT throws_ok(
  format($sql$UPDATE public.periods SET stundensatz_chf = 35 WHERE id = '%s'$sql$, pg_temp.id('period_zu')),
  'P0001',
  'der Stundensatz einer abgeschlossenen Periode ist gesperrt'
);

-- 9. Wiederöffnen ohne Begründung wird abgelehnt.
SELECT throws_ok(
  format($sql$UPDATE public.periods SET status = 'offen' WHERE id = '%s'$sql$, pg_temp.id('period_zu')),
  'P0001',
  'wiederöffnen ohne Begründung wird abgelehnt'
);

-- 10. Mit Begründung geht es, und sie landet im Audit-Log.
SELECT set_config('hauswart.grund', 'Nachtrag einer Familie', true);
UPDATE public.periods SET status = 'offen' WHERE id = pg_temp.id('period_zu');
SELECT is(
  (SELECT grund FROM public.audit_log
   WHERE tabelle = 'periods' AND zeile_id = pg_temp.id('period_zu')
   ORDER BY id DESC LIMIT 1),
  'Nachtrag einer Familie',
  'die Begründung fürs Wiederöffnen steht im Audit-Log'
);

SELECT * FROM finish();
ROLLBACK;
