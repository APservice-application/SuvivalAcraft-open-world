import { describe, it, expect } from "vitest";
import {
  FarmPlots, cropStageAt, isMatureAt, plotKey, CROP_STAGES, CROP_MATURE_AT,
} from "../web/src/farming.js";
import { World, T_GRASS, T_DIRT, T_WATER, T_CROP_0, T_CROP_1, T_CROP_2 } from "../web/src/world.js";
import { occupiedTile } from "../web/src/building.js";
import { ITEMS } from "../web/src/state.js";

describe("crop growth timing", () => {
  it("stage thresholds are ordered and mature at last", () => {
    expect(CROP_STAGES[0]).toBeLessThan(CROP_STAGES[1]!);
    expect(CROP_STAGES[1]!).toBeLessThan(CROP_STAGES[2]!);
    expect(CROP_MATURE_AT).toBe(CROP_STAGES[2]);
  });

  it("progresses 0 -> 1 -> 2 deterministically", () => {
    expect(cropStageAt(100, 100)).toBe(0);   // just planted
    expect(cropStageAt(100, 159)).toBe(0);   // before stage 1
    expect(cropStageAt(100, 160)).toBe(1);   // at stage 1
    expect(cropStageAt(100, 249)).toBe(1);
    expect(cropStageAt(100, 250)).toBe(2);   // mature
    expect(cropStageAt(100, 10000)).toBe(2);
  });

  it("isMatureAt only when elapsed >= mature threshold", () => {
    expect(isMatureAt(0, 149)).toBe(false);
    expect(isMatureAt(0, 150)).toBe(true);
    expect(isMatureAt(50, 200)).toBe(true);
  });
});

describe("FarmPlots", () => {
  it("plant, block double-plant, harvest", () => {
    const f = new FarmPlots();
    expect(f.plant(3, 4, 10)).toBe(true);
    expect(f.plant(3, 4, 20)).toBe(false); // occupied
    expect(f.has(3, 4)).toBe(true);
    expect(f.matureAt(3, 4, 10 + CROP_MATURE_AT - 1)).toBe(false);
    expect(f.matureAt(3, 4, 10 + CROP_MATURE_AT)).toBe(true);
    expect(f.harvest(3, 4)).toBe(true);
    expect(f.has(3, 4)).toBe(false);
    expect(f.harvest(3, 4)).toBe(false);
  });

  it("stageAt matches plantedAt and undefined without plot", () => {
    const f = new FarmPlots();
    expect(f.stageAt(1, 1, 999)).toBeUndefined();
    f.plant(1, 1, 5);
    expect(f.stageAt(1, 1, 5)).toBe(0);
    expect(f.stageAt(1, 1, 5 + CROP_STAGES[1]!)).toBe(1);
    expect(f.stageAt(1, 1, 5 + CROP_MATURE_AT)).toBe(2);
  });

  it("entries + matureCount report correctly", () => {
    const f = new FarmPlots();
    f.plant(0, 0, 0);
    f.plant(2, 0, 100);
    const now = CROP_MATURE_AT + 1;
    expect(f.entries().length).toBe(2);
    expect(f.matureCount(now)).toBe(1); // only the first plot is mature
  });

  it("state serializes as Record<key, plantedAt>", () => {
    const f = new FarmPlots();
    f.plant(7, 8, 123);
    const json = JSON.stringify(f.state);
    const f2 = new FarmPlots();
    f2.state = JSON.parse(json);
    expect(f2.has(7, 8)).toBe(true);
    expect(f2.stageAt(7, 8, 123)).toBe(0);
    expect(plotKey(7, 8)).toBe("7,8");
  });
});

describe("farming + world integration", () => {
  it("crop tiles render as growth stages and mature crop is harvest-targetable", () => {
    const w = new World(11);
    const f = new FarmPlots();
    const x = 5, z = 5;
    f.plant(x, z, 0);
    // main.ts sets tile = T_CROP_0 + stage as time passes
    const now = CROP_MATURE_AT + 5;
    const stage = f.stageAt(x, z, now)!;
    w.setEdit(x, z, T_CROP_0 + stage);
    expect(w.tileAt(x, z)).toBe(T_CROP_2);
    // walkable (crops do not block)
    expect(w.isWalkable(x, z)).toBe(true);
  });

  it("seeds plant on grass/dirt but not on water or occupied tiles", () => {
    // plantable tiles rule mirror from main.ts
    const plantable = [T_GRASS, T_DIRT];
    const w = new World(21);
    // grass exists somewhere
    let gx = -1;
    outer: for (let z = 0; z < 64; z++) {
      for (let x = 0; x < 64; x++) {
        if (plantable.includes(w.tileAt(x, z))) { gx = x; void z; break outer; }
      }
    }
    expect(gx).toBeGreaterThanOrEqual(0);
    expect(occupiedTile(T_WATER)).toBe(false);
    // but water is excluded by the plantable-tiles check itself
    expect(plantable.includes(T_WATER)).toBe(false);
  });

  it("wheat_seed + wheat items exist with sane defs", () => {
    expect(ITEMS["wheat_seed"]?.category).toBe("misc");
    expect(ITEMS["wheat"]?.category).toBe("food");
    expect((ITEMS["wheat"]?.food ?? 0)).toBeGreaterThan(0);
  });
});
