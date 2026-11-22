-- Produktive Stammdaten (keine Personendaten, darum unbedenklich in Git).
-- Tätigkeiten aus dem bisherigen Google-Formular.
insert into public.activities (name, einheit, bemerkung_pflicht, sortierung) values
  ('Rasen mähen', 'stunden', false, 10),
  ('Unkraut jäten', 'stunden', false, 20),
  ('Laub rechen', 'stunden', false, 30),
  ('Treppe / Platz wischen', 'stunden', false, 40),
  ('Schnee schaufeln / salzen', 'stunden', false, 50),
  ('Hecke / Bäume schneiden', 'stunden', false, 60),
  ('Unterhalt Maschinen', 'stunden', false, 70),
  ('Allgemeine Reinigungsarbeiten', 'stunden', false, 80),
  ('Allgemeine Unterhaltsarbeiten', 'stunden', false, 90),
  ('Wasserbezug', 'franken', false, 100),
  ('Anderes', 'stunden', true, 110),
  ('Quartierarbeitstag / Laubtag / Heckentag', 'stunden', false, 120),
  ('Verpflegung', 'franken', false, 130);

-- "Wasserbezug" ist laut Plan nur für eine bestimmte Familie erlaubt
-- (activities.nur_familien). Das kann erst gesetzt werden, sobald die
-- echte Familie über die Admin-UI existiert (ab M3) - hier bewusst nicht
-- eingeschränkt (nur_familien bleibt NULL = für alle Familien erlaubt).

-- Laufende Periode. Weitere Perioden entstehen über public.ensure_periods()
-- bzw. die Admin-UI (ab M4).
insert into public.periods (name, typ, von, bis, stundensatz_chf, status) values
  ('2026-Q4', 'quartal', '2026-10-01', '2026-12-31', 30.00, 'offen');
