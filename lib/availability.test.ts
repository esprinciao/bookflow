import { describe, expect, it } from "vitest";
import { generateSlots, type SlotRequest } from "@/lib/availability";

const KOLKATA = "Asia/Kolkata";
const LONDON = "Europe/London";
/** Far enough in the past that "don't offer slots already gone" never fires. */
const LONG_AGO = new Date("2020-01-01T00:00:00Z");
/** 2026-11-02 is a Monday; 2026-11-03 a Tuesday. */
const MONDAY = "2026-11-02";

/** Slots rendered as local wall-clock times, the way an owner would say them. */
function localTimes(slots: { startsAt: string }[], timeZone: string): string[] {
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  return slots.map((slot) => format.format(new Date(slot.startsAt)));
}

function request(overrides: Partial<SlotRequest> = {}): SlotRequest {
  return {
    date: MONDAY,
    timezone: KOLKATA,
    service: { durationMinutes: 60, bufferMinutes: 0 },
    rules: [{ dayOfWeek: 1, startTime: "09:00:00", endTime: "12:00:00" }],
    timeOff: [],
    bookings: [],
    slotIntervalMinutes: 60,
    now: LONG_AGO,
    ...overrides,
  };
}

describe("generateSlots — the weekly pattern", () => {
  it("generates slots across the open window", () => {
    expect(localTimes(generateSlots(request()), KOLKATA))
      .toEqual(["09:00", "10:00", "11:00"]);
  });

  it("stores slots as correct UTC instants", () => {
    // 09:00 in Kolkata (+05:30) is 03:30 UTC.
    expect(generateSlots(request())[0].startsAt).toBe("2026-11-02T03:30:00.000Z");
  });

  it("never offers an appointment that would overrun closing time", () => {
    const slots = generateSlots(request({
      service: { durationMinutes: 90, bufferMinutes: 0 },
    }));
    // 11:00 + 90min would end at 12:30, past the 12:00 close.
    expect(localTimes(slots, KOLKATA)).toEqual(["09:00", "10:00"]);
  });

  it("returns nothing for a day with no rule", () => {
    expect(generateSlots(request({ date: "2026-11-03" }))).toEqual([]);
  });

  it("offers each slot once when rules overlap", () => {
    const slots = generateSlots(request({
      rules: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
      ],
    }));
    expect(localTimes(slots, KOLKATA)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("refuses a non-positive duration rather than looping forever", () => {
    expect(generateSlots(request({
      service: { durationMinutes: 0, bufferMinutes: 0 },
    }))).toEqual([]);
  });
});

describe("generateSlots — existing bookings", () => {
  it("removes a slot taken by an existing booking", () => {
    const slots = generateSlots(request({
      bookings: [
        { startsAt: "2026-11-02T04:30:00Z", endsAt: "2026-11-02T05:30:00Z", bufferMinutes: 0 },
      ],
    }));
    expect(localTimes(slots, KOLKATA)).toEqual(["09:00", "11:00"]);
  });

  it("allows a back-to-back booking when neither has a buffer", () => {
    // A slot starting exactly when another ends does not overlap: the ranges
    // are half-open, matching the tstzrange in the exclusion constraint.
    const slots = generateSlots(request({
      bookings: [
        { startsAt: "2026-11-02T03:30:00Z", endsAt: "2026-11-02T04:30:00Z", bufferMinutes: 0 },
      ],
    }));
    expect(localTimes(slots, KOLKATA)).toEqual(["10:00", "11:00"]);
  });

  it("respects the buffer of the service already booked", () => {
    // 09:00-10:00 booked with a 30-minute cleanup blocks until 10:30, so the
    // 10:00 slot is gone even though the appointment itself ended.
    const slots = generateSlots(request({
      bookings: [
        { startsAt: "2026-11-02T03:30:00Z", endsAt: "2026-11-02T04:30:00Z", bufferMinutes: 30 },
      ],
    }));
    expect(localTimes(slots, KOLKATA)).toEqual(["11:00"]);
  });

  it("respects the buffer of the service being booked now", () => {
    // Booking 11:00-12:00 exists. A 60-min service with a 30-min buffer
    // starting at 10:00 would occupy until 11:30 and collide with it.
    const slots = generateSlots(request({
      service: { durationMinutes: 60, bufferMinutes: 30 },
      bookings: [
        { startsAt: "2026-11-02T05:30:00Z", endsAt: "2026-11-02T06:30:00Z", bufferMinutes: 0 },
      ],
    }));
    expect(localTimes(slots, KOLKATA)).toEqual(["09:00"]);
  });
});

describe("generateSlots — time off and notice", () => {
  it("subtracts time off", () => {
    const slots = generateSlots(request({
      timeOff: [{ startsAt: "2026-11-02T04:00:00Z", endsAt: "2026-11-02T05:00:00Z" }],
    }));
    expect(localTimes(slots, KOLKATA)).toEqual(["11:00"]);
  });

  it("does not offer slots that have already passed", () => {
    const slots = generateSlots(request({ now: new Date("2026-11-02T04:00:00Z") }));
    expect(localTimes(slots, KOLKATA)).toEqual(["10:00", "11:00"]);
  });

  it("honours a minimum notice period", () => {
    expect(generateSlots(request({
      now: new Date("2026-11-01T12:00:00Z"),
      minimumNoticeMinutes: 24 * 60,
    }))).toEqual([]);
  });
});

describe("generateSlots — daylight saving", () => {
  // London springs forward on 2026-03-29: 01:00 becomes 02:00.
  const springForward = {
    date: "2026-03-29",
    timezone: LONDON,
    rules: [{ dayOfWeek: 0, startTime: "00:00", endTime: "05:00" }],
  };

  it("skips the hour that does not exist", () => {
    const slots = generateSlots(request({
      ...springForward,
      service: { durationMinutes: 60, bufferMinutes: 0 },
    }));
    // The clock reads 00:59 GMT and then 02:00 BST, so only 01:00-01:59 is
    // skipped. 02:00 is a real reading and must still be offered — dropping it
    // would quietly cost the business an hour of bookable time.
    expect(localTimes(slots, LONDON)).toEqual(["00:00", "02:00", "03:00", "04:00"]);
  });

  it("maps the first post-jump reading to the right instant", () => {
    const slots = generateSlots(request({
      ...springForward,
      service: { durationMinutes: 60, bufferMinutes: 0 },
    }));
    // 02:00 BST is 01:00 UTC — the very moment the clocks moved.
    expect(slots[1].startsAt).toBe("2026-03-29T01:00:00.000Z");
  });

  it("keeps slots on round local times rather than drifting", () => {
    const slots = generateSlots(request({
      date: "2026-03-29",
      timezone: LONDON,
      rules: [{ dayOfWeek: 0, startTime: "09:00", endTime: "12:00" }],
    }));
    expect(localTimes(slots, LONDON)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("stores the post-transition offset", () => {
    const slots = generateSlots(request({
      date: "2026-03-29",
      timezone: LONDON,
      rules: [{ dayOfWeek: 0, startTime: "09:00", endTime: "12:00" }],
    }));
    // 09:00 BST is 08:00 UTC. Storing 09:00 UTC would be the classic bug.
    expect(slots[0].startsAt).toBe("2026-03-29T08:00:00.000Z");
  });

  it("generates the same local times the week before and after a transition", () => {
    const week = (date: string) =>
      localTimes(generateSlots(request({
        date, timezone: LONDON,
        rules: [{ dayOfWeek: 0, startTime: "09:00", endTime: "12:00" }],
      })), LONDON);
    // The salon's hours did not change; only the UTC offset did.
    expect(week("2026-03-22")).toEqual(week("2026-04-05"));
    expect(week("2026-03-22")).toEqual(["09:00", "10:00", "11:00"]);
  });
});
