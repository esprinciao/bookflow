import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay integration.
 *
 * Two different signatures appear in this flow and they are not
 * interchangeable:
 *
 *   - The CHECKOUT signature comes back to the browser when the modal closes.
 *     It is HMAC-SHA256 of "<order_id>|<payment_id>" keyed with the API key
 *     secret. It proves the handler payload wasn't tampered with in the
 *     browser — but it arrives via the customer's device, so it is a
 *     convenience, never an authority.
 *
 *   - The WEBHOOK signature arrives server-to-server on the raw request body,
 *     keyed with the webhook secret. This is the one that confirms a booking.
 *
 * Skipping webhook verification means anyone who finds the endpoint can POST
 * {"event":"payment.captured"} and mark bookings paid. The endpoint is public
 * by necessity — Razorpay has to reach it — so the signature is the only thing
 * distinguishing Razorpay from everyone else on the internet.
 */

const API = "https://api.razorpay.com/v1";

function credentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured: set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }
  return { keyId, keySecret };
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** `amount` is in the currency's smallest unit, matching how we store money. */
export async function createOrder(options: {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const { keyId, keySecret } = credentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: options.amount,
      currency: options.currency,
      receipt: options.receipt.slice(0, 40), // Razorpay caps receipt length
      notes: options.notes,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Razorpay order failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as RazorpayOrder;
}

/**
 * Constant-time comparison of two hex digests.
 *
 * `===` on strings short-circuits at the first differing byte, so how long the
 * comparison takes leaks how much of the prefix was correct. That is enough to
 * recover a signature byte by byte given enough attempts.
 */
function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verifies the signature Razorpay sends with a webhook, over the RAW body. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return signaturesMatch(expected, signature);
}

/** Verifies the signature returned to the browser when Checkout succeeds. */
export function verifyCheckoutSignature(options: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = createHmac("sha256", options.keySecret)
    .update(`${options.orderId}|${options.paymentId}`)
    .digest("hex");
  return signaturesMatch(expected, options.signature);
}
