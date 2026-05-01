create table if not exists pricing_settings (
  id text primary key default 'default',
  markup_percent numeric not null default 50,
  markup_fixed_cents integer not null default 0,
  currency text not null default 'eur',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_settings_singleton check (id = 'default'),
  constraint pricing_settings_markup_percent_nonnegative check (markup_percent >= 0),
  constraint pricing_settings_markup_fixed_nonnegative check (markup_fixed_cents >= 0)
);

insert into pricing_settings (id, markup_percent, markup_fixed_cents, currency)
values ('default', 50, 0, 'eur')
on conflict (id) do nothing;

create table if not exists shipping_rates (
  country_code text primary key,
  label text not null,
  amount_cents integer not null,
  free_from_cents integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_rates_country_code_upper check (country_code = upper(country_code)),
  constraint shipping_rates_amount_nonnegative check (amount_cents >= 0),
  constraint shipping_rates_free_from_nonnegative check (free_from_cents is null or free_from_cents >= 0)
);

insert into shipping_rates (country_code, label, amount_cents, free_from_cents, enabled)
values
  ('DE', 'Deutschland', 499, 7500, true),
  ('AT', 'Österreich', 799, 10000, true),
  ('CH', 'Schweiz', 1499, null, true),
  ('US', 'USA', 1499, null, true)
on conflict (country_code) do nothing;

alter table pricing_settings enable row level security;
alter table shipping_rates enable row level security;

drop policy if exists "Public read pricing settings" on pricing_settings;
create policy "Public read pricing settings"
  on pricing_settings for select
  using (true);

drop policy if exists "Public read shipping rates" on shipping_rates;
create policy "Public read shipping rates"
  on shipping_rates for select
  using (enabled = true);
