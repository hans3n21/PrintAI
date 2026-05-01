alter table if exists pricing_settings
  add column if not exists shop_prices_include_shipping boolean not null default false;

comment on column pricing_settings.shop_prices_include_shipping is
  'If true: customer-facing unit price includes shipping — no separate shipping line in checkout/configure totals. Admin margin logic still uses configured shipping_rates.';
