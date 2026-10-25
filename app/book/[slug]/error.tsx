"use client";

import { Button } from "@/components/ui/button";

export default function BookingError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        We couldn&apos;t load the booking page
      </h1>
      <p className="mt-3 text-sm text-muted">
        This is usually temporary. Try again in a moment.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </main>
  );
}
