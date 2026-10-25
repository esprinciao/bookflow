-- Services store price_cents but nothing recorded which currency those cents
-- are in, so the dashboard would have to hardcode a symbol — showing dollars
-- to a clinic in Asia/Kolkata. Stripe also requires an explicit currency per
-- charge, so this is needed in Phase 6 regardless.

alter table public.businesses
  add column currency text not null default 'USD'
    check (currency ~ '^[A-Z]{3}$');

comment on column public.businesses.currency is
  'ISO 4217, uppercase. Note for Phase 6: most currencies are two-decimal, so '
  'price_cents/100 is the amount — but zero-decimal currencies (JPY, KRW) and '
  'three-decimal ones (KWD, BHD) are not. Stripe expects the smallest unit, '
  'which is what price_cents already holds; only the *display* divisor varies.';
