// Farming system (web) — pure logic, no DOM. (ขยาย CP-011: หลายพืช + ปุ๋ย)
// พืชโตตามเวลาเกมจริง (gameSeconds); stage คำนวณจาก plantedAt -> now
// Stage tiles: T_CROP_0 (งอก) -> T_CROP_1 (กำลังโต) -> T_CROP_2 (เก็บเกี่ยวได้)

export interface WebCrop {
  id: string;
  seed: string;        // item id ของเมล็ด
  name: string;
  icon: string;
  /** elapsed seconds ที่ถึง stage 1 / stage 2 (สุกงอม) */
  stages: readonly [number, number, number];
  harvestItem: string;
  harvestMin: number;
  harvestMax: number;
  seedChance: number;  // โอกาสได้เมล็ดคืนตอนเก็บเกี่ยว
}

export const CROPS: Record<string, WebCrop> = {
  wheat: {
    id: "wheat", seed: "wheat_seed", name: "ข้าว", icon: "🌾",
    stages: [0, 60, 150],
    harvestItem: "wheat", harvestMin: 1, harvestMax: 2,
    seedChance: 0.5,
  },
  corn: {
    id: "corn", seed: "corn_seed", name: "ข้าวโพด", icon: "🌽",
    stages: [0, 90, 220],
    harvestItem: "corn", harvestMin: 1, harvestMax: 3,
    seedChance: 0.35,
  },
};

export function cropBySeedItem(seedItem: string): WebCrop | undefined {
  return Object.values(CROPS).find((c) => c.seed === seedItem);
}

/** ปุ๋ยเร่งการเติบโต (elapsed นับเร็วขึ้น) */
export const FERT_MULT = 1.6;

export function plotKey(x: number, z: number): string {
  return `${x},${z}`;
}

/** Stage 0..2 ตามชนิดพืช (พร้อมสถานะปุ๋ย) */
export function cropStage(crop: WebCrop, plantedAt: number, now: number, fert = false): 0 | 1 | 2 {
  const elapsed = (now - plantedAt) * (fert ? FERT_MULT : 1);
  if (elapsed >= crop.stages[2]) return 2;
  if (elapsed >= crop.stages[1]) return 1;
  return 0;
}

/** Stage แบบ generic (เกณฑ์ wheat 0/60/150) — เก็บไว้เพื่อ compat */
export function cropStageAt(plantedAt: number, now: number, fert = false): 0 | 1 | 2 {
  const elapsed = (now - plantedAt) * (fert ? FERT_MULT : 1);
  if (elapsed >= 150) return 2;
  if (elapsed >= 60) return 1;
  return 0;
}

/** สุกงอมหรือยัง (ใช้ stage 2 ของ crop จริงเป็นเกณฑ์) */
export function isMature(crop: WebCrop, plantedAt: number, now: number, fert = false): boolean {
  const elapsed = (now - plantedAt) * (fert ? FERT_MULT : 1);
  return elapsed >= crop.stages[2];
}

export interface PlotSave { crop: string; plantedAt: number; fert?: boolean; }

/** แปลงข้อมูลแปลงเก่า (number = wheat, plantedAt) -> รูปใหม่ */
export function normalizePlot(v: unknown): PlotSave | null {
  if (typeof v === "number") return { crop: "wheat", plantedAt: v };
  if (v && typeof v === "object") {
    const o = v as Partial<PlotSave>;
    if (typeof o.crop === "string" && CROPS[o.crop] && typeof o.plantedAt === "number") {
      return o.fert ? { crop: o.crop, plantedAt: o.plantedAt, fert: true } : { crop: o.crop, plantedAt: o.plantedAt };
    }
  }
  return null;
}

export interface PlotEntry { x: number; z: number; key: string; plot: PlotSave; }

/** Mutable farm plot registry. */
export class FarmPlots {
  state: Record<string, PlotSave> = {};

  plant(x: number, z: number, cropId: string, now: number): boolean {
    if (!CROPS[cropId]) return false;
    const k = plotKey(x, z);
    if (this.state[k]) return false;
    this.state[k] = { crop: cropId, plantedAt: now };
    return true;
  }

  has(x: number, z: number): boolean {
    return !!this.state[plotKey(x, z)];
  }

  cropAt(x: number, z: number): WebCrop | undefined {
    return CROPS[this.state[plotKey(x, z)]?.crop ?? ""];
  }

  stageAt(x: number, z: number, now: number): 0 | 1 | 2 | undefined {
    const p = this.state[plotKey(x, z)];
    if (!p) return undefined;
    const crop = CROPS[p.crop];
    if (!crop) return 0;
    return cropStage(crop, p.plantedAt, now, p.fert);
  }

  matureAt(x: number, z: number, now: number): boolean {
    const p = this.state[plotKey(x, z)];
    if (!p) return false;
    const crop = CROPS[p.crop];
    if (!crop) return false;
    return isMature(crop, p.plantedAt, now, p.fert);
  }

  /** ใส่ปุ๋ยได้ครั้งเดียวต่อแปลง */
  fertilize(x: number, z: number): boolean {
    const p = this.state[plotKey(x, z)];
    if (!p || p.fert) return false;
    p.fert = true;
    return true;
  }

  /** เก็บเกี่ยว: ลบแปลง, คืน crop ที่เก็บได้ */
  harvest(x: number, z: number): WebCrop | null {
    const k = plotKey(x, z);
    const p = this.state[k];
    if (!p) return null;
    const crop = CROPS[p.crop];
    delete this.state[k];
    return crop ?? null;
  }

  entries(): PlotEntry[] {
    return Object.entries(this.state).map(([key, plot]) => {
      const [xs, zs] = key.split(",");
      return { key, x: Number(xs), z: Number(zs), plot };
    });
  }

  matureCount(now: number): number {
    return this.entries().filter((e) => {
      const crop = CROPS[e.plot.crop];
      return crop ? isMature(crop, e.plot.plantedAt, now, e.plot.fert) : false;
    }).length;
  }

  /** โหลดจาก save (รองรับทั้งฟอร์แมตเก่า number และใหม่) */
  loadFrom(saved: Record<string, unknown>): void {
    this.state = {};
    for (const [k, v] of Object.entries(saved ?? {})) {
      const p = normalizePlot(v);
      if (p) this.state[k] = p;
    }
  }
}
