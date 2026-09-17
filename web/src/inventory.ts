// Inventory utilities (web) — pure. งานเสริม: ปุ่มจัดเรียง + durability helpers (งานที่ 07)
import { ITEMS, type Slot } from "./state.js";

const CATEGORY_ORDER: Record<string, number> = { resource: 0, food: 1, tool: 2, weapon: 3, armor: 4, misc: 5 };

/** Merge stacks and sort by category then item id. Returns a new array. */
export function sortSlots(inv: Slot[]): Slot[] {
  const merged = new Map<string, Slot>();
  for (const s of inv) {
    const def = ITEMS[s.item];
    const stack = def?.stack ?? 999;
    const cur = merged.get(s.item);
    if (!cur) {
      merged.set(s.item, { ...s });
      continue;
    }
    // tools/armor with durability keep the best (max dur) instance, count stays 1-per-slot
    if (def && (def.category === "tool" || def.category === "weapon" || def.category === "armor")) {
      if ((s.dur ?? 0) > (cur.dur ?? 0)) merged.set(s.item, { ...s });
      continue;
    }
    const space = stack - cur.count;
    const move = Math.min(space, s.count);
    cur.count += move;
    // overflow beyond stack limit becomes a new entry with same key (rare; stacks are <= limit already)
    if (move < s.count) {
      // push leftover by appending a virtual overflow entry
      const rest = s.count - move;
      merged.set(s.item + "\u0000" + merged.size, { item: s.item, count: rest, dur: s.dur });
    }
  }
  return [...merged.values()].sort((a, b) => {
    const ca = CATEGORY_ORDER[ITEMS[a.item]?.category ?? "misc"] ?? 9;
    const cb = CATEGORY_ORDER[ITEMS[b.item]?.category ?? "misc"] ?? 9;
    if (ca !== cb) return ca - cb;
    return a.item.localeCompare(b.item);
  });
}

export interface WearResult { dur: number; broke: boolean; }

/** Reduce durability of a slot by amount (pure: returns new dur + broke flag). */
export function wearSlot(s: Slot, amount = 1): WearResult {
  if (s.dur === undefined) return { dur: s.dur ?? Infinity, broke: false };
  const d = Math.max(0, s.dur - amount);
  return { dur: d, broke: d <= 0 };
}
