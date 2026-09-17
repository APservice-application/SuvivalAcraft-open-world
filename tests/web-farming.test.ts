import { describe, it, expect } from "vitest";
import {
  FarmPlots, CROPS, cropBySeedItem, cropStageAt, isMature, normalizePlot,
  plotKey, FERT_MULT, type WebCrop,
} from "../web/src/farming.js";
import { World, T_CROP_0, T_CROP_2 } from "../web/src/world.js";
import { occupiedTile } from "../web/src/building.js";
import { ITEMS } from "../web/src/state.js";

function matureIn(crop: WebCrop, fert = false): number {
  return crop.stages[2] / (fert ? FERT_MULT : 1);
}

describe("crop registry", () => {
  it("wheat + corn with distinct timings and yields", () => {
    expect(Object.keys(CROPS).sort()).toEqual(["corn", "wheat"]);
    expect(CROPS.wheat!.stages[2]).toBeLessThan(CROPS.corn!.stages[2]);
    expect(CROPS.corn!.harvestMax).toBeGreaterThanOrEqual(CROPS.wheat!.harvestMax);
    expect(cropBySeedItem("wheat_seed")!.id).toBe("wheat");
    expect(cropBySeedItem("corn_seed")!.id).toBe("corn");
    expect(cropBySeedItem("wood")).toBeUndefined();
  });
});

describe("crop growth timing", () => {
  it("stage thresholds ordered, mature last", () => {
    for (const c of Object.values(CROPS)) {
      expect(c.stages[0]).toBeLessThan(c.stages[1]!);
      expect(c.stages[1]!).toBeLessThan(c.stages[2]!);
    }
  });

  it("progresses 0->1->2 deterministically (wheat)", () => {
    expect(cropStageAt(100, 100)).toBe(0);
    expect(cropStageAt(100, 159)).toBe(0);
    expect(cropStageAt(100, 160)).toBe(1);
    expect(cropStageAt(100, 250)).toBe(2);
  });

  it("fertilizer accelerates growth to maturity", () => {
    const wheat = CROPS.wheat!;
    const t = matureIn(wheat);
    expect(isMature(wheat, 0, t - 1, false)).toBe(false);
    expect(isMature(wheat, 0, t, true)).toBe(true); // fert reaches sooner
    expect(isMature(wheat, 0, Math.ceil(t / FERT_MULT), true)).toBe(true);
  });
});

describe("FarmPlots v2", () => {
  it("plant with crop id, block double-plant, fertilize once, harvest", () => {
    const f = new FarmPlots();
    expect(f.plant(3, 4, "corn", 10)).toBe(true);
    expect(f.plant(3, 4, "wheat", 20)).toBe(false);
    expect(f.has(3, 4)).toBe(true);
    expect(f.cropAt(3, 4)!.id).toBe("corn");
    expect(f.fertilize(3, 4)).toBe(true);
    expect(f.fertilize(3, 4)).toBe(false); // ครั้งเดียว
    const t = matureIn(CROPS.corn!, true); // แปลงนี้โดนปุ๋ยแล้ว
    expect(f.matureAt(3, 4, 10 + t - 1)).toBe(false);
    expect(f.matureAt(3, 4, 10 + t)).toBe(true);
    const crop = f.harvest(3, 4);
    expect(crop!.id).toBe("corn");
    expect(f.has(3, 4)).toBe(false);
    expect(f.harvest(3, 4)).toBeNull();
  });

  it("stageAt matches crop-specific thresholds and fert", () => {
    const f = new FarmPlots();
    f.plant(1, 1, "corn", 0);
    expect(f.stageAt(1, 1, 0)).toBe(0);
    expect(f.stageAt(1, 1, 89)).toBe(0);
    expect(f.stageAt(1, 1, 90)).toBe(1);
    expect(f.stageAt(1, 1, 219)).toBe(1);
    expect(f.stageAt(1, 1, 220)).toBe(2);
    f2: {
      const f2 = new FarmPlots();
      f2.plant(2, 2, "corn", 0);
      f2.fertilize(2, 2);
      // fert elapsed counts 1.6x: stage 1 at 90/1.6 = 56.25
      expect(f2.stageAt(2, 2, 57)).toBe(1);
    }
  });

  it("entries + matureCount per crop", () => {
    const f = new FarmPlots();
    f.plant(0, 0, "wheat", 0);
    f.plant(2, 0, "corn", 0);
    const now = CROPS.wheat!.stages[2] + 1;
    expect(f.entries().length).toBe(2);
    expect(f.matureCount(now)).toBe(1); // corn ยังไม่สุก
  });

  it("normalizePlot migrates legacy number plots and rejects junk", () => {
    expect(normalizePlot(123)).toEqual({ crop: "wheat", plantedAt: 123 });
    expect(normalizePlot({ crop: "corn", plantedAt: 5 })).toEqual({ crop: "corn", plantedAt: 5 });
    expect(normalizePlot({ crop: "corn", plantedAt: 5, fert: true })).toEqual({ crop: "corn", plantedAt: 5, fert: true });
    expect(normalizePlot("junk")).toBeNull();
    expect(normalizePlot({ crop: "nope", plantedAt: 1 })).toBeNull();
  });

  it("loadFrom accepts mixed legacy/new save payloads", () => {
    const f = new FarmPlots();
    f.loadFrom({ "1,1": 42, "2,2": { crop: "corn", plantedAt: 7 }, "3,3": "bad" });
    expect(f.has(1, 1)).toBe(true);
    expect(f.cropAt(1, 1)!.id).toBe("wheat");
    expect(f.cropAt(2, 2)!.id).toBe("corn");
    expect(f.has(3, 3)).toBe(false);
  });
});

describe("farming + world integration", () => {
  it("mature crop tile syncs and remains walkable", () => {
    const w = new World(11);
    const f = new FarmPlots();
    f.plant(5, 5, "wheat", 0);
    const stage = f.stageAt(5, 5, CROPS.wheat!.stages[2] + 5)!;
    w.setEdit(5, 5, T_CROP_0 + stage);
    expect(w.tileAt(5, 5)).toBe(T_CROP_2);
    expect(w.isWalkable(5, 5)).toBe(true);
  });

  it("plantable excludes water/occupied", () => {
    const plantable = [0, 1, 2]; // grass, grass_alt, dirt
    expect(plantable.includes(4)).toBe(false);
    expect(occupiedTile(4)).toBe(false);
    expect(plotKey(7, 8)).toBe("7,8");
  });

  it("seed/fertilizer/corn items exist with sane defs", () => {
    expect(ITEMS["corn_seed"]?.category).toBe("misc");
    expect(ITEMS["corn"]?.category).toBe("food");
    expect((ITEMS["corn"]?.food ?? 0)).toBeGreaterThan(0);
    expect(ITEMS["fertilizer"]?.category).toBe("misc");
  });
});
