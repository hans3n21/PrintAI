alter table if exists orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists customer_email text,
  add column if not exists paid_at timestamptz;

create unique index if not exists orders_stripe_checkout_session_id_idx
  on orders(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists orders_stripe_payment_intent_id_idx
  on orders(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table if exists sessions
  drop constraint if exists sessions_status_check;

alter table if exists sessions
  add constraint sessions_status_check
  check (
    status in (
      'onboarding',
      'generating',
      'designing',
      'placing',
      'configuring',
      'checkout',
      'pending_payment',
      'ordered'
    )
  );
