"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function clientSnapshot(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const serverSnapshot = () => "UTC";

/**
 * The visitor's IANA timezone, e.g. "Asia/Kolkata".
 *
 * The server has no way to know this — the request doesn't carry it — so it
 * can only be read in the browser. useSyncExternalStore is the right tool
 * rather than a useEffect + setState: it takes an explicit server snapshot, so
 * the server and the first client render agree on "UTC" and React swaps in the
 * real value without a hydration mismatch and without an extra render pass.
 */
export function useBrowserTimezone(): string {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
