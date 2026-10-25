# BookFlow

A multi-tenant appointment booking SaaS for small service businesses — salons,
clinics, tutors, consultants.

Business owners sign up, define their services, team and weekly availability,
and get a public booking page. Customers book without creating an account. The
owner sees everything on a dashboard.

**Live:** https://bookflow-prince-s-org.vercel.app
**Try the booking flow:** https://bookflow-prince-s-org.vercel.app/book/demo

**Demo dashboard login**
`demo@bookflow.example` / `demo-booking-2026`

The demo studio is in `Europe/London` and prices in GBP, deliberately different
from wherever you are — the whole app converts for display. If the demo data
gets messy, `psql "$SUPABASE_DB_URL" -f supabase/seed-demo.sql` restores it.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database & auth | Supabase (Postgres, row-level security) |
| Payments | Razorpay Checkout, test mode |
| Tests | Vitest |
| Hosting | Vercel |

## The three decisions worth explaining

### 1. Double-booking is prevented by Postgres, not by application code

```sql
ALTER TABLE bookings ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed');
```

"Check whether the slot is free, then write the booking" is two steps. Two
customers tapping *Book* at the same moment can both pass the check before
either one writes, and you end up with two confirmed appointments in one chair.
No amount of application-level checking closes that window, because the gap
between the check and the write *is* the window.

An exclusion constraint makes the write itself the check. The second request
fails with SQLSTATE `23P01`, which the API turns into *"that slot was taken a
moment before you confirmed."*

**This was measured, not assumed.** Ten simultaneous requests for one free slot:
one succeeded, nine were rejected, one row in Postgres. Eight were caught by the
application-level availability re-check — and **one was not**, and was stopped
only by the constraint.

The constraint is partial, covering only `confirmed` rows, which is why
cancelling frees the slot immediately with no separate release step.

`supabase/tests/no_double_booking_test.sql` proves the behaviour against a real
database inside a transaction that rolls back.

### 2. Multi-tenant isolation lives in the database

Every table has row-level security with owner-scoped policies and denies by
default. Tenants cannot read or write each other's rows even if a query forgets
its `WHERE` clause.

The public booking page does **not** get relaxed policies. It reads through
three `SECURITY DEFINER` functions that return exactly what a stranger may see.
An anonymous visitor learns that a staff member is busy between two instants —
never who with, and never why someone is away. `bookings` holds customer names
and email addresses, and those tables stay shut.

### 3. A webhook signature is not optional

Deposits are taken through Razorpay (Stripe is invite-only in India). The
booking is created as `pending`, holds its slot, and becomes `confirmed` only
when Razorpay's server-to-server webhook arrives and its signature verifies.

The endpoint is public by necessity — Razorpay has to reach it — so the
signature is the only thing separating Razorpay from anyone else who finds the
URL. Without it, one `curl` posting `{"event":"payment.captured"}` marks any
booking paid.

Three details that matter:

- The **raw body** is verified, not a parsed-and-re-serialised object. The HMAC
  is over bytes, and `JSON.parse` + `JSON.stringify` can change key order and
  whitespace. There's a test for exactly this.
- Verification happens **before** parsing or touching the database.
- It is **idempotent**. Webhooks retry; a repeat delivery returns
  `already_confirmed` rather than erroring or double-confirming.

The checkout callback running in the customer's browser deliberately does *not*
confirm anything — it polls for the status the webhook sets. A client-side
"payment succeeded" is a claim from an untrusted device.

`confirm_booking_payment` is granted to `service_role` only. If anonymous
callers could reach it, payment would be decorative.

### 4. Wall-clock time and instants are different things

Weekly hours are stored as `time` (a wall-clock reading); bookings as
`timestamptz` (an absolute instant). "I work 9–5 on Tuesdays" stays true across
a daylight-saving change; a specific appointment does not move.

Converting between them is not a total function, and both failure modes are
handled in `lib/time.ts`:

- **Skipped.** `01:30` on 2026-03-29 in `Europe/London` never occurs — the clock
  jumps `00:59 GMT` to `02:00 BST`. No slot is offered.
- **Ambiguous.** `01:30` on 2026-10-25 occurs twice. The earlier is used, as
  iCalendar does.

Slot generation lives in `lib/availability.ts` as a **pure function** — all
inputs are arguments, no database client, no clock it wasn't given. That is what
makes the awkward cases testable without a browser.

## Running locally

```bash
npm install
cp .env.example .env.local     # fill in your own keys
./scripts/migrate.sh           # apply migrations
npm run dev
```

```bash
npm test          # vitest
npm run lint
npm run build
```

`scripts/migrate.sh` applies `supabase/migrations/*.sql` once each, one
transaction per file, tracked in a `schema_migrations` table. Re-running is a
no-op.

## Environment

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security
entirely: server-side only, never prefixed `NEXT_PUBLIC_`, never imported into a
Client Component.

## Build status

- [x] Phase 1 — Scaffold, Supabase clients, landing page, deploy
- [x] Phase 2 — Authentication
- [x] Phase 3 — Services and staff CRUD, row-level security
- [x] Phase 4 — Availability engine
- [x] Phase 5 — Public booking page
- [x] Phase 6 — Deposits (Razorpay)
- [x] Phase 7 — Owner dashboard and polish

---

Self-initiated portfolio project.
