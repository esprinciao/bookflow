"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";

type PaymentHandoff = {
  provider: string;
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
};

type Phase =
  | { name: "form" }
  | { name: "paying" }
  | { name: "confirming"; reference: string }
  | { name: "done"; reference: string }
  | { name: "needsFollowUp"; reference: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment form."));
    document.body.appendChild(script);
  });
}

/**
 * Waits for the webhook to confirm the booking.
 *
 * The browser knows the customer paid, but a booking is only confirmed by the
 * server-to-server webhook — a client-side "payment succeeded" is a claim from
 * an untrusted device, not a fact. So we poll for the real status rather than
 * asserting success from the checkout callback.
 */
async function waitForConfirmation(bookingId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 800 : 1500));
    try {
      const response = await fetch(`/api/bookings/status?id=${bookingId}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (body.status === "confirmed") return true;
      if (body.status === "cancelled") return false;
    } catch {
      // Keep polling; a dropped request is not a verdict.
    }
  }
  return false;
}

export function ConfirmForm({
  slug,
  serviceId,
  staffId,
  startsAt,
  backHref,
  depositCents,
  currency,
}: {
  slug: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  backHref: string;
  depositCents: number;
  currency: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "form" });

  async function openCheckout(
    payment: PaymentHandoff,
    bookingId: string,
    customerName: string,
    customerEmail: string,
  ) {
    await loadCheckoutScript();
    if (!window.Razorpay) throw new Error("Payment form unavailable.");

    return new Promise<void>((resolve) => {
      const checkout = new window.Razorpay!({
        key: payment.keyId,
        order_id: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        name: "BookFlow",
        description: "Appointment deposit",
        prefill: { name: customerName, email: customerEmail },
        theme: { color: "#4f46e5" },
        handler: async () => {
          // Deliberately does NOT mark the booking confirmed. This callback
          // runs on the customer's device and could be fabricated; the webhook
          // is the authority. All we do here is start watching for it.
          setPhase({ name: "confirming", reference: bookingId.slice(0, 8) });
          const confirmed = await waitForConfirmation(bookingId);
          const reference = bookingId.slice(0, 8);
          // Written as two branches rather than a ternary on `name`: the
          // ternary widens to "done" | "needsFollowUp" and stops the union
          // discriminating.
          if (confirmed) {
            setPhase({ name: "done", reference });
          } else {
            setPhase({ name: "needsFollowUp", reference });
          }
          resolve();
        },
        modal: {
          ondismiss: () => {
            setError(
              "Payment cancelled. Your slot is held for 15 minutes if you want to try again.",
            );
            setPhase({ name: "form" });
            resolve();
          },
        },
      });
      checkout.open();
    });
  }

  async function submit(formData: FormData) {
    setError(null);
    setPhase({ name: "paying" });

    const customerName = String(formData.get("customer_name") ?? "");
    const customerEmail = String(formData.get("customer_email") ?? "");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, serviceId, staffId, startsAt, customerName, customerEmail,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        setPhase({ name: "form" });
        return;
      }

      const bookingId = String(body.booking?.id ?? "");

      if (body.payment) {
        await openCheckout(body.payment, bookingId, customerName, customerEmail);
        return;
      }

      setPhase({ name: "done", reference: bookingId.slice(0, 8) });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setPhase({ name: "form" });
    }
  }

  if (phase.name === "confirming") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Payment received</h2>
        <p className="mt-2 text-sm text-muted">
          Confirming your appointment…
        </p>
      </div>
    );
  }

  if (phase.name === "done") {
    return (
      <div className="rounded-xl border border-brand bg-brand-soft p-6">
        <h2 className="text-lg font-semibold">You&apos;re booked</h2>
        <p className="mt-2 text-sm">
          We&apos;ve saved your appointment. Reference{" "}
          <span className="font-mono font-medium">{phase.reference}</span>.
        </p>
      </div>
    );
  }

  if (phase.name === "needsFollowUp") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">We&apos;re still confirming</h2>
        <p className="mt-2 text-sm text-muted">
          Your payment went through, but confirmation is taking longer than
          usual. Reference{" "}
          <span className="font-mono font-medium">{phase.reference}</span> —
          quote it if you need to get in touch. Nothing further is needed from
          you.
        </p>
      </div>
    );
  }

  const paying = phase.name === "paying";

  return (
    <form action={submit} className="space-y-4">
      <FormError>{error}</FormError>
      {depositCents > 0 && (
        <p className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
          A deposit of{" "}
          <span className="font-medium">{formatMoney(depositCents, currency)}</span>{" "}
          is taken now. The balance is paid at your appointment.
        </p>
      )}
      <Field label="Your name">
        <Input name="customer_name" required autoComplete="name" placeholder="Priya Sharma" />
      </Field>
      <Field label="Your email" hint="So we can send you the details.">
        <Input
          name="customer_email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
        />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={paying} className="sm:flex-1">
          {paying
            ? "Just a moment…"
            : depositCents > 0
              ? `Pay ${formatMoney(depositCents, currency)} and book`
              : "Confirm booking"}
        </Button>
        <a
          href={backHref}
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
        >
          Pick another time
        </a>
      </div>
    </form>
  );
}
