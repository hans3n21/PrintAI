alter table if exists sessions
  add column if not exists product_selection jsonb,
  add column if not exists design_assets jsonb default '[]'::jsonb;

alter table if exists feedback_notes
  add column if not exists category text not null default 'general',
  add column if not exists tags text[] default '{}';

create index if not exists feedback_notes_category_idx
  on feedback_notes(category);
