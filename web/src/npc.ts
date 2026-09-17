// NPC system (web) — CP-020: หมู่บ้าน Elder/Merchant/Blacksmith + Dialogue + ร้านค้า (pure logic)
import { ITEMS, newPlayer, addItem, removeItem, countItems, type PlayerState } from "./state.js";

export interface NpcDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** ตำแหน่งในหมู่บ้าน (โลกเริ่มต้น) */
  x: number;
  z: number;
  /** บรรทัดพูดเริ่มต้น */
  greeting: string;
  /** ตัวเลือกบทสนทนา */
  options: DialogueOption[];
}

export interface DialogueOption {
  label: string;
  /** ประเภทของผลลัพธ์เมื่อเลือก */
  action: "shop" | "repair" | "gift" | "talk" | "close";
  /** ข้อความตอบกลับ (talk/gift) */
  reply?: string;
  /** เงื่อนไขพิเศษ */
  once?: boolean;
}

export const NPC_DEFS: NpcDef[] = [
  {
    id: "elder",
    name: "ผู้เฒ่าประจำหมู่บ้าน",
    icon: "👴",
    color: "#c9b8a0",
    x: 35, z: 35,
    greeting: "ยินดีต้อนรับสู่หมู่บ้านนักผจญภัย เด็กน้อย ข้ามีของให้เจ้าเล็กน้อยสำหรับการเดินทาง",
    options: [
      { label: "🙏 รับของขวัญเปิดทาง (10 🪙)", action: "gift", reply: "เอาไปเถิด ใช้ให้เป็น แล้วพบกันใหม่", once: true },
      { label: "💬 ถามเรื่องโลกรอบตัว", action: "talk", reply: "กลางคืนศัตรูร้ายกาจออกล่า จงก่อแคมป์ไฟเพื่อความอบอุ่น และระวังราชาสไลม์ในคืนที่ดวงจันทร์วนครบ (ทุก 3 วัน)" },
      { label: "💬 ถามเรื่องการเอาชีวิตรอด", action: "talk", reply: "หิวให้กิน หนาวให้ก่อไฟ เกราะช่วยลดแรงตี และอย่าลืมเซฟชีวิต — บันทึกเกมทุกครั้งก่อนพัก" },
      { label: "🚪 ลาก่อน", action: "close" },
    ],
  },
  {
    id: "merchant",
    name: "พ่อค้าหมู่บ้าน",
    icon: "🧑‍🌾",
    color: "#d9a13c",
    x: 37, z: 35,
    greeting: "ของดีราคาถูก! มีของขายและรับซื้อของจากนักผจญภัยด้วย",
    options: [
      { label: "🛒 เปิดร้านค้า", action: "shop" },
      { label: "🚪 ไม่ล่ะ ขอบคุณ", action: "close" },
    ],
  },
  {
    id: "blacksmith",
    name: "ช่างตีเหล็ก",
    icon: "🧔",
    color: "#8d949e",
    x: 35, z: 37,
    greeting: "ของที่สึกหรอห้ามใช้ต่อนะ ข้าซ่อมให้ได้ แต่ต้องจ่ายค่าแรง",
    options: [
      { label: "🔧 ซ่อมอุปกรณ์ทั้งหมด", action: "repair" },
      { label: "💬 ถามเรื่องการซ่อม", action: "talk", reply: "ค่าซ่อมคิดตามความเสียหาย อุปกรณ์ที่แตกสลายไปแล้วซ่อมไม่ได้นะ ระวังให้ดี" },
      { label: "🚪 ไว้ค่อยว่ากัน", action: "close" },
    ],
  },
];

export function npcById(id: string): NpcDef | undefined {
  return NPC_DEFS.find((n) => n.id === id);
}

// ------------------------------------------------------------
// ร้านค้า (buy/sell) — ราคาขาย = ครึ่งราคาซื้อปัดลง ขั้นต่ำ 1
// ------------------------------------------------------------
export const SHOP_STOCK: readonly { item: string; price: number }[] = [
  { item: "meat_cooked", price: 8 },
  { item: "wheat_seed", price: 3 },
  { item: "corn_seed", price: 6 },
  { item: "torch", price: 3 },
  { item: "fence", price: 4 },
  { item: "campfire", price: 10 },
  { item: "hide_helm", price: 18 },
  { item: "hide_armor", price: 30 },
  { item: "hide_pants", price: 22 },
];

export const SELLABLE: readonly string[] = ["wood", "stone", "fiber", "berry", "wheat", "corn", "hide", "bone", "meat_raw", "meat_cooked", "torch"];

export function buyPrice(item: string): number | undefined {
  return SHOP_STOCK.find((s) => s.item === item)?.price;
}

export function sellPrice(item: string): number | undefined {
  if (!SELLABLE.includes(item)) return undefined;
  const b = buyPrice(item);
  return b ? Math.max(1, Math.floor(b / 2)) : 1;
}

/** pure: ซื้อ 1 ชิ้น — คืน player ใหม่ + สำเร็จ/ไม่ (ไม่แก้ต้นฉบับ) */
export function applyBuy(p: PlayerState, item: string): { ok: boolean; player: PlayerState; reason?: string } {
  const price = buyPrice(item);
  if (!price) return { ok: false, player: p, reason: "ไม่มีของชิ้นนี้" };
  if (p.gold < price) return { ok: false, player: p, reason: "gold ไม่พอ" };
  if (p.inv.length >= 24 && !p.inv.some((s) => s.item === item && countItems(p, item) < (ITEMS[item]?.stack ?? 1))) {
    return { ok: false, player: p, reason: "กระเป๋าเต็ม" };
  }
  const next: PlayerState = { ...p, inv: p.inv.map((s) => ({ ...s })) };
  next.gold -= price;
  addItem(next, item, 1);
  return { ok: true, player: next };
}

/** pure: ขายของ 1 ชิ้น */
export function applySell(p: PlayerState, item: string): { ok: boolean; player: PlayerState; gain?: number; reason?: string } {
  const price = sellPrice(item);
  if (!price) return { ok: false, player: p, reason: "ของชิ้นนี้ขายไม่ได้" };
  if (countItems(p, item) < 1) return { ok: false, player: p, reason: "ไม่มีของพอ" };
  const next: PlayerState = { ...p, inv: p.inv.map((s) => ({ ...s })) };
  if (!removeItem(next, item, 1)) return { ok: false, player: p, reason: "ไม่มีของพอ" };
  next.gold += price;
  return { ok: true, player: next, gain: price };
}

// ------------------------------------------------------------
// ซ่อมอุปกรณ์ (Blacksmith)
// ------------------------------------------------------------
export const REPAIR_DIVISOR = 2;

/** ค่าซ่อมทั้งหมด = ความเสียหายรวม / 2 ปัดขึ้น (ขั้นต่ำ 1 เมื่อมีของชำรุด) */
export function repairCost(p: PlayerState): { cost: number; broken: number; items: number } {
  let deficit = 0;
  let items = 0;
  for (const s of p.inv) {
    const max = ITEMS[s.item]?.maxDur;
    if (max && s.dur !== undefined && s.dur < max) {
      deficit += max - s.dur;
      items += 1;
    }
  }
  for (const slot of ["head", "chest", "legs", "acc"] as const) {
    const it = p.armor?.[slot];
    const max = it ? ITEMS[it]?.maxDur : undefined;
    if (it && max) {
      const cur = p.armorDur?.[slot] ?? max;
      if (cur < max) {
        deficit += max - cur;
        items += 1;
      }
    }
  }
  const cost = deficit > 0 ? Math.max(1, Math.ceil(deficit / REPAIR_DIVISOR)) : 0;
  return { cost, broken: items, items };
}

/** pure: ซ่อมทุกชิ้น — ต้องมี gold พอ */
export function applyRepair(p: PlayerState): { ok: boolean; player: PlayerState; cost: number; reason?: string } {
  const { cost, broken } = repairCost(p);
  if (broken === 0) return { ok: false, player: p, cost: 0, reason: "ทุกชิ้นสมบูรณ์อยู่แล้ว" };
  if (p.gold < cost) return { ok: false, player: p, cost, reason: "gold ไม่พอ" };
  const next: PlayerState = {
    ...p,
    inv: p.inv.map((s) => {
      const max = ITEMS[s.item]?.maxDur;
      return max && s.dur !== undefined && s.dur < max ? { ...s, dur: max } : { ...s };
    }),
    armorDur: { ...(p.armorDur ?? {}) },
  };
  for (const slot of ["head", "chest", "legs", "acc"] as const) {
    const it = next.armor?.[slot];
    const max = it ? ITEMS[it]?.maxDur : undefined;
    if (it && max) next.armorDur[slot] = max;
  }
  next.gold -= cost;
  return { ok: true, player: next, cost };
}

/** ตำแหน่ง NPC ทั้งหมด (สำหรับวาด/ชน) */
export function villageNpcs(): { def: NpcDef; x: number; z: number }[] {
  return NPC_DEFS.map((d) => ({ def: d, x: d.x, z: d.z }));
}

// re-export สำหรับ test สะดวก
export { newPlayer };
