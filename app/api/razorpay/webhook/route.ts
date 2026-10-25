import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Razorpay webhook.
 *
 * This endpoint is public — Razorpay's servers have to reach it, so it cannot
 * sit behind auth. That means the signature is the ONLY thing separating
 * Razorpay from anyone else who finds the URL. Without verification, a single
 * curl with {"event":"payment.captured"} marks any booking paid.
 *
 * Three things this handler is careful about:
 *
 *   1. It reads the RAW body and verifies against those exact bytes. Parsing
 *      first and re-serialising would change key order and whitespace, and the
 *      HMAC is over bytes, not meaning.
 *   2. It verifies BEFORE parsing or touching the database, so an unsigned
 *      payload never reaches application logic.
 *   3. It is idempotent. Razorpay retries on non-2xx and can deliver the same
 *      event more than once; confirm_booking_payment returns
 *      'already_confirmed' rather than erroring or double-confirming.
 *
 * It answers 200 to anything it has safely handled, including events it
 * ignores — a non-2xx tells Razorpay to retry, and retrying an event we
 * deliberately skipped achieves nothing but noise.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not set; refusing to trust webhooks");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    // Deliberately terse. Telling a prober why verification failed helps them.
    console.warn("razorpay webhook: signature rejected");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string } };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  // Only a captured payment confirms a booking. 'payment.authorized' means the
  // money is held but not taken, and confirming on it would hand out
  // appointments for payments that may never settle.
  if (event.event !== "payment.captured") {
    return NextResponse.json({ ignored: event.event ?? "unknown" }, { status: 200 });
  }

  const payment = event.payload?.payment?.entity;
  const orderId = payment?.order_id;
  const paymentId = payment?.id;

  if (!orderId || !paymentId) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  // confirm_booking_payment is granted to service_role only. An anonymous
  // caller cannot reach it even with a valid publishable key, so forging a
  // confirmation requires the webhook secret, which never leaves the server.
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("confirm_booking_payment", {
    p_order_id: orderId,
    p_payment_id: paymentId,
  });

  if (error) {
    console.error("confirm_booking_payment failed", error);
    // 500 so Razorpay retries — this is a genuine failure on our side, and the
    // customer has paid.
    return NextResponse.json({ error: "Could not confirm booking." }, { status: 500 });
  }

  const result = data as { status: string; id?: string };

  if (result.status === "not_pending" || result.status === "unknown_order") {
    // The customer paid but there is no live booking to attach it to: the hold
    // expired, or the owner cancelled. This needs a human and a refund, so it
    // is logged loudly rather than swallowed. 200, because retrying will not
    // change the outcome.
    console.error("razorpay webhook: paid with no matching pending booking", {
      orderId,
      paymentId,
      result,
    });
  }

  return NextResponse.json(result, { status: 200 });
}

export const dynamic = "force-dynamic";
