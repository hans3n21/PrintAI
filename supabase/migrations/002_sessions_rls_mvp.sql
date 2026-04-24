-- MVP: Browser nutzt anon-Key und kennt nur die session-UUID aus der URL.
-- Ohne Policies blockiert RLS alle Zugriffe -> Designs/Configure haengen oder sind leer.
-- Vor Produktion durch echte Auth + restriktive Policies ersetzen.

alter table sessions enable row level security;

drop policy if exists "mvp_sessions_select" on sessions;
create policy "mvp_sessions_select"
  on sessions for select
  using (true);

drop policy if exists "mvp_sessions_update" on sessions;
create policy "mvp_sessions_update"
  on sessions for update
  using (true)
  with check (true);
