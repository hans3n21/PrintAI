alter table if exists feedback_notes
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_at timestamptz;
