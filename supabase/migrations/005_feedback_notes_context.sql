alter table if exists feedback_notes
  add column if not exists session_id uuid references sessions(id) on delete set null,
  add column if not exists target_type text not null default 'page',
  add column if not exists target_ref text,
  add column if not exists assistant_output text,
  add column if not exists conversation_snapshot jsonb,
  add column if not exists design_urls_snapshot text[],
  add column if not exists client_state jsonb;

create index if not exists feedback_notes_session_id_idx
  on feedback_notes(session_id);

create index if not exists feedback_notes_target_type_idx
  on feedback_notes(target_type);
