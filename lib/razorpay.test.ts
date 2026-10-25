import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay";

const SECRET = "whsec_test_secret";
const sign = (payload: string, secret = SECRET) =>
  createHmac("sha256", secret).update(payload).digest("hex");

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_123", order_id: "order_123" } } },
  });

  it("accepts a correctly signed body", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a missing signature", () => {
    // The whole attack: POST a fake payment.captured with no signature at all.
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, "", SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyWebhookSignature(body, sign(body, "not-the-secret"), SECRET)).toBe(false);
  });

  it("rejects a body altered after signing", () => {
    // Signature is valid for the ORIGINAL body. Swap the order id — as an
    // attacker replaying a real webhook against someone else's booking would —
    // and it must fail.
    const signature = sign(body);
    const tampered = body.replace("order_123", "order_victim");
    expect(verifyWebhookSignature(tampered, signature, SECRET)).toBe(false);
  });

  it("rejects a body that is byte-identical except for whitespace", () => {
    // Why the RAW body must be verified, not a re-serialised object.
    // JSON.parse + JSON.stringify can change key order and spacing, and the
    // signature is over bytes.
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyWebhookSignature(reserialised, sign(body), SECRET)).toBe(false);
  });

  it("rejects signatures of the wrong length without throwing", () => {
    // timingSafeEqual throws on length mismatch; the guard must catch that.
    expect(() => verifyWebhookSignature(body, "abc", SECRET)).not.toThrow();
    expect(verifyWebhookSignature(body, "abc", SECRET)).toBe(false);
  });
});

describe("verifyCheckoutSignature", () => {
  const orderId = "order_abc";
  const paymentId = "pay_xyz";
  const keySecret = "rzp_key_secret";
  const good = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  it("accepts the genuine checkout signature", () => {
    expect(
      verifyCheckoutSignature({ orderId, paymentId, signature: good, keySecret }),
    ).toBe(true);
  });

  it("rejects a payment id swapped for another", () => {
    expect(
      verifyCheckoutSignature({
        orderId,
        paymentId: "pay_someone_elses",
        signature: good,
        keySecret,
      }),
    ).toBe(false);
  });

  it("rejects the order and payment ids being transposed", () => {
    const transposed = createHmac("sha256", keySecret)
      .update(`${paymentId}|${orderId}`)
      .digest("hex");
    expect(
      verifyCheckoutSignature({ orderId, paymentId, signature: transposed, keySecret }),
    ).toBe(false);
  });
});
