-- Einfache Rate-Limit-Tabelle für die Edge Function "resolve-login-email"
-- (öffentlich erreichbar, löst username -> interne E-Mail auf). RLS ist
-- aktiv und hat bewusst keine einzige Policy: weder anon noch authenticated
-- können diese Tabelle lesen oder schreiben. Nur service_role (die Edge
-- Function) kommt heran, weil service_role RLS grundsätzlich umgeht.

create table public.login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  versucht_am timestamptz not null default now()
);

create index login_attempts_username_zeit_idx
  on public.login_attempts (lower(username), versucht_am desc);

alter table public.login_attempts enable row level security;
