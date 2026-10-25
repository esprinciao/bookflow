# BookFlow

A multi-tenant appointment booking SaaS for small service businesses — salons,
clinics, tutors, consultants.

Business owners sign up, define their services and weekly availability, and get
a public booking page. Customers book slots without creating an account. The
owner sees everything on a dashboard.

**Live demo:** _not deployed yet_
**Demo booking page:** _not deployed yet_

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database & auth | Supabase (Postgres, row-level security) |
| Payments | Stripe Checkout (test mode) |
| Hosting | Vercel |

## The interesting decision

Double-booking is prevented by a Postgres **exclusion constraint**, not by
application-level checks:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed');
```

"Check whether the slot is free, then write the booking" is two steps. Two
customers clicking *Book* on the same slot at the same moment can both pass the
check before either one writes, and you end up with two confirmed appointments
in one chair. No amount of application-level checking fixes that, because the
gap between the check and the write is where the race lives.

The exclusion constraint moves the guarantee into the database, where the write
itself is the check. The second request fails with a constraint violation, which
the API catches and turns into a friendly *"that slot was just taken"* message.

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in your own keys
npm run dev
```

Open http://localhost:3000.

## Environment variables

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security
entirely — it is server-only, must never carry a `NEXT_PUBLIC_` prefix, and must
never be imported into a Client Component.

## Build status

- [x] Phase 1 — Scaffold, Supabase clients, landing page, deploy
- [x] Phase 2 — Authentication
- [x] Phase 3 — Services and staff CRUD, row-level security
- [x] Phase 4 — Availability engine
- [x] Phase 5 — Public booking page
- [ ] Phase 6 — Stripe deposits
- [ ] Phase 7 — Owner dashboard and polish

---

Self-initiated portfolio project.
