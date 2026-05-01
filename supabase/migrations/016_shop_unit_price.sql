alter table if exists printful_products
  add column if not exists shop_unit_price_cents integer null;

comment on column printful_products.shop_unit_price_cents is
  'Optional flat shop unit price in cents for all variants/colors (overrides markup when set).';
