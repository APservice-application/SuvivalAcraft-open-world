// Farming system (web) — pure logic, no DOM.
// Crops grow in real gameplay seconds; stage is derived from plantedAt -> now.
// Stage tiles: T_CROP_0 (sprout) -> T_CROP_1 (growing) -> T_CROP_2 (mature).

export const CROP_STAGES: readonly [number, number, number] = [0, 60, 150]; // elapsed seconds to reach stage i
export const CROP_MATURE_AT = CROP_STAGES[2];

export function plotKey(x: number, z: number): string {
  return `${x},${z}`;
}

/** Stage 0..2 for a plot planted at `plantedAt`, observed at `now`. */
export function cropStageAt(plantedAt: number, now: number): 0 | 1 | 2 {
  const elapsed = now - plantedAt;
  if (elapsed >= CROP_STAGES[2]) return 2;
  if (elapsed >= CROP_STAGES[1]) return 1;
  return 0;
}

export function isMatureAt(plantedAt: number, now: number): boolean {
  return now - plantedAt >= CROP_MATURE_AT;
}

export interface PlotEntry { x: number; z: number; key: string; plantedAt: number; }

/** Mutable farm plot registry. State serializes as Record<key, plantedAt>. */
export class FarmPlots {
  state: Record<string, number> = {};

  plant(x: number, z: number, now: number): boolean {
    const k = plotKey(x, z);
    if (this.state[k] !== undefined) return false;
    this.state[k] = now;
    return true;
  }

  has(x: number, z: number): boolean {
    return this.state[plotKey(x, z)] !== undefined;
  }

  stageAt(x: number, z: number, now: number): 0 | 1 | 2 | undefined {
    const planted = this.state[plotKey(x, z)];
    if (planted === undefined) return undefined;
    return cropStageAt(planted, now);
  }

  matureAt(x: number, z: number, now: number): boolean {
    const planted = this.state[plotKey(x, z)];
    if (planted === undefined) return false;
    return isMatureAt(planted, now);
  }

  /** Remove the plot (after harvest). Returns false if no plot. */
  harvest(x: number, z: number): boolean {
    const k = plotKey(x, z);
    if (this.state[k] === undefined) return false;
    delete this.state[k];
    return true;
  }

  entries(): PlotEntry[] {
    return Object.entries(this.state).map(([key, plantedAt]) => {
      const [xs, zs] = key.split(",");
      return { key, x: Number(xs), z: Number(zs), plantedAt };
    });
  }

  /** Number of plots currently mature at `now`. */
  matureCount(now: number): number {
    return this.entries().filter((e) => isMatureAt(e.plantedAt, now)).length;
  }
}
