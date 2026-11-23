# hauswart-app

Stundenerfassung und Abrechnung für ein Hauswart-Team: eine installierbare
PWA (Vite/React/TypeScript) auf GitHub Pages mit Supabase als Backend
(Postgres, Auth, Row Level Security). Ersetzt ein Google-Formular.

**Live:** https://defendeggu.github.io/hauswart-app/

Der verbindliche Plan (Architektur, Rollen, Datenmodell, Sicherheit,
Meilensteine) steht in [docs/PLAN.md](docs/PLAN.md). Hinweise für die
Entwicklung mit Claude Code stehen in [CLAUDE.md](CLAUDE.md).

## Stand

Aktuelle Version siehe `package.json` bzw. Fusszeile der App (SemVer).

- **M0** Projektgerüst, PWA, GitHub Actions – erledigt
- **M1** Datenmodell, RLS, Trigger, Login per Benutzername – erledigt
- **M2** Hauswart-App: Stunden/Auslagen erfassen, eigene Einträge – erledigt
- **M3** Admin-Bereich: Übersicht, Einträge, Familien, Tätigkeiten, Logins – erledigt
- **M4** 2FA (Pflicht für Admins), Perioden abschliessen/wieder öffnen, Stundensatz, Audit-Log – erledigt
- **M5** Export CSV/Excel, PDF-Abrechnung pro Familie, Sammel-PDF, Jahresbericht für die GV – erledigt
- M6–M7: siehe [docs/PLAN.md](docs/PLAN.md) Abschnitt 9

## Funktionen

- **Familien (Rolle hauswart):** Login per Benutzername, Stunden und Auslagen
  erfassen, eigene Einträge nach Periode/Monat mit Guthaben, Bearbeiten und
  Löschen in offenen Perioden, Passwort ändern, 2FA freiwillig. Als App auf
  iPhone/Android installierbar.
- **Admins (Verwalter, Entwickler):** Übersicht pro Periode, alle Einträge
  filtern/korrigieren/nachtragen (mit Kommentar), Familien und Tätigkeiten
  pflegen, Logins mit Initial-Passwort anlegen, Passwort und 2FA
  zurücksetzen, Logins sperren, Perioden abschliessen/wieder öffnen,
  Stundensatz ändern, Audit-Log, Export (CSV/Excel), PDF-Abrechnungen und
  Jahresbericht für die GV. 2FA ist Pflicht.
- Darstellung hell, dunkel oder wie das Gerät (Umschalter in der Fusszeile).
- Echte Namen stehen nur in der Datenbank, nie im Repo.

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

**Frontend:** Push auf `main` baut die App und deployt sie automatisch via
GitHub Actions auf GitHub Pages. Die Supabase-Verbindung kommt aus den
Repo-Variablen `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (*Settings →
Secrets and variables → Actions → Variables*, der publishable Key) – beide
sind öffentlich, siehe [docs/PLAN.md](docs/PLAN.md) Abschnitt 3.

**Backend:** Supabase-Projekt `hauswart-app` (Region Zürich), per
`supabase link` mit dem Repo verknüpft. Migrationen und Edge Functions
werden bewusst von Hand eingespielt:

```bash
npx supabase login                       # einmalig pro Rechner
npx supabase db push --remote            # neue Migrationen
npx supabase functions deploy resolve-login-email --remote=<ref> --use-api
npx supabase functions deploy admin-logins --remote=<ref> --use-api
npx supabase config diff                 # Auth-Einstellungen prüfen, dann ggf. config push
```

**Erster Admin** (nur einmal nötig, weitere Logins dann in der App unter
*Logins*): im Supabase-Dashboard unter *Authentication → Users* einen User
mit echter E-Mail anlegen („Auto Confirm User"), dann im SQL Editor:

```sql
insert into public.profiles (id, username, name, rolle)
select id, '<benutzername>', '<Name>', 'admin'
from auth.users where email = '<e-mail>';
```

## 2FA

Für Admins ist die Zwei-Faktor-Anmeldung (TOTP, z.B. Google Authenticator)
Pflicht; ohne sie gibt die Datenbank keine Admin-Rechte (AAL2 in den
RLS-Policies). Für Familien ist sie freiwillig (unter *Konto*).

Verliert jemand sein Handy, setzt ein anderer Admin unter *Logins → 2FA
zurücksetzen* die 2FA zurück. **Notfall** (kein Admin mehr mit 2FA
erreichbar): im Supabase-Dashboard im SQL Editor

```sql
delete from auth.mfa_factors
where user_id = (select id from auth.users where email = '<e-mail des admins>');
```

Danach anmelden und die 2FA neu einrichten.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
