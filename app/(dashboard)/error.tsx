"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this is where a real project wires up Sentry or similar.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        That didn&apos;t load
      </h1>
      <p className="mt-3 text-sm text-muted">
        Something went wrong fetching your data. It may be temporary.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
        >
          Back to overview
        </a>
      </div>
    </div>
  );
}
