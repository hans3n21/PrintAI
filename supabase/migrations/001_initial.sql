create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  conversation_history jsonb default '[]'::jsonb,
  onboarding_data jsonb,
  prompt_data jsonb,
  design_urls text[] default '{}',
  slogans jsonb default '[]'::jsonb,
  selected_design_url text,
  selected_slogan jsonb,
  config jsonb default '{}'::jsonb,
  status text default 'onboarding' check (status in ('onboarding', 'generating', 'designing', 'configuring', 'checkout', 'ordered'))
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  created_at timestamptz default now(),
  status text default 'stub',
  total_cents integer,
  line_items jsonb
);

insert into storage.buckets (id, name, public)
values ('designs', 'designs', true)
on conflict do nothing;

create policy "Public read designs"
on storage.objects for select
using (bucket_id = 'designs');

create policy "Service role write designs"
on storage.objects for insert
with check (bucket_id = 'designs');
