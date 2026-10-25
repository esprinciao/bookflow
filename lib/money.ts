/**
 * Money lives in the database as an integer count of the currency's smallest
 * unit (price_cents), never as a float. 0.1 + 0.2 !== 0.3 in binary floating
 * point, and a booking system that quietly loses a cent per transaction is a
 * bug you find in an accountant's email.
 */

/** Currencies whose smallest unit IS the unit — no decimal subdivision. */
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW",
  "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

/** Currencies subdivided into thousandths rather than hundredths. */
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export function decimalsFor(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
}

export function formatMoney(smallestUnits: number, currency: string): string {
  const decimals = decimalsFor(currency);
  const amount = smallestUnits / 10 ** decimals;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(decimals)} ${currency.toUpperCase()}`;
  }
}

/**
 * Parses what a person typed into smallest units.
 *
 * Deliberately avoids `parseFloat(x) * 100`, which turns "19.99" into
 * 1998.9999999999998 and then truncates to 1998 — a cent lost on every
 * service priced with a 9.
 */
export function parseMoney(input: string, currency: string): number | null {
  const decimals = decimalsFor(currency);
  const cleaned = input.trim().replace(/[^\d.]/g, "");
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;

  const [whole = "0", fraction = ""] = cleaned.split(".");
  if (fraction.length > decimals) return null;

  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const units = Number(whole || "0") * 10 ** decimals + Number(padded || "0");
  return Number.isSafeInteger(units) && units >= 0 ? units : null;
}

/** Smallest units back to an editable decimal string, e.g. 2500 -> "25.00". */
export function toMoneyInput(smallestUnits: number, currency: string): string {
  return (smallestUnits / 10 ** decimalsFor(currency)).toFixed(decimalsFor(currency));
}
