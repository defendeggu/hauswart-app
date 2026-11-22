# hauswart-app

Stundenerfassung und Abrechnung für ein Hauswart-Team: eine installierbare
PWA (Vite/React/TypeScript) auf GitHub Pages mit Supabase als Backend
(Postgres, Auth, Row Level Security). Ersetzt ein Google-Formular.

**Live:** https://defendeggu.github.io/hauswart-app/

Der verbindliche Plan (Architektur, Rollen, Datenmodell, Sicherheit,
Meilensteine) steht in [docs/PLAN.md](docs/PLAN.md). Hinweise für die
Entwicklung mit Claude Code stehen in [CLAUDE.md](CLAUDE.md).

## Stand

- **M0** Projektgerüst, PWA, GitHub Actions – erledigt
- **M1** Datenmodell, RLS, Trigger, Login per Benutzername – erledigt
- **M2** Hauswart-App: Stunden/Auslagen erfassen, eigene Einträge – erledigt
- **M3** Admin-Bereich: Übersicht, Einträge, Familien, Tätigkeiten, Logins – erledigt
- M4–M7: siehe [docs/PLAN.md](docs/PLAN.md) Abschnitt 9

## Lokal entwickeln

Voraussetzungen: Node.js 24+, [Docker](https://www.docker.com/) (für die
lokale Supabase-Instanz).

```bash
npm install
cp .env.example .env.local   # und die Werte eintragen

npm run db:start             # startet lokale Supabase-Instanz (Docker)
npm run db:reset             # Migrationen + Testdaten einspielen

npm run dev                  # Dev-Server, http://localhost:5173
```

Weitere Befehle (Tests, Build, DB-Tests) siehe [CLAUDE.md](CLAUDE.md).

## Deploy

Push auf `main` baut die App und deployt sie automatisch via GitHub Actions
auf GitHub Pages. Die Supabase-Verbindung kommt aus den Repo-Variablen
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (*Settings → Secrets and
variables → Actions → Variables*) – beide sind öffentlich, siehe
[docs/PLAN.md](docs/PLAN.md) Abschnitt 3.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
