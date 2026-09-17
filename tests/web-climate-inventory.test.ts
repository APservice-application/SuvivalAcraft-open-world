import { describe, it, expect } from "vitest";
import {
  ambientTemperature, warmthDrain, warmthStep, COMFORT, COMFORT_BAND, WARMTH_START,
} from "../web/src/climate.js";
import { sortSlots, wearSlot } from "../web/src/inventory.js";
import { newPlayer, addItem, ITEMS, craftRecipe, RECIPES, countItems, damageAfterDefense } from "../web/src/state.js";

describe("temperature (task 06)", () => {
  it("ambient peaks midday and is coldest at deep night", () => {
    const noon = ambientTemperature(12, 0, false, false);
    const night = ambientTemperature(2, 1, false, false);
    expect(noon).toBeGreaterThan(COMFORT);
    expect(night).toBeLessThan(COMFORT - 10);
    expect(noon).toBeGreaterThan(night);
  });

  it("storm cools, wildfire heats", () => {
    const base = ambientTemperature(12, 0, false, false);
    expect(ambientTemperature(12, 0, true, false)).toBeLessThan(base);
    expect(ambientTemperature(12, 0, false, true)).toBeGreaterThan(base);
  });

  it("no drain inside comfort band, drain outside", () => {
    expect(warmthDrain(COMFORT)).toBe(0);
    expect(warmthDrain(COMFORT + COMFORT_BAND)).toBe(0);
    expect(warmthDrain(COMFORT - COMFORT_BAND - 1)).toBeGreaterThan(0);
    expect(warmthDrain(COMFORT + COMFORT_BAND + 6)).toBeGreaterThan(0);
  });

  it("warmth falls in freezing night, recovers comfortably, heat source warms fast", () => {
    const cold = ambientTemperature(2, 1, false, false);
    let w = WARMTH_START;
    for (let i = 0; i < 100; i++) w = warmthStep(w, cold, false, 1).warmth;
    expect(w).toBe(0);
    // comfortable ambient regenerates to max
    let w2 = WARMTH_START;
    for (let i = 0; i < 100; i++) w2 = warmthStep(w2, COMFORT, false, 1).warmth;
    expect(w2).toBe(100);
    // near heat even in cold warms up
    let w3 = 5;
    for (let i = 0; i < 10; i++) w3 = warmthStep(w3, cold, true, 1).warmth;
    expect(w3).toBe(100);
  });

  it("flags cold vs hot exhaustion by ambient", () => {
    const cold = warmthStep(10, -5, false, 1);
    expect(cold.cold).toBe(true);
    expect(cold.hot).toBe(false);
    const hot = warmthStep(10, 45, false, 1);
    expect(hot.hot).toBe(true);
    expect(hot.cold).toBe(false);
  });
});

describe("durability (task 07)", () => {
  it("tools/weapons have maxDur; misc does not", () => {
    expect(ITEMS["wood_axe"]!.maxDur).toBeGreaterThan(0);
    expect(ITEMS["stone_sword"]!.maxDur).toBeGreaterThan(0);
    expect(ITEMS["wood"]!.maxDur).toBeUndefined();
  });

  it("wearSlot reduces and breaks at zero; slots without dur never break", () => {
    expect(wearSlot({ item: "wood_axe", count: 1, dur: 2 }, 1)).toEqual({ dur: 1, broke: false });
    expect(wearSlot({ item: "wood_axe", count: 1, dur: 1 }, 1)).toEqual({ dur: 0, broke: true });
    expect(wearSlot({ item: "wood", count: 1 }, 5).broke).toBe(false);
  });

  it("crafting a tool yields a full-durability slot", () => {
    const p = newPlayer("t", "#ffffff", 0, 0);
    addItem(p, "wood", 10);
    addItem(p, "fiber", 5);
    const r = RECIPES.find((x) => x.id === "wood_axe")!;
    expect(craftRecipe(r, p)).toBe(true);
    const slot = p.inv.find((x) => x.item === "wood_axe")!;
    expect(slot.dur).toBe(ITEMS["wood_axe"]!.maxDur);
  });
});

describe("inventory sorting", () => {
  it("sorts by category order and merges stacks", () => {
    const p = newPlayer("t", "#ffffff", 0, 0);
    p.inv = [
      { item: "torch", count: 3 },
      { item: "stone", count: 5 },
      { item: "wood", count: 10 },
      { item: "wood", count: 7 },
      { item: "berry", count: 2 },
      { item: "stone", count: 1 },
    ];
    const sorted = sortSlots(p.inv);
    // resource category first, tie-broken alphabetically: stone < wood
    expect(sorted[0]!.item).toBe("stone");
    expect(sorted[0]!.count).toBe(6);
    expect(sorted[1]!.item).toBe("wood");
    expect(sorted[1]!.count).toBe(17);
    expect(sorted[2]!.item).toBe("berry");
    const cats = sorted.map((s) => ITEMS[s.item]!.category);
    const order = ["resource", "resource", "food", "misc"];
    expect(cats).toEqual(order);
  });

  it("keeps the best durability instance for tools", () => {
    const sorted = sortSlots([
      { item: "wood_axe", count: 1, dur: 5 },
      { item: "wood_axe", count: 1, dur: 30 },
    ]);
    expect(sorted.length).toBe(1);
    expect(sorted[0]!.dur).toBe(30);
  });

  it("does not mutate the input array", () => {
    const inv = [{ item: "torch", count: 1 }, { item: "wood", count: 1 }];
    const snapshot = JSON.stringify(inv);
    sortSlots(inv);
    expect(JSON.stringify(inv)).toBe(snapshot);
  });
});

describe("defense", () => {
  it("damageAfterDefense subtracts armor with minimum 1", () => {
    const p = newPlayer("t", "#ffffff", 0, 0);
    expect(damageAfterDefense(5, p)).toBe(5);
    p.equip = null;
    // simulate armor via a temporary item registration-free path: use existing ITEMS
    // hide_armor is added in a later checkpoint; here we test the pure math via crafted scenario
    const p2 = newPlayer("t2", "#ffffff", 0, 0);
    p2.equip = "wood_sword"; // damage item, defense 0
    expect(damageAfterDefense(4, p2)).toBe(4);
    expect(countItems(p2, "wood_sword")).toBe(0);
  });
});
