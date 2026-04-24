create table if not exists feedback_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  page_path text not null,
  note text not null,
  screenshot_url text
);

alter table feedback_notes enable row level security;

drop policy if exists "MVP notes select" on feedback_notes;
create policy "MVP notes select"
on feedback_notes for select
using (true);

drop policy if exists "MVP notes insert" on feedback_notes;
create policy "MVP notes insert"
on feedback_notes for insert
with check (true);
