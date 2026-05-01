create table if not exists printful_product_colors (
  id uuid primary key default gen_random_uuid(),
  printful_product_id integer not null references printful_products(printful_product_id) on delete cascade,
  color_name text not null,
  color_slug text not null,
  color_hex text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (printful_product_id, color_slug)
);

create table if not exists printful_product_color_assets (
  id uuid primary key default gen_random_uuid(),
  printful_product_id integer not null references printful_products(printful_product_id) on delete cascade,
  color_slug text not null,
  placement text not null,
  source text not null default 'printful' check (source in ('printful', 'manual')),
  mockup_style_id integer,
  image_url text not null,
  background_color text,
  is_preferred boolean not null default false,
  template_width integer,
  template_height integer,
  print_area_left integer,
  print_area_top integer,
  print_area_width integer,
  print_area_height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (printful_product_id, color_slug, placement, source, image_url)
);

create unique index if not exists printful_product_color_assets_one_preferred_idx
  on printful_product_color_assets(printful_product_id, color_slug, placement)
  where is_preferred = true;

create index if not exists printful_product_colors_product_idx
  on printful_product_colors(printful_product_id, is_active);

create index if not exists printful_product_color_assets_lookup_idx
  on printful_product_color_assets(printful_product_id, color_slug, placement, is_preferred);

create or replace function set_printful_product_colors_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_printful_product_colors_updated_at on printful_product_colors;
create trigger set_printful_product_colors_updated_at
  before update on printful_product_colors
  for each row
  execute function set_printful_product_colors_updated_at();

create or replace function set_printful_product_color_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_printful_product_color_assets_updated_at on printful_product_color_assets;
create trigger set_printful_product_color_assets_updated_at
  before update on printful_product_color_assets
  for each row
  execute function set_printful_product_color_assets_updated_at();

alter table printful_product_colors enable row level security;
alter table printful_product_color_assets enable row level security;

drop policy if exists "Public read active printful product colors" on printful_product_colors;
create policy "Public read active printful product colors"
  on printful_product_colors for select
  using (
    is_active = true and exists (
      select 1 from printful_products p
      where p.printful_product_id = printful_product_colors.printful_product_id
        and p.is_active = true
    )
  );

drop policy if exists "Public read active printful product color assets" on printful_product_color_assets;
create policy "Public read active printful product color assets"
  on printful_product_color_assets for select
  using (
    exists (
      select 1 from printful_products p
      where p.printful_product_id = printful_product_color_assets.printful_product_id
        and p.is_active = true
    )
  );

drop policy if exists "Service role manage printful product colors" on printful_product_colors;
create policy "Service role manage printful product colors"
  on printful_product_colors for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manage printful product color assets" on printful_product_color_assets;
create policy "Service role manage printful product color assets"
  on printful_product_color_assets for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
