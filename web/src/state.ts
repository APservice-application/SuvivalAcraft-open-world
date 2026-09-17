export interface ItemDef {
  id: string;
  name: string;
  category: "resource" | "food" | "tool" | "weapon" | "armor" | "misc";
  icon: string;
  food?: number;
  heal?: number;
  damage?: number;
  /** ลดดาเมจที่ได้รับ (เกราะ) */
  defense?: number;
  /** ช่องสวมของเกราะ (งาน CP-019 equipment slots) */
  slot?: "head" | "chest" | "legs" | "acc";
  tool?: "axe" | "pickaxe" | "knife";
  /** ความทนทานสูงสุด (งานที่ 07) — ของที่มี maxDur จะมี slot.dur ติดตาม */
  maxDur?: number;
  stack: number;
}

export const ITEMS: Record<string, ItemDef> = {
  wood: { id: "wood", name: "ไม้", category: "resource", icon: "🪵", stack: 50 },
  stone: { id: "stone", name: "หิน", category: "resource", icon: "🪨", stack: 50 },
  fiber: { id: "fiber", name: "เส้นใย", category: "resource", icon: "🧵", stack: 50 },
  berry: { id: "berry", name: "เบอร์รี่", category: "food", icon: "🫐", stack: 20, food: 5, heal: 1 },
  wood_axe: { id: "wood_axe", name: "ขวานไม้", category: "tool", icon: "🪓", stack: 1, tool: "axe", damage: 3, maxDur: 40 },
  stone_axe: { id: "stone_axe", name: "ขวานหิน", category: "tool", icon: "⛏️", stack: 1, tool: "axe", damage: 5, maxDur: 70 },
  wood_sword: { id: "wood_sword", name: "ดาบไม้", category: "weapon", icon: "🗡️", stack: 1, damage: 4, maxDur: 35 },
  stone_sword: { id: "stone_sword", name: "ดาบหิน", category: "weapon", icon: "⚔️", stack: 1, damage: 7, maxDur: 60 },
  torch: { id: "torch", name: "คบเพลิง", category: "misc", icon: "🔥", stack: 20 },
  meat_raw: { id: "meat_raw", name: "เนื้อดิบ", category: "food", icon: "🥩", stack: 20, food: 4 },
  meat_cooked: { id: "meat_cooked", name: "เนื้อสุก", category: "food", icon: "🍖", stack: 20, food: 9, heal: 2 },
  // placeable buildings
  fence: { id: "fence", name: "รั้วไม้", category: "misc", icon: "🚧", stack: 50 },
  wall: { id: "wall", name: "กำแพงหิน", category: "misc", icon: "🧱", stack: 50 },
  door: { id: "door", name: "ประตูไม้", category: "misc", icon: "🚪", stack: 20 },
  campfire: { id: "campfire", name: "แคมป์ไฟ", category: "misc", icon: "🔥", stack: 10 },
  // farming
  wheat_seed: { id: "wheat_seed", name: "เมล็ดพืช", category: "misc", icon: "🌱", stack: 30 },
  wheat: { id: "wheat", name: "ข้าว", category: "food", icon: "🌾", stack: 30, food: 3 },
  corn_seed: { id: "corn_seed", name: "เมล็ดข้าวโพด", category: "misc", icon: "🌽", stack: 30 },
  corn: { id: "corn", name: "ข้าวโพด", category: "food", icon: "🌽", stack: 30, food: 5, heal: 1 },
  fertilizer: { id: "fertilizer", name: "ปุ๋ย", category: "misc", icon: "✨", stack: 20 },
  // เนื้อหาใหม่ (CP-010)
  hide: { id: "hide", name: "หนังสัตว์", category: "resource", icon: "🟫", stack: 30 },
  bone: { id: "bone", name: "กระดูก", category: "resource", icon: "🦴", stack: 30 },
  hide_armor: { id: "hide_armor", name: "เสื้อหนัง", category: "armor", icon: "🥼", stack: 1, defense: 2, maxDur: 80, slot: "chest" },
  hide_helm: { id: "hide_helm", name: "หมวกหนัง", category: "armor", icon: "🪖", stack: 1, defense: 1, maxDur: 40, slot: "head" },
  hide_pants: { id: "hide_pants", name: "กางเกงหนัง", category: "armor", icon: "👖", stack: 1, defense: 1, maxDur: 50, slot: "legs" },
  bone_charm: { id: "bone_charm", name: "เครื่องรางกระดูก", category: "armor", icon: "🧿", stack: 1, defense: 1, maxDur: 60, slot: "acc" },
};

export interface Slot { item: string; count: number; /** ความทนทานคงเหลือ (เฉพาะของที่มี maxDur) */ dur?: number; }

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  out: Slot;
  needs: Slot[];
  station?: string;
}

export const RECIPES: Recipe[] = [
  { id: "wood_axe", name: "ขวานไม้", icon: "🪓", out: { item: "wood_axe", count: 1 }, needs: [{ item: "wood", count: 3 }, { item: "fiber", count: 1 }] },
  { id: "stone_axe", name: "ขวานหิน", icon: "⛏️", out: { item: "stone_axe", count: 1 }, needs: [{ item: "stone", count: 3 }, { item: "wood", count: 2 }] },
  { id: "wood_sword", name: "ดาบไม้", icon: "🗡️", out: { item: "wood_sword", count: 1 }, needs: [{ item: "wood", count: 2 }, { item: "fiber", count: 2 }] },
  { id: "stone_sword", name: "ดาบหิน", icon: "⚔️", out: { item: "stone_sword", count: 1 }, needs: [{ item: "stone", count: 2 }, { item: "wood", count: 2 }] },
  { id: "torch", name: "คบเพลิง", icon: "🔥", out: { item: "torch", count: 4 }, needs: [{ item: "wood", count: 1 }, { item: "fiber", count: 1 }] },
  { id: "meat_cooked", name: "ย่างเนื้อ", icon: "🍖", out: { item: "meat_cooked", count: 1 }, needs: [{ item: "meat_raw", count: 1 }], station: "campfire" },
  // building
  { id: "fence", name: "รั้วไม้", icon: "🚧", out: { item: "fence", count: 2 }, needs: [{ item: "wood", count: 2 }] },
  { id: "wall", name: "กำแพงหิน", icon: "🧱", out: { item: "wall", count: 1 }, needs: [{ item: "stone", count: 4 }] },
  { id: "door", name: "ประตูไม้", icon: "🚪", out: { item: "door", count: 1 }, needs: [{ item: "wood", count: 4 }] },
  { id: "campfire", name: "แคมป์ไฟ", icon: "🔥", out: { item: "campfire", count: 1 }, needs: [{ item: "wood", count: 3 }, { item: "stone", count: 2 }] },
  { id: "hide_armor", name: "เสื้อหนัง", icon: "🥼", out: { item: "hide_armor", count: 1 }, needs: [{ item: "hide", count: 4 }, { item: "fiber", count: 2 }] },
  { id: "hide_helm", name: "หมวกหนัง", icon: "🪖", out: { item: "hide_helm", count: 1 }, needs: [{ item: "hide", count: 2 }, { item: "fiber", count: 1 }] },
  { id: "hide_pants", name: "กางเกงหนัง", icon: "👖", out: { item: "hide_pants", count: 1 }, needs: [{ item: "hide", count: 3 }, { item: "fiber", count: 1 }] },
  { id: "bone_charm", name: "เครื่องรางกระดูก", icon: "🧿", out: { item: "bone_charm", count: 1 }, needs: [{ item: "bone", count: 2 }, { item: "fiber", count: 2 }] },
  { id: "fertilizer", name: "ปุ๋ย", icon: "✨", out: { item: "fertilizer", count: 2 }, needs: [{ item: "fiber", count: 2 }, { item: "berry", count: 1 }] },
];

export interface PlayerState {
  name: string;
  outfit: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  hunger: number;
  maxHunger: number;
  /** ความอบอุ่น 0..100 (งานที่ 06 Temperature) */
  warmth: number;
  stamina: number;
  maxStamina: number;
  gold: number;
  pos: { x: number; y: number };
  inv: Slot[];
  /** อาวุธ/เครื่องมือที่ถือ (มือหลัก) */
  equip: string | null;
  /** ชุดเกราะที่สวม (CP-019 equipment slots) */
  armor: { head?: string; chest?: string; legs?: string; acc?: string };
  /** ความทนทานคงเหลือของเกราะแต่ละช่อง */
  armorDur: { head?: number; chest?: number; legs?: number; acc?: number };
}

export function newPlayer(name: string, outfit: string, x: number, y: number): PlayerState {
  return {
    name,
    outfit,
    level: 1,
    xp: 0,
    hp: 20,
    maxHp: 20,
    hunger: 20,
    maxHunger: 20,
    warmth: 50,
    stamina: 20,
    maxStamina: 20,
    gold: 10,
    pos: { x, y },
    inv: [
      { item: "wood", count: 5 },
      { item: "fiber", count: 3 },
      { item: "berry", count: 5 },
    ],
    equip: null,
    armor: {},
    armorDur: {},
  };
}

export const ARMOR_SLOTS = ["head", "chest", "legs", "acc"] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];

/** สวมของลงช่องเกราะ (สลับกับของเดิมอัตโนมัติ) — คืน true ถ้าสำเร็จ */
export function equipArmorFromSlot(p: PlayerState, invIndex: number): boolean {
  const s2 = p.inv[invIndex];
  if (!s2) return false;
  const def = ITEMS[s2.item];
  if (!def || def.category !== "armor" || !def.slot) return false;
  if (!removeItem(p, s2.item, 1)) return false;
  const slot: ArmorSlot = def.slot;
  // ถอดของเดิมคืน inventory (ถ้ามี)
  const old = p.armor[slot];
  if (old) {
    if (p.inv.length >= 24) { addItem(p, s2.item, 1); return false; } // ไม่มีที่วางของเดิม — คืนของใหม่
    p.inv.push({ item: old, count: 1, dur: p.armorDur[slot] });
  }
  p.armor[slot] = s2.item;
  p.armorDur[slot] = s2.dur ?? def.maxDur;
  return true;
}

/** ถอดเกราะจากช่อง — คืนของ (พร้อม dur) เข้า inventory */
export function unequipArmor(p: PlayerState, slot: ArmorSlot): boolean {
  const item = p.armor[slot];
  if (!item) return false;
  if (p.inv.length >= 24) return false;
  p.inv.push({ item, count: 1, dur: p.armorDur[slot] ?? ITEMS[item]?.maxDur });
  delete p.armor[slot];
  delete p.armorDur[slot];
  return true;
}

/** สึกของเกราะช่องที่ระบุ; แตกสลายเมื่อหมด (คืน true ถ้าแตก) */
export function wearArmor(p: PlayerState, slot: ArmorSlot, amount = 1): boolean {
  const item = p.armor[slot];
  if (!item) return false;
  const cur = p.armorDur[slot] ?? ITEMS[item]?.maxDur ?? 1;
  const left = Math.max(0, cur - amount);
  if (left <= 0) {
    delete p.armor[slot];
    delete p.armorDur[slot];
    return true;
  }
  p.armorDur[slot] = left;
  return false;
}

/** แปลงเซฟเก่า: equip ที่เป็นเกราะ → ย้ายไป armor.chest */
export function migrateEquipSlots(p: PlayerState): void {
  if (!p.armor) p.armor = {};
  if (!p.armorDur) p.armorDur = {};
  if (p.equip && ITEMS[p.equip]?.category === "armor") {
    const slot = ITEMS[p.equip]!.slot ?? "chest";
    if (!p.armor[slot]) p.armor[slot] = p.equip;
    p.equip = null;
  }
}

export function addItem(p: PlayerState, item: string, count: number): void {
  const def = ITEMS[item];
  if (!def) return;
  for (const s of p.inv) {
    if (s.item === item && s.count < def.stack) {
      const space = def.stack - s.count;
      const add = Math.min(space, count);
      s.count += add;
      count -= add;
      if (count <= 0) return;
    }
  }
  while (count > 0 && p.inv.length < 24) {
    const add = Math.min(def.stack, count);
    p.inv.push({ item, count: add });
    count -= add;
  }
}

export function removeItem(p: PlayerState, item: string, count: number): boolean {
  const has = countItems(p, item);
  if (has < count) return false;
  let left = count;
  for (let i = p.inv.length - 1; i >= 0 && left > 0; i--) {
    const s = p.inv[i]!;
    if (s.item !== item) continue;
    const take = Math.min(s.count, left);
    s.count -= take;
    left -= take;
    if (s.count <= 0) p.inv.splice(i, 1);
  }
  return true;
}

export function countItems(p: PlayerState, item: string): number {
  return p.inv.filter((s) => s.item === item).reduce((a, s) => a + s.count, 0);
}

export function canCraft(recipe: Recipe, p: PlayerState): boolean {
  return recipe.needs.every((n) => countItems(p, n.item) >= n.count);
}

export function craftRecipe(recipe: Recipe, p: PlayerState): boolean {
  if (!canCraft(recipe, p)) return false;
  for (const need of recipe.needs) removeItem(p, need.item, need.count);
  const def = ITEMS[recipe.out.item];
  if (def?.maxDur && recipe.out.count === 1) {
    // ของมีความทนทาน: ใส่ slot ใหม่พร้อม dur เต็ม
    p.inv.push({ item: recipe.out.item, count: 1, dur: def.maxDur });
  } else {
    addItem(p, recipe.out.item, recipe.out.count);
  }
  return true;
}

export function useItem(p: PlayerState, slotIndex: number): void {
  const s = p.inv[slotIndex];
  if (!s) return;
  const def = ITEMS[s.item];
  if (!def) return;
  if (def.category === "food") {
    p.hunger = Math.min(p.maxHunger, p.hunger + (def.food ?? 0));
    p.hp = Math.min(p.maxHp, p.hp + (def.heal ?? 0));
    removeItem(p, s.item, 1);
  } else if (def.category === "tool" || def.category === "weapon" || def.category === "armor") {
    p.equip = s.item;
  }
}

export function equippedDamage(p: PlayerState): number {
  if (p.equip && ITEMS[p.equip]) return ITEMS[p.equip]!.damage ?? 1;
  return 1;
}

/** พลังป้องกันรวมจากเกราะทุกช่องที่สวม (CP-019) */
export function equippedDefense(p: PlayerState): number {
  let d = 0;
  for (const slot of ARMOR_SLOTS) {
    const it = p.armor?.[slot];
    if (it && ITEMS[it]) d += ITEMS[it]!.defense ?? 0;
  }
  return d;
}

/** อาวุธในมือ */
export function equippedHand(p: PlayerState): string | null {
  return p.equip;
}

/** คำนวณดาเมจที่ได้รับหลังหักเกราะ (ขั้นต่ำ 1) */
export function damageAfterDefense(raw: number, p: PlayerState): number {
  return Math.max(1, raw - equippedDefense(p));
}

export function survivalTick(p: PlayerState, dt: number): void {
  p.hunger = Math.max(0, p.hunger - dt * 0.4);
  p.stamina = Math.min(p.maxStamina, p.stamina + dt * 1.2);
  if (p.hunger <= 0) {
    p.hp = Math.max(0, p.hp - dt * 1.2);
  } else if (p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + dt * 0.6);
  }
}

export function addXp(p: PlayerState, amount: number): boolean {
  p.xp += amount;
  if (p.xp >= p.level * 100) {
    p.xp -= p.level * 100;
    p.level += 1;
    p.maxHp += 5;
    p.hp = p.maxHp;
    return true;
  }
  return false;
}

const SAVE_KEY = "suvival-save-v1";

export function saveGame(p: PlayerState, seed: number, time: number): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, p, seed, time, savedAt: Date.now() }));
  } catch {
    // storage unavailable
  }
}

export function loadGame(): { p: PlayerState; seed: number; time: number } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { v: number; p: PlayerState; seed: number; time: number };
    if (data.v !== 1) return null;
    return { p: data.p, seed: data.seed, time: data.time };
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

// NOTE: ระบบบันทึกย้ายไปที่ web/src/saves.ts (multi-world v2 + IndexedDB + migration จาก v1)

export function xpNeed(p: PlayerState): number {
  return p.level * 100;
}
