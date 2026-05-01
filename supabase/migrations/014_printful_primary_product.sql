alter table if exists printful_products
  add column if not exists is_primary boolean not null default false;

create unique index if not exists printful_products_single_primary_idx
  on printful_products(is_primary)
  where is_primary = true;

comment on column printful_products.is_primary is
  'Admin-selected default product used by the customer flow when a session has no explicit Printful product.';
