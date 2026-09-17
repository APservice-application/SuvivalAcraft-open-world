import { describe, it, expect } from "vitest";
import {
  EVENT_DEFS, eventDef, pickEvent, EventScheduler, EVENT_GAP,
} from "../web/src/events.js";

describe("event definitions", () => {
  it("cover all five blueprint events with positive weight/duration", () => {
    const kinds = EVENT_DEFS.map((d) => d.kind).sort();
    expect(kinds).toEqual(["camp", "merchant", "migration", "storm", "wildfire"]);
    for (const d of EVENT_DEFS) {
      expect(d.weight).toBeGreaterThan(0);
      expect(d.duration).toBeGreaterThan(0);
      expect(d.minDay).toBeGreaterThanOrEqual(1);
      expect(d.name.length).toBeGreaterThan(0);
    }
  });

  it("eventDef returns the def for every kind", () => {
    for (const d of EVENT_DEFS) expect(eventDef(d.kind).kind).toBe(d.kind);
  });
});

describe("pickEvent", () => {
  it("r=0 picks the first available event, r≈1 the last", () => {
    const day1 = EVENT_DEFS.filter((d) => d.minDay <= 1);
    expect(pickEvent(1, 0)).toBe(day1[0]!.kind);
    expect(pickEvent(1, 0.999999)).toBe(day1[day1.length - 1]!.kind);
  });

  it("respects minDay gating (wildfire only from day 2)", () => {
    for (let i = 0; i < 200; i++) {
      const k = pickEvent(1, i / 200);
      expect(k).not.toBe("wildfire");
    }
    // day-2 weights: migration3 storm3 wildfire2 merchant3 camp2 (total 13)
    // wildfire occupies r in [6/13, 8/13) -> r=0.5 lands on it
    expect(pickEvent(2, 0.5)).toBe("wildfire");
    // same r at day 1 (no wildfire in pool) lands on storm
    expect(pickEvent(1, 0.5)).toBe("storm");
  });

  it("returns a valid kind for many random draws", () => {
    for (let i = 0; i < 500; i++) {
      const k = pickEvent(3, Math.random());
      expect(EVENT_DEFS.some((d) => d.kind === k)).toBe(true);
    }
  });
});

describe("EventScheduler", () => {
  it("does not start before nextAt", () => {
    const s = new EventScheduler(60);
    expect(s.tick(0, 1, () => 0.5)).toBeNull();
    expect(s.tick(59, 1, () => 0.5)).toBeNull();
  });

  it("starts an event at nextAt, keeps it active, then expires", () => {
    const s = new EventScheduler(60);
    const kind = s.tick(60, 1, () => 0.5);
    expect(kind).not.toBeNull();
    const def = eventDef(kind!);
    expect(s.active).not.toBeNull();
    expect(s.active!.startsAt).toBe(60);
    expect(s.active!.endsAt).toBe(60 + def.duration);
    expect(s.anyActive(60 + def.duration - 1)).toBe(true);
    // still active -> no new event even after nextAt window
    expect(s.tick(60 + def.duration, 1, () => 0.5)).toBeNull();
    // expiry clears
    void s.tick(60 + def.duration + 1, 1, () => 0.5);
    expect(s.anyActive(60 + def.duration + 1)).toBe(false);
  });

  it("schedules next roll within EVENT_GAP after the event ends", () => {
    const s = new EventScheduler(0);
    const kind = s.tick(10, 1, () => 0.5);
    const def = eventDef(kind!);
    const endsAt = 10 + def.duration;
    expect(s.nextAt).toBeGreaterThanOrEqual(endsAt + EVENT_GAP[0]);
    expect(s.nextAt).toBeLessThanOrEqual(endsAt + EVENT_GAP[1]);
  });

  it("activeKind is precise per kind and time", () => {
    const s = new EventScheduler(0);
    const kind = s.tick(0, 1, () => 0.1)!;
    const def = eventDef(kind);
    expect(s.activeKind(kind, 1)).toBe(true);
    expect(s.activeKind(kind, def.duration + 1)).toBe(false);
    const other = EVENT_DEFS.find((d) => d.kind !== kind)!.kind;
    expect(s.activeKind(other, 1)).toBe(false);
  });

  it("deterministic given the same rng sequence", () => {
    const mk = () => {
      const s = new EventScheduler(0);
      let seed = 1234;
      const rng = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      const started: (string | null)[] = [];
      for (let t = 0; t <= 600; t++) started.push(s.tick(t, 1, rng));
      return started.filter(Boolean);
    };
    expect(mk()).toEqual(mk());
  });
});
