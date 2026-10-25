import { describe, expect, it } from "vitest";
import {
  dayOfWeekFor,
  displayTimezone,
  instantFromWallClock,
  minutesFromTimeString,
  wallClockAt,
} from "@/lib/time";

const wall = (year: number, month: number, day: number, hour: number, minute: number) => ({
  year, month, day, hour, minute,
});
const iso = (d: Date | null) => (d === null ? null : d.toISOString());

describe("instantFromWallClock", () => {
  it("converts a fixed-offset zone", () => {
    // Asia/Kolkata is +05:30 all year round.
    expect(iso(instantFromWallClock(wall(2026, 11, 2, 9, 0), "Asia/Kolkata")))
      .toBe("2026-11-02T03:30:00.000Z");
  });

  it("applies the correct offset either side of a transition", () => {
    // New York moves to EDT on 2026-03-08.
    expect(iso(instantFromWallClock(wall(2026, 3, 7, 9, 0), "America/New_York")))
      .toBe("2026-03-07T14:00:00.000Z"); // EST, -5
    expect(iso(instantFromWallClock(wall(2026, 3, 8, 9, 0), "America/New_York")))
      .toBe("2026-03-08T13:00:00.000Z"); // EDT, -4
  });

  it("returns null for a reading inside a DST gap", () => {
    // London jumps 01:00 -> 02:00 on 2026-03-29, so 01:30 never happens.
    expect(instantFromWallClock(wall(2026, 3, 29, 1, 30), "Europe/London")).toBeNull();
    // New York jumps 02:00 -> 03:00 on 2026-03-08.
    expect(instantFromWallClock(wall(2026, 3, 8, 2, 30), "America/New_York")).toBeNull();
  });

  it("returns the earlier instant for an ambiguous reading", () => {
    // London falls back on 2026-10-25: 01:30 occurs in BST, then again in GMT.
    expect(iso(instantFromWallClock(wall(2026, 10, 25, 1, 30), "Europe/London")))
      .toBe("2026-10-25T00:30:00.000Z");
  });

  it("round-trips every month through a DST zone", () => {
    for (let month = 1; month <= 12; month++) {
      for (const hour of [0, 9, 13, 23]) {
        const want = wall(2026, month, 15, hour, 30);
        const instant = instantFromWallClock(want, "Europe/London");
        expect(instant).not.toBeNull();
        expect(wallClockAt(instant!, "Europe/London")).toEqual(want);
      }
    }
  });
});

describe("calendar helpers", () => {
  it("maps dates to JavaScript day numbers", () => {
    expect(dayOfWeekFor("2026-11-01")).toBe(0); // Sunday
    expect(dayOfWeekFor("2026-11-02")).toBe(1); // Monday
    expect(dayOfWeekFor("2026-11-07")).toBe(6); // Saturday
  });

  it("rejects malformed dates rather than guessing", () => {
    expect(() => dayOfWeekFor("2026-11-2")).toThrow();
    expect(() => minutesFromTimeString("9:00")).toThrow();
  });

  it("parses times to minutes past midnight", () => {
    expect(minutesFromTimeString("09:00:00")).toBe(540);
    expect(minutesFromTimeString("17:30")).toBe(1050);
    expect(minutesFromTimeString("00:00")).toBe(0);
  });

  it("canonicalises legacy zone aliases for display", () => {
    expect(displayTimezone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(displayTimezone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(displayTimezone("Europe/London")).toBe("Europe/London");
  });
});
