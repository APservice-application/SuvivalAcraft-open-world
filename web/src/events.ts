// World Events (web) — pure scheduler + definitions. งานที่ 14
// Events: migration (ฝูงศัตรูอพยพ), storm (พายุ), wildfire (ไฟป่า), merchant (พ่อค้า), camp (แคมป์ร้าง)
export type EventKind = "migration" | "storm" | "wildfire" | "merchant" | "camp";

export interface EventDef {
  kind: EventKind;
  name: string;
  icon: string;
  duration: number; // seconds
  weight: number;
  minDay: number;
}

export const EVENT_DEFS: EventDef[] = [
  { kind: "migration", name: "ฝูงศัตรูอพยพ", icon: "🐗", duration: 30, weight: 3, minDay: 1 },
  { kind: "storm", name: "พายุฝน", icon: "⛈️", duration: 40, weight: 3, minDay: 1 },
  { kind: "wildfire", name: "ไฟป่า", icon: "🔥", duration: 25, weight: 2, minDay: 2 },
  { kind: "merchant", name: "พ่อค้าเร่ร่อน", icon: "💰", duration: 60, weight: 3, minDay: 1 },
  { kind: "camp", name: "แคมป์ร้าง", icon: "⛺", duration: 45, weight: 2, minDay: 1 },
];

export function eventDef(kind: EventKind): EventDef {
  return EVENT_DEFS.find((d) => d.kind === kind)!;
}

export interface ActiveEvent { kind: EventKind; startsAt: number; endsAt: number; }

/** Seconds between end of one event and the next roll. */
export const EVENT_GAP: readonly [number, number] = [100, 200];

/** Weighted pick; r in [0,1). Deterministic given r. */
export function pickEvent(day: number, r: number): EventKind | null {
  const pool = EVENT_DEFS.filter((d) => day >= d.minDay);
  if (!pool.length) return null;
  const total = pool.reduce((a, d) => a + d.weight, 0);
  let x = r * total;
  for (const d of pool) {
    x -= d.weight;
    if (x < 0) return d.kind;
  }
  return pool[pool.length - 1]!.kind;
}

export class EventScheduler {
  /** gameSeconds when the next event may roll. */
  nextAt: number;
  active: ActiveEvent | null = null;

  constructor(firstAt = 60) {
    this.nextAt = firstAt;
  }

  anyActive(now: number): boolean {
    return !!this.active && now < this.active.endsAt;
  }

  activeKind(kind: EventKind, now: number): boolean {
    return !!this.active && this.active.kind === kind && now < this.active.endsAt;
  }

  /** Advance scheduler. Returns the event kind when a new event starts, else null. */
  tick(now: number, day: number, rng: () => number): EventKind | null {
    if (this.active && now >= this.active.endsAt) this.active = null;
    if (this.active || now < this.nextAt) return null;
    const kind = pickEvent(day, rng());
    if (!kind) return null;
    const def = eventDef(kind);
    this.active = { kind, startsAt: now, endsAt: now + def.duration };
    const [lo, hi] = EVENT_GAP;
    this.nextAt = this.active.endsAt + lo + rng() * (hi - lo);
    return kind;
  }
}
