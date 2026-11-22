-- Testdaten NUR für die lokale Entwicklung (supabase db reset). Niemals
-- echte Namen, niemals gegen die produktive Datenbank ausführen.
--
-- Nicht gegen eine laufende lokale Supabase-Instanz getestet (siehe
-- README: in dieser Umgebung sind Docker/Supabase CLI lokal nicht
-- verfügbar). Bitte mit `npm run db:reset` prüfen, sobald Docker läuft, und
-- bei Abweichungen vom auth.users/auth.identities-Schema anpassen.
--
-- Login lokal z.B. mit Benutzername "familie-a", Passwort "test12345678".
-- Admin: Benutzername "admin", Passwort "admin12345678".

do $$
declare
  v_admin_id uuid := gen_random_uuid();
  v_user_id uuid;
  v_family_id uuid;
  v_first_family_id uuid;
  v_slug text;
  v_email text;
  v_familien text[] := array[
    'Familie A', 'Familie B', 'Familie C', 'Familie D',
    'Familie E', 'Familie F', 'Familie G'
  ];
  f text;
  i int := 0;
begin
  -- Admin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
    'admin@hauswart.internal', extensions.crypt('admin12345678', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_admin_id, v_admin_id::text,
    jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@hauswart.internal'),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, family_id, username, name, rolle, aktiv)
  values (v_admin_id, null, 'admin', 'Test-Admin', 'admin', true);

  -- Je eine Platzhalter-Familie mit einem Hauswart-Login.
  foreach f in array v_familien loop
    i := i + 1;
    v_family_id := gen_random_uuid();
    v_user_id := gen_random_uuid();
    v_slug := 'familie-' || chr(96 + i); -- familie-a, familie-b, ...
    v_email := v_user_id::text || '@hauswart.internal';

    if i = 1 then
      v_first_family_id := v_family_id;
    end if;

    insert into public.families (id, name) values (v_family_id, f);

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt('test12345678', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', now(), now(), now()
    );

    insert into public.profiles (id, family_id, username, name, rolle, aktiv)
    values (v_user_id, v_family_id, v_slug, f || ' (Testperson)', 'hauswart', true);
  end loop;

  -- "Wasserbezug" nur für die erste Platzhalter-Familie erlaubt, zum Testen
  -- der nur_familien-Einschränkung (siehe M2).
  update public.activities
  set nur_familien = array[v_first_family_id]
  where name = 'Wasserbezug';
end $$;
