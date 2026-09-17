// Bestiary (web) — ตารางศัตรู + เงื่อนไขบอส (เนื้อหาเพิ่ม: ศัตรู/บอส)
export interface EnemyKindDef {
  kind: string;
  name: string;
  hp: number;
  dmg: number;
  spd: number;      // world units / sec
  xp: number;
  size: number;     // px on canvas
  hideChance?: number; // โอกาสดรอปหนังสัตว์
  gold?: number;       // gold ที่ดรอป
  boss?: boolean;
}

export const ENEMY_KINDS: Record<string, EnemyKindDef> = {
  slime: { kind: "slime", name: "สไลม์", hp: 12, dmg: 3, spd: 2.4, xp: 20, size: 10 },
  goblin: { kind: "goblin", name: "กอบลิน", hp: 9, dmg: 4, spd: 3.0, xp: 22, size: 10, hideChance: 0.35 },
  brute: { kind: "brute", name: "บรู๊ต", hp: 26, dmg: 6, spd: 1.7, xp: 35, size: 13, hideChance: 0.8, gold: 5 },
  slime_king: { kind: "slime_king", name: "ราชาสไลม์", hp: 90, dmg: 8, spd: 1.5, xp: 120, size: 20, hideChance: 1, gold: 25, boss: true },
};

/** คืนค่า stat ของศัตรู (fallback = slime) */
export function enemyStats(kind: string): EnemyKindDef {
  return ENEMY_KINDS[kind] ?? ENEMY_KINDS.slime!;
}

/** เลือกชนิดศัตรูตามเวลากลางวัน/กลางคืน (r ใน [0,1)) */
export function rollEnemyKind(isNight: boolean, r: number): string {
  if (isNight) {
    // goblin 50% / slime 30% / brute 20%
    return r < 0.5 ? "goblin" : r < 0.8 ? "slime" : "brute";
  }
  // กลางวัน: slime 60% / goblin 40%
  return r < 0.6 ? "slime" : "goblin";
}

/** บอส "ราชาสไลม์" ออกทุกคืนของวันที่หาร 3 ลงตัว, คืนละ 1 ตัว */
export function shouldSpawnBoss(day: number, isNight: boolean, spawnedOnDay: number | null): boolean {
  return isNight && day % 3 === 0 && spawnedOnDay !== day;
}
