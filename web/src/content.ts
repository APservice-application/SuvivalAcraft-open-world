// Content Pack (web) — งานที่ 17: engine กับ content แยกกัน
// เกมมี registry ในตัว (state.ts) — content pack (JSON) สามารถ "เพิ่ม/ทับ" รายการได้ตอนบูต
import { ITEMS, RECIPES, type ItemDef, type Recipe } from "./state.js";
import type { Slot } from "./state.js";

export interface ContentPack {
  name: string;
  items?: (ItemDef & { recipe?: never })[];
  recipes?: { id: string; name: string; icon: string; out: Slot; needs: Slot[]; station?: string }[];
}

export interface MergeResult {
  items: Record<string, ItemDef>;
  recipes: Recipe[];
  itemsAdded: number;
  itemsOverridden: number;
  recipesAdded: number;
}

/** Pure: รวม base registry กับ pack (pack ชนะเมื่อ id ซ้ำ) โดยไม่แก้ของเดิม */
export function mergeContentPack(baseItems: Record<string, ItemDef>, baseRecipes: Recipe[], pack: ContentPack): MergeResult {
  const items: Record<string, ItemDef> = { ...baseItems };
  const recipes: Recipe[] = [...baseRecipes];
  let itemsAdded = 0, itemsOverridden = 0, recipesAdded = 0;
  for (const it of pack.items ?? []) {
    if (!it || typeof it.id !== "string" || !it.id) continue;
    if (items[it.id]) itemsOverridden += 1;
    else itemsAdded += 1;
    items[it.id] = it;
  }
  const known = new Set(recipes.map((r) => r.id));
  for (const r of pack.recipes ?? []) {
    if (!r || typeof r.id !== "string" || !r.id) continue;
    // ต้องมี item ปลายทาง + วัตถุดิบครบใน registry หลังรวม
    if (!items[r.out?.item]) continue;
    if (!Array.isArray(r.needs) || r.needs.some((n) => !items[n?.item])) continue;
    if (known.has(r.id)) continue;
    recipes.push(r);
    recipesAdded += 1;
  }
  return { items, recipes, itemsAdded, itemsOverridden, recipesAdded };
}

/** ใช้ pack กับ registry จริงของเกม (mutate in-place — ITEMS เป็น Record, RECIPES เป็น array) */
export function applyContentPack(pack: ContentPack): MergeResult {
  const res = mergeContentPack(ITEMS, RECIPES, pack);
  Object.assign(ITEMS, res.items);
  RECIPES.length = 0;
  RECIPES.push(...res.recipes);
  return res;
}

/** อ่าน pack จาก localStorage (คืน null ถ้าไม่มี/เสีย) */
export function packFromStorage(raw: string | null): ContentPack | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as ContentPack;
    if (!p || typeof p.name !== "string") return null;
    return p;
  } catch {
    return null;
  }
}
