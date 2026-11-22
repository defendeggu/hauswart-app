# hauswart-app – Plan

Die Stundenerfassung des Hauswart-Teams wird von einem Google-Formular zu einer
richtigen App mit Login und einem Admin-Bereich für den Verwalter. Dieses
Dokument ist die verbindliche Vorgabe für Architektur, Rollen, Datenmodell,
Sicherheit und Meilensteine. Abweichungen davon zuerst mit dem Auftraggeber
klären.

Heute: Google-Formular mit fünf Feldern (Familie, Datum, Tätigkeit, Dauer,
Bemerkungen). Jeder kann für jede Familie eintragen, Tippfehler bei der Dauer
sind möglich, und die Abrechnung passiert von Hand im Sheet.

---

## 1. Ziele

- **Hauswarte** erfassen Stunden und Auslagen in wenigen Sekunden auf dem
  Handy, sehen ihre eigenen Einträge und können sie korrigieren, solange die
  Periode offen ist.
- **Verwalter** pflegt Familien, Logins und Tätigkeiten, schliesst jede
  Periode ab und exportiert die Abrechnung pro Familie sowie den
  Jahresbericht für die GV.
- **Sicher:** Login mit Passwort, 2FA (TOTP-App) für Admins Pflicht und für
  Hauswarte freiwillig. Niemand registriert sich selbst, alle Logins werden
  vom Admin angelegt.
- **Günstig und wartungsarm:** keine eigenen Server, Code und Hosting auf
  GitHub.

## 2. Entscheide

| Thema | Entscheid | Folge für die App |
|---|---|---|
| Abrechnung | Stundensatz pro Periode, Standard **CHF 30.–** | Der Satz wird pro Periode gespeichert. Eine spätere Änderung verändert abgeschlossene Perioden nicht. |
| «Verpflegung» und «Wasserbezug» | Betrag in **Franken** | Tätigkeiten haben eine Einheit (Stunden oder Franken). Ein Eintrag hat entweder eine Dauer oder einen Betrag. |
| Bisherige Perioden | CHF 30.– galt schon vorher | Der Import legt alle alten Perioden mit Satz 30 an. |
| Nachträge | **30 Tage** nach Periodenende | Solange bleibt die alte Periode offen. |
| Periode | **Admin wählt pro neuer Periode einen festen Typ: Monat, Quartal oder Jahr** | `periods` bekommt ein Feld `typ` (`monat`/`quartal`/`jahr`) zusätzlich zu `von`/`bis`; die App rechnet `von`/`bis` passend zum Typ aus. |
| Jahresauswertung GV | Zusätzlicher **Jahresbericht**, unabhängig vom Periodentyp | Für die jährliche GV (ca. März/April) ein separater Bericht, der Stunden/Auslagen/Total pro Familie über ein ganzes Kalenderjahr aggregiert – auch wenn z.B. monatlich oder vierteljährlich abgerechnet wird. Siehe Abschnitt 6 und M5. |
| Logins | **Eine Person pro Familie, Login per Benutzername** | Genau ein Hauswart-Login pro Familie. Kein E-Mail-Login für Familien: Login per Benutzername, kein Self-Signup, kein automatischer Mailversand nötig. |
| Initial-Passwort | **Admin vergibt pro Familie ein eigenes Initial-Passwort** | Beim Anlegen einer Familie setzt der Admin direkt ein Passwort und teilt es der Familie persönlich mit (kein Einladungs-Mail-Versand). Passwort-Reset ebenfalls nur durch den Admin, kein Self-Service «Passwort vergessen» für Hauswarte. |
| Namen in Git | **Keine echten Namen im Repo** | Familiennamen und Personendaten werden ausschliesslich über die Admin-Oberfläche in der produktiven Datenbank erfasst, nie in Code, Migrationen oder Seed-Dateien, die ins (öffentliche) Repo committet werden. Test-/Seed-Daten nutzen Platzhalter («Familie A», «Familie B», …). |
| Genehmigung | **Nur Periodenabschluss** | Kein Status pro Eintrag. Mit dem Abschluss wird die Periode schreibgeschützt. |
| Zugriff | Verwalter und Entwickler als Admins | Zwei Admin-Konten (mit echter E-Mail-Adresse, da keine Namens-Problematik). Sie können sich gegenseitig die 2FA zurücksetzen. |
| Adresse | Zuerst `defendeggu.github.io/hauswart-app`, später eigene Domain | Basis-Pfad und App-Adresse sind konfigurierbar, der Wechsel ist in Abschnitt 10 beschrieben. |

## 3. Architektur

**Wichtig:** GitHub Pages liefert nur statische Dateien aus. Login, 2FA und
eine Datenbank gehen damit allein nicht. Es braucht also ein Backend daneben.

Gewählt: PWA auf GitHub Pages + **Supabase** (Postgres, Auth mit TOTP-2FA,
Row Level Security). Kein eigener Server, Gratis-Plan reicht für 7 Familien,
2FA eingebaut.

- **App statt Store-App:** Eine **PWA** (Progressive Web App) lässt sich auf
  Android und iPhone über «Zum Startbildschirm hinzufügen» wie eine App
  installieren. So braucht es keinen App Store, keine Entwicklerkonten und
  keine Reviews.
- **Region:** Supabase-Projekt in der Region Zürich (falls angeboten, sonst
  Frankfurt), wegen Personendaten nach Schweizer DSG.
- **Repo:** öffentlich ist für GitHub Pages am einfachsten
  (`defendeggu/hauswart-app`). Im Code stehen keine Geheimnisse: Der
  öffentliche Key von Supabase darf sichtbar sein, weil die Datenbank mit Row
  Level Security geschützt ist.

### Stolpersteine beim Gratis-Betrieb

- **E-Mail-Versand nur noch für Admins nötig:** Familien loggen sich per
  Benutzername ein (kein E-Mail-Login, kein Self-Service-Passwort-Reset),
  darum entfällt die Einladungs-Mail an die Familien. Die beiden Admin-Konten
  werden manuell per Dashboard/SQL angelegt. Ein eigener SMTP-Versand (Gmail
  mit App-Passwort) ist nur sinnvoll, falls die Admins selbst «Passwort
  vergessen» nutzen wollen – für den Go-live nicht zwingend erforderlich.
- **Pausieren:** Supabase pausiert Gratis-Projekte, die 7 Tage lang zu wenig
  Datenbank-Aktivität haben. → Eine GitHub Action fragt die Datenbank alle 3
  Tage einmal ab (M6).
- **Keep-alive schläft selbst ein:** GitHub schaltet zeitgesteuerte Workflows
  in öffentlichen Repos ab, wenn 60 Tage lang nichts im Repo passiert. → Der
  Keep-alive läuft zusätzlich als Cronjob auf einem eigenen Server (M6).
- **Backups:** Der Gratis-Plan hat keine automatischen Backups. → Eine
  GitHub Action macht wöchentlich einen `pg_dump` und verschlüsselt ihn.
  Abgelegt wird er in einem **privaten** Repo `hauswart-app-backup` (M6).
- **Datenbank-Verbindung aus GitHub Actions:** Die direkte Verbindung zur
  Datenbank läuft nur über IPv6, die Runner von GitHub können nur IPv4. → Für
  `pg_dump` die Verbindung «Session pooler» (Port 5432) verwenden.

## 4. Rollen und Rechte

| Rolle | Wer | Darf |
|---|---|---|
| `hauswart` | Eine Person pro Familie | Einträge der eigenen Familie erfassen, ansehen, bearbeiten und löschen, solange die Periode offen ist |
| `admin` | Verwalter und Entwickler | Alles sehen, Stammdaten pflegen, Einträge korrigieren und nachtragen (mit Kommentar), Perioden abschliessen, exportieren, Logins anlegen (Benutzername/Initial-Passwort) und sperren |

- Die Rechte werden **in der Datenbank** mit Row Level Security
  durchgesetzt, nicht nur im Frontend.
- Ein Admin-Konto ist kein Familien-Login. Gehört ein Admin selbst zu einer
  Hauswart-Familie, erfasst die Familie über ihr eigenes Login.
- Abgeschlossene Perioden sind für alle schreibgeschützt. Ein Admin kann eine
  Periode mit Begründung wieder öffnen (M4).

## 5. Datenmodell

- `families` – id, name, aktiv. Namen werden ausschliesslich über die
  Admin-UI in der produktiven DB erfasst (nie in Migrationen/Seeds im Repo).
- `profiles` – id (= Auth-User), family_id, username (eindeutig,
  Login-Name), name, rolle (`hauswart`/`admin`), aktiv. Pro Familie
  höchstens ein aktives Hauswart-Profil. Bei Admins ist family_id leer. Da
  Supabase Auth intern eine E-Mail-Adresse verlangt, bekommt jeder
  Hauswart-User eine interne Pseudo-Adresse (`<profile_id>@hauswart.internal`),
  die nirgends angezeigt wird; eine Edge Function löst `username` → interne
  Adresse auf, bevor der Browser direkt mit `signInWithPassword` bei Supabase
  anmeldet. Admins haben eine echte E-Mail-Adresse.
- `activities` – id, name, aktiv, sortierung, `einheit`
  (`stunden`/`franken`), `bemerkung_pflicht`, optional `nur_familien`
  (Array von family_id, NULL = für alle Familien erlaubt)
- `periods` – id, name (z.B. «2026-Q4», «2026-11», «2026»), `typ`
  (`monat`/`quartal`/`jahr`), von, bis, `stundensatz_chf` (Standard 30.00),
  status (`offen`/`abgeschlossen`), abgeschlossen_am, abgeschlossen_von
- `entries` – id, family_id, period_id, erfasst_von, datum, activity_id,
  `dauer_h` **oder** `betrag_chf`, bemerkung, admin_kommentar, created_at,
  updated_at
- `audit_log` – wer hat wann was geändert (per Trigger)

**Jahresauswertung für die GV:** kein eigenes Tabellen-Feld, sondern eine
Abfrage, die `entries` unabhängig vom gewählten Periodentyp nach Kalenderjahr
gruppiert (über `datum`, nicht über `period_id`), damit die GV im März/April
auch bei monatlicher oder vierteljährlicher Abrechnung einen korrekten
Jahresüberblick pro Familie bekommt.

**Regeln**

- Genau eines von `dauer_h` und `betrag_chf` ist gesetzt, passend zur
  Einheit der Tätigkeit.
- Dauer grösser als 0, höchstens 12 h, in 0.25er-Schritten. Betrag grösser
  als 0, auf 5 Rappen genau, Obergrenze CHF 500 als Schutz vor Tippfehlern.
- Per Trigger, weil sie vom heutigen Datum und von anderen Tabellen abhängen
  («heute» in der Zeitzone Europe/Zurich): Datum nicht in der Zukunft, Datum
  in einer offenen Periode, Tätigkeit für die Familie erlaubt. Die Periode
  (`period_id`) setzt der Trigger aus dem Datum.
- Ändert oder erfasst ein Admin einen Eintrag, ist ein Kommentar Pflicht.

**Abrechnung pro Familie und Periode**

Summe der Stunden × Stundensatz der Periode + Summe der Franken-Einträge =
Total.

## 6. Funktionen

### Hauswart-App (mobil zuerst)
- Login (Benutzername + Passwort, optional TOTP). Kein Self-Service
  «Passwort vergessen» – bei Bedarf wendet sich die Familie an den Admin.
- **Erfassen:** Datum (Standard: heute), Tätigkeit als grosse Kacheln, dann
  je nach Einheit Dauer (Schnellwahl 0.5 / 1 / 1.5 / 2 / 3 h und +/–) oder
  Betrag in Franken, Bemerkung
- **Meine Einträge:** Liste nach Periode und Monat, Summe der Stunden, der
  Auslagen und des Guthabens in Franken, Hinweis «abgeschlossen» bei alten
  Perioden
- Familie steht fest aus dem Profil, ist nicht wählbar
- Installierbar als PWA mit Icon und Splash-Screen
- Später: offline erfassen und beim nächsten Netz automatisch senden (M7)

### Admin-Bereich (Desktop und Tablet)
- **Übersicht:** Stunden, Auslagen und Total in Franken pro Familie in der
  gewählten Periode, Stunden pro Tätigkeit
- **Einträge:** Tabelle mit Filter (Familie, Tätigkeit, Zeitraum), bearbeiten
  und nachtragen mit Kommentar
- **Stammdaten:** Familien (Name, Benutzername), Logins (Initial-Passwort
  setzen, Passwort zurücksetzen, sperren, 2FA zurücksetzen), Tätigkeiten,
  Stundenansätze
- **Perioden:** Admin legt die nächste Periode mit Typ (Monat/Quartal/Jahr)
  an; sie übernimmt den Stundensatz der letzten Periode. Abschliessen
  (danach schreibgeschützt), wieder öffnen nur mit Begründung. Stundensatz
  einer offenen Periode ändern.
- **Jahresbericht für die GV:** Stunden, Auslagen und Total pro Familie über
  ein ganzes Kalenderjahr, unabhängig vom gewählten Periodentyp.
- **Export:** CSV und Excel, PDF-Abrechnung pro Familie und
  PDF-Jahresbericht für die GV
- **Audit-Log** ansehen

### Ablauf Periodenabschluss
1. Nach Periodenende haben die Familien noch 30 Tage Zeit für Nachträge.
   Solange bleibt die alte Periode offen, die neue ist schon erfassbar.
2. Der Verwalter prüft die Übersicht und korrigiert Auffälliges mit
   Kommentar.
3. Er schliesst die Periode ab und exportiert die Abrechnungen.

### Ablauf GV-Jahresauswertung (März/April)
1. Verwalter öffnet den Jahresbericht für das abgelaufene Kalenderjahr.
2. Prüft Summen pro Familie (Stunden, Auslagen, Total), exportiert als PDF
   für die GV-Unterlagen.
3. Der Bericht funktioniert unabhängig davon, ob im Jahr monatlich,
   vierteljährlich oder jährlich abgerechnet wurde.

## 7. Sicherheit

- Selbstregistrierung in Supabase abschalten, Logins nur durch den Admin
  angelegt (Benutzername + Initial-Passwort, kein Self-Signup)
- Kein Self-Service «Passwort vergessen» für Hauswarte; nur der Admin kann
  ein neues Passwort setzen (Edge Function mit service_role, prüft ab M4
  aal2)
- Passwortregeln (mindestens 12 Zeichen), Schutz vor geleakten Passwörtern
  einschalten, falls im Plan verfügbar
- 2FA mit TOTP; für `admin` erzwungen ab M4 (AAL2 in den RLS-Policies und in
  den Edge Functions prüfen)
- Zwei Admins: Verliert einer sein Gerät, setzt der andere dessen 2FA zurück
- `service_role`-Key (bei neuen Projekten «secret key») nie im Frontend. Er
  liegt nur in den Edge Functions
- **Keine Selbstbeförderung:** Ein Benutzer darf im eigenen Profil weder
  `rolle` noch `family_id` noch `username` noch `aktiv` ändern. Rolle und
  Familie werden in den Policies über `security definer`-Funktionen gelesen,
  sonst rufen sich die Policies auf `profiles` gegenseitig auf.
- Gesperrte Benutzer (`aktiv = false`) verlieren den Zugriff auch mit noch
  gültiger Sitzung
- RLS-Policies mit automatischen Tests abdecken
- Content Security Policy als `<meta>`-Tag (GitHub Pages erlaubt keine
  eigenen HTTP-Header) und keine Fremd-Skripte
- Test-Benutzer aus den Seed-Daten existieren nur lokal, nie in der
  produktiven Datenbank

## 8. Technik

- **Frontend:** Vite, React, TypeScript, Tailwind CSS, `vite-plugin-pwa`,
  `@supabase/supabase-js`, React Router mit Hash-Routing wegen GitHub Pages
- **Login per Benutzername:** Edge Function löst `username` → interne
  Pseudo-E-Mail auf (öffentlich erreichbar, rate-limited, keine Auskunft, ob
  ein Benutzername existiert), danach `signInWithPassword` direkt im Browser
  gegen Supabase.
- **Backend:** Supabase mit SQL-Migrationen im Repo (`supabase/migrations`,
  ohne echte Namen), Supabase CLI für lokale Entwicklung, Edge Functions für
  Login-Auflösung, Passwort setzen/zurücksetzen, Sperren und 2FA-Reset
- **Tests:** Vitest (Logik), SQL-Tests (RLS und Trigger), Playwright
  (Hauptabläufe, ab M2)
- **CI/CD:** GitHub Actions → Build und Deploy auf GitHub Pages; Migrationen
  bewusst manuell
- **Sprache:** Oberfläche Deutsch (Schweiz), Datum `TT.MM.JJJJ`, Beträge als
  `CHF 1'234.50`, bei Stunden und Beträgen Punkt und Komma als
  Dezimaltrennzeichen akzeptieren

## 9. Meilensteine

| # | Inhalt | Ergebnis |
|---|---|---|
| M0 | Projektgerüst, PWA, GitHub Action, Konten-Setup | Leere App ist online |
| M1 | Datenmodell, RLS, Trigger, Seed-Daten, Login mit Benutzername, erste Admins | Anmelden geht, Rechte stimmen |
| M2 | Hauswart-App: Stunden und Auslagen erfassen, eigene Einträge, PWA | Testfamilie kann echt erfassen |
| M3 | Admin: Übersicht, Einträge, Stammdaten, Logins | Verwalter kann arbeiten |
| M4 | 2FA (TOTP), Periodenabschluss, Audit-Log | Sicherheitsniveau erreicht |
| M5 | Export (CSV, Excel), PDF-Abrechnung, PDF-Jahresbericht für die GV | Abrechnung ohne Sheet |
| M6 | Migration der Google-Forms-Daten, Keep-alive, Backup | Produktiv |
| M7 (optional) | Offline-Erfassung, Erinnerung vor Periodenabschluss | Komfort |

Nach jedem Meilenstein selbst auf Android **und** iPhone testen.

## 10. Migration und Einführung

1. Antworten aus dem Google-Sheet als CSV exportieren.
2. Das Import-Skript legt die vergangenen Perioden (Typ Quartal, wie bisher
   abgerechnet) an, ordnet Familie und Tätigkeit zu und meldet nicht
   zuordenbare Zeilen. Alle alten Perioden bekommen den Satz CHF 30.–.
3. Bereits abgerechnete Perioden nach dem Import abschliessen.
4. Admin legt für jede Familie Benutzername und Initial-Passwort an und
   teilt es persönlich mit (kein Mailversand).
5. Eine Familie testet zwei Wochen lang parallel zum Formular.
6. Kurzanleitung (docs/ANLEITUNG.md) für die Familien.
7. Stichtag auf einen Periodenanfang legen, ab dann Formular schliessen.

**Später: Wechsel auf eine eigene Domain**

1. DNS-Eintrag (CNAME) auf `defendeggu.github.io` setzen und die Domain in
   den Pages-Einstellungen eintragen.
2. Basis-Pfad der App von `/hauswart-app/` auf `/` umstellen (Variable
   `VITE_BASE_PATH`).
3. In Supabase «Site URL» und die erlaubten Redirect-Adressen anpassen.
4. Die Familien müssen die App neu auf den Startbildschirm legen und sich
   einmal neu anmelden.
