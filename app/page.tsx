import Link from "next/link";

const features = [
  {
    title: "Services and staff",
    body: "Define what you offer, how long it takes, what it costs, and who delivers it. Buffers between appointments are respected automatically.",
  },
  {
    title: "Weekly availability",
    body: "Set the hours you work once. Block out time off when plans change. Slots are generated from the rules, never hand-maintained.",
  },
  {
    title: "A public booking link",
    body: "Share one URL. Customers pick a service, pick a slot, and confirm — no account, no app, no phone tag.",
  },
  {
    title: "Deposits up front",
    body: "Collect a deposit through Stripe at the moment of booking, so a no-show costs the customer something too.",
  },
];

export default function Home() {
  return (
    <>
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">BookFlow</span>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
          <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            For salons, clinics, tutors and consultants
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Stop booking appointments over text message.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted text-pretty">
            BookFlow gives your business a booking page your customers can use
            themselves. You set the services and the hours. It handles the
            calendar, the deposits, and the double-bookings.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-5 py-3 text-center text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover"
            >
              Create your booking page
            </Link>
            <Link
              href="/book/demo"
              className="rounded-lg border border-border px-5 py-3 text-center text-sm font-medium transition-colors hover:bg-surface"
            >
              See a live example
            </Link>
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title}>
                  <h2 className="text-base font-semibold">{feature.title}</h2>
                  <p className="mt-2 leading-relaxed text-muted text-pretty">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            Two people cannot book the same slot.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted text-pretty">
            Most booking tools check whether a slot is free and then write the
            booking. Under load those are two separate steps, and two customers
            can both pass the check before either one writes. BookFlow enforces
            it in Postgres with an exclusion constraint instead, so overlapping
            appointments for the same staff member are impossible at the
            database level — not merely unlikely.
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>BookFlow</span>
          <span>A portfolio project. Payments run in Stripe test mode.</span>
        </div>
      </footer>
    </>
  );
}
