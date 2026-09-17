// Pixel-art item icons (web) — CP-017: ไอคอนวาดเป็นพิกเซล 16x16 แทน emoji
// Data-driven painters: แต่ละ item = รายการสี่เหลี่ยม [x, y, w, h, สี] บนกริด 16x16
import { ITEMS } from "./state.js";

export const ICON_GRID = 16;

export type Rect = readonly [number, number, number, number, string];

const P: Record<string, readonly Rect[]> = {
  wood: [[3, 4, 10, 8, "#8a5a2b"], [3, 4, 10, 2, "#a9743c"], [3, 10, 10, 2, "#6e4420"], [5, 4, 1, 8, "#5d3a1c"], [10, 4, 1, 8, "#5d3a1c"]],
  stone: [[4, 5, 8, 7, "#9aa2ad"], [4, 5, 8, 2, "#b6bec9"], [3, 9, 10, 3, "#7e8792"], [6, 7, 2, 2, "#c8d0da"]],
  fiber: [[7, 3, 2, 10, "#c9d67a"], [4, 5, 2, 8, "#a8bb5c"], [10, 5, 2, 8, "#a8bb5c"], [7, 2, 2, 2, "#e0ea9a"]],
  berry: [[5, 6, 3, 3, "#7b3fa0"], [9, 6, 3, 3, "#8f4bb8"], [7, 9, 3, 3, "#6a3390"], [8, 3, 1, 3, "#4e7a3a"]],
  wheat_seed: [[7, 8, 2, 5, "#7a5a33"], [8, 5, 1, 4, "#69b06a"], [6, 6, 2, 1, "#69b06a"], [9, 6, 2, 1, "#69b06a"]],
  wheat: [[8, 2, 1, 12, "#b58e2e"], [5, 3, 3, 2, "#d9b545"], [9, 3, 3, 2, "#d9b545"], [5, 6, 3, 2, "#d9b545"], [9, 6, 3, 2, "#d9b545"], [5, 9, 3, 2, "#c9a53c"], [9, 9, 3, 2, "#c9a53c"]],
  corn_seed: [[7, 8, 2, 5, "#7a5a33"], [8, 5, 1, 4, "#c9a53c"], [6, 6, 2, 1, "#c9a53c"], [9, 6, 2, 1, "#c9a53c"]],
  corn: [[6, 3, 4, 10, "#e8c84a"], [7, 4, 1, 8, "#f5dc6e"], [9, 4, 1, 8, "#d4af35"], [6, 2, 4, 2, "#5a9e4b"], [5, 5, 1, 6, "#5a9e4b"], [10, 5, 1, 6, "#5a9e4b"]],
  fertilizer: [[4, 5, 8, 8, "#8f6f4f"], [4, 5, 8, 2, "#a5855f"], [7, 3, 2, 2, "#6e5438"], [6, 8, 4, 3, "#e6d9a8"]],
  wood_axe: [[4, 3, 5, 4, "#a9743c"], [3, 4, 3, 2, "#c98f4e"], [8, 6, 2, 8, "#7a5a33"]],
  stone_axe: [[4, 3, 5, 4, "#9aa2ad"], [3, 4, 3, 2, "#b6bec9"], [8, 6, 2, 8, "#7a5a33"]],
  wood_sword: [[9, 2, 3, 3, "#c98f4e"], [7, 4, 3, 3, "#b57e3e"], [5, 6, 2, 2, "#5d4a2f"], [3, 8, 3, 3, "#7a5a33"]],
  stone_sword: [[9, 2, 3, 3, "#b6bec9"], [7, 4, 3, 3, "#9aa2ad"], [5, 6, 2, 2, "#5d4a2f"], [3, 8, 3, 3, "#7a5a33"]],
  torch: [[7, 5, 2, 8, "#8a5a2b"], [6, 2, 4, 4, "#ff9a3c"], [7, 1, 2, 2, "#ffe082"]],
  meat_raw: [[4, 5, 8, 6, "#d96a6a"], [4, 5, 8, 2, "#e88a8a"], [11, 7, 2, 2, "#f2e3c9"]],
  meat_cooked: [[4, 5, 8, 6, "#9c6234"], [4, 5, 8, 2, "#b87a42"], [11, 7, 2, 2, "#f2e3c9"]],
  fence: [[3, 4, 2, 9, "#9a7440"], [11, 4, 2, 9, "#9a7440"], [3, 6, 10, 2, "#7a5a33"], [3, 10, 10, 2, "#7a5a33"]],
  wall: [[2, 3, 12, 11, "#8d949e"], [2, 3, 12, 2, "#a2a9b5"], [2, 8, 5, 1, "#6d7480"], [8, 8, 6, 1, "#6d7480"], [2, 12, 5, 1, "#6d7480"], [8, 12, 6, 1, "#6d7480"], [7, 5, 1, 3, "#6d7480"], [3, 3, 1, 5, "#6d7480"], [12, 8, 1, 4, "#6d7480"]],
  door: [[4, 2, 8, 12, "#8a6435"], [4, 2, 8, 2, "#a97a44"], [10, 8, 2, 2, "#f5d76e"], [5, 4, 1, 9, "#6b4a26"]],
  campfire: [[3, 11, 10, 2, "#5a4632"], [5, 12, 6, 2, "#3f2f1f"], [6, 4, 4, 7, "#ff9a3c"], [7, 2, 2, 5, "#ffe082"]],
  hide: [[3, 4, 10, 9, "#b58e5a"], [3, 4, 10, 2, "#c9a26b"], [4, 12, 3, 1, "#9a7440"], [9, 12, 3, 1, "#9a7440"], [6, 7, 4, 3, "#a37f4c"]],
  hide_armor: [[4, 3, 8, 9, "#b58e5a"], [4, 3, 8, 2, "#c9a26b"], [3, 4, 2, 5, "#a37f4c"], [11, 4, 2, 5, "#a37f4c"], [6, 12, 4, 2, "#8a6435"], [7, 5, 2, 4, "#8a6435"]],
  bone: [[4, 8, 8, 2, "#efe8d8"], [3, 6, 3, 3, "#f8f3e6"], [10, 8, 3, 3, "#f8f3e6"], [4, 9, 3, 3, "#f8f3e6"], [9, 5, 3, 3, "#e8e0cc"]],
  hide_helm: [[4, 4, 8, 6, "#b58e5a"], [4, 4, 8, 2, "#c9a26b"], [3, 7, 10, 3, "#a37f4c"], [4, 10, 2, 2, "#8a6435"], [10, 10, 2, 2, "#8a6435"]],
  hide_pants: [[5, 3, 6, 4, "#a37f4c"], [5, 7, 2, 7, "#b58e5a"], [9, 7, 2, 7, "#b58e5a"], [5, 3, 6, 1, "#c9a26b"], [5, 13, 2, 1, "#8a6435"], [9, 13, 2, 1, "#8a6435"]],
  bone_charm: [[7, 3, 2, 3, "#8a6435"], [5, 6, 6, 6, "#efe8d8"], [6, 7, 4, 4, "#5fb8e0"], [7, 8, 2, 2, "#eaf6ff"]],
};

/** คืน painter ของ item (undefined ถ้าไม่มี — UI จะ fallback เป็น emoji) */
export function painterFor(item: string): readonly Rect[] | undefined {
  return P[item];
}

export function hasPainter(item: string): boolean {
  return !!P[item];
}

let dataUrlCache = new Map<string, string | null>();

/** วาดเป็น canvas (คืน null ถ้าไม่มี DOM เช่น node/test) */
export function iconCanvas(item: string, scale = 2): unknown {
  const g = globalThis as unknown as { document?: { createElement(tag: string): unknown } };
  if (!g.document) return null;
  const rects = painterFor(item);
  if (!rects) return null;
  const doc = g.document;
  const cv = doc.createElement("canvas") as {
    width: number; height: number;
    toDataURL(): string;
    getContext(id: string): { fillStyle: string; fillRect(x: number, y: number, w: number, h: number): void } | null;
  };
  cv.width = ICON_GRID * scale;
  cv.height = ICON_GRID * scale;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  for (const [x, y, w, h, color] of rects) {
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
  }
  return cv;
}

/** data URL ของไอคอน (null ถ้าวาดไม่ได้) */
export function iconDataUrl(item: string): string | null {
  if (dataUrlCache.has(item)) return dataUrlCache.get(item)!;
  const cv = iconCanvas(item) as { toDataURL(): string } | null;
  const url = cv ? cv.toDataURL() : null;
  dataUrlCache.set(item, url);
  return url;
}

/** HTML สำหรับแสดงไอคอนใน DOM UI — fallback เป็น emoji เมื่อไม่มี pixel painter */
export function iconHTML(item: string): string {
  const url = iconDataUrl(item);
  if (url) return `<img class="picon" src="${url}" alt="" />`;
  const def = ITEMS[item];
  return def ? `<span>${def.icon}</span>` : "";
}

/** ล้าง cache (ทดสอบ/หลัง apply content pack ที่มี override) */
export function clearIconCache(): void {
  dataUrlCache = new Map();
}
