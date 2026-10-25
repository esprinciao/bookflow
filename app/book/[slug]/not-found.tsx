import Link from "next/link";

export default function BookingNotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        No booking page here
      </h1>
      <p className="mt-3 text-muted">
        This link may be mistyped, or the business may have changed its address.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
      >
        Go to BookFlow
      </Link>
    </main>
  );
}
