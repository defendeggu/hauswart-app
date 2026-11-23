# hauswart-app

Stundenerfassung und Abrechnung für ein Hauswart-Team: eine PWA (Vite/React/
TypeScript) auf GitHub Pages mit Supabase als Backend (Postgres, Auth, Row
Level Security). Ersetzt ein Google-Formular.

**Der verbindliche Plan steht in [docs/PLAN.md](docs/PLAN.md).** Er legt
Architektur, Rollen, Datenmodell, Sicherheit und Meilensteine fest. Bei
Abweichungen davon zuerst nachfragen.

## Befehle

```bash
npm run dev          # Dev-Server (Vite)
npm run build        # Typecheck + Produktionsbuild nach dist/
npm run typecheck    # Nur Typecheck
npm test             # Vitest einmalig
npm run test:watch   # Vitest im Watch-Modus
npm run test:e2e     # Playwright (braucht laufende lokale Supabase-Instanz)

npm run db:start     # Lokale Supabase-Instanz starten (braucht Docker)
npm run db:reset     # Migrationen + supabase/seed.sql neu einspielen
npm run db:stop       # Lokale Supabase-Instanz stoppen

npx supabase test db  # pgTAP-Tests in supabase/tests/ gegen die lokale DB
```

Gehostetes Projekt (Region Zürich, ref `nhqwxeibjghomnxjvkch`, bereits per
`supabase link` verknüpft):

```bash
npx supabase db push --remote                 # neue Migrationen einspielen
npx supabase functions deploy <name> --remote=nhqwxeibjghomnxjvkch --use-api
npx supabase config diff                      # vor `config push` immer prüfen
```

`supabase/config.toml` gilt lokal **und** (per `config push`) für das
gehostete Projekt – keine reinen Entwicklungswerte für Auth eintragen.

`db:start`/`db:reset` brauchen die Supabase CLI (als devDependency via `npx
supabase` verfügbar) und Docker Desktop lokal installiert und gestartet.

## Konventionen

- Code und Commit-Nachrichten auf Englisch, Oberflächentexte (UI, Fehler-
  meldungen) auf Deutsch (Schweiz): `ss` statt `ß`, Datum `TT.MM.JJJJ`,
  Beträge als `CHF 1'234.50` (siehe `src/lib/format.ts`). Geldbeträge intern
  immer als ganzzahlige Rappen rechnen, nie als Fliesskommazahlen.
- **Keine echten Namen (Familien, Personen) in Git.** Familiennamen werden
  ausschliesslich über die Admin-UI in der produktiven Datenbank erfasst.
  Migrationen und `supabase/seed.sql` verwenden nur Platzhalter («Familie
  A», «Familie B», …).
- Rechte werden in der Datenbank per Row Level Security durchgesetzt, nie
  nur im Frontend. Kein `service_role`-Key im Frontend-Code.
- SQL-Migrationen in `supabase/migrations/` sind append-only: eine einmal
  angewendete Migration wird nicht mehr verändert, Korrekturen kommen als
  neue Migration.
- React Router läuft als `HashRouter`, weil GitHub Pages keine serverseitige
  Umleitung auf `index.html` kann. Der Basis-Pfad des Builds kommt aus der
  Build-Variable `VITE_BASE_PATH` (siehe `.env.example`), weil die App
  später auf eine eigene Domain zieht.
- Mobil zuerst für den Hauswart-Bereich: Touch-Flächen mindestens 48px.
- Dunkelmodus: `src/index.css` definiert unter `:root.dark` die Farbskalen
  `white`, `slate`, `teal`, `amber`, `red` um (Klasse `.dark` auf `<html>`,
  gesetzt von `public/theme-init.js` und `src/lib/theme.ts`). Komponenten
  verwenden deshalb nur diese Skalen; andere Farben (z.B. `gray`, `blue`)
  zuerst dort ergänzen. Halbtransparente Overlays mit `bg-black/…`.
- Die Content-Security-Policy steht in `vite.config.ts` und wird nur im Build
  als `<meta>`-Tag eingefügt (der Dev-Server braucht Inline-Styles). Keine
  Inline-Skripte – die CSP verbietet sie.
- Version nach SemVer in `package.json` (wird in der Fusszeile angezeigt);
  neue Funktionen = Minor. Lock-Datei danach **nicht** mit `npm install
  --package-lock-only` nachziehen: unter Windows fallen dabei gebündelte
  Linux-Pakete von Tailwind heraus und `npm ci` in CI scheitert. Stattdessen
  die beiden `version`-Felder in `package-lock.json` direkt anpassen.

## Struktur

- `src/` – Frontend (React)
- `supabase/migrations/` – Datenbankschema (SQL, der Reihe nach angewendet)
- `supabase/seed.sql` – Testdaten nur für die lokale Entwicklung
- `supabase/functions/` – Edge Functions
- `docs/PLAN.md` – verbindlicher Plan
- `docs/ANLEITUNG.md` – Kurzanleitung für die Familien (ab M6)
