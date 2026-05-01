create table if not exists printful_products (
  id uuid primary key default gen_random_uuid(),
  printful_product_id integer not null,
  title text not null,
  slug text not null,
  technique text,
  placements jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  print_area jsonb not null default '{}'::jsonb,
  mockup_templates jsonb not null default '[]'::jsonb,
  is_active boolean not null default false,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column printful_products.variants is
  'Array entries: {variant_id, size, color, color_hex, price_cents, stock}.';

comment on column printful_products.print_area is
  'Print-file pixel dimensions: {placement, area_width, area_height}.';

create unique index if not exists printful_products_printful_product_id_idx
  on printful_products(printful_product_id);

create unique index if not exists printful_products_slug_idx
  on printful_products(slug);

create index if not exists printful_products_active_sort_idx
  on printful_products(is_active, sort_order);

create or replace function set_printful_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_printful_products_updated_at on printful_products;
create trigger set_printful_products_updated_at
  before update on printful_products
  for each row
  execute function set_printful_products_updated_at();

alter table printful_products enable row level security;

drop policy if exists "Public read active printful products" on printful_products;
create policy "Public read active printful products"
  on printful_products for select
  using (is_active = true);

drop policy if exists "Service role insert printful products" on printful_products;
create policy "Service role insert printful products"
  on printful_products for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Service role update printful products" on printful_products;
create policy "Service role update printful products"
  on printful_products for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role delete printful products" on printful_products;
create policy "Service role delete printful products"
  on printful_products for delete
  using (auth.role() = 'service_role');
