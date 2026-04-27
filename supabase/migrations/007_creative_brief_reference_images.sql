alter table if exists sessions
  add column if not exists creative_brief jsonb,
  add column if not exists creative_brief_url text,
  add column if not exists reference_images jsonb default '[]'::jsonb;
