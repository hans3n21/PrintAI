alter table if exists orders
  add column if not exists printful_order_id bigint;

create index if not exists orders_printful_order_id_idx
  on orders(printful_order_id);
