import { describe, it, expect } from "vitest";
import { mergeContentPack, packFromStorage, type ContentPack } from "../web/src/content.js";
import { ITEMS, RECIPES, newPlayer, equippedDefense, damageAfterDefense } from "../web/src/state.js";
import { ENEMY_KINDS, enemyStats, rollEnemyKind, shouldSpawnBoss } from "../web/src/bestiary.js";
import { World, T_SNOW, T_GRASS, T_WATER } from "../web/src/world.js";

describe("content pack (task 17)", () => {
  const pack: ContentPack = {
    name: "test-pack",
    items: [
      { id: "wood", name: "ไม้มหาศาล", category: "resource", icon: "🪵", stack: 99 }, // override
      { id: "crystal", name: "คริสตัล", category: "misc", icon: "💎", stack: 9 },      // new
    ],
    recipes: [
      { id: "crystal_blade", name: "ดาบคริสตัล", icon: "🔪", out: { item: "crystal", count: 1 }, needs: [{ item: "wood", count: 2 }] },
      { id: "bad_recipe", name: "ใช้ไม่ได้", icon: "❌", out: { item: "no_such_item", count: 1 }, needs: [{ item: "wood", count: 1 }] },
      { id: "wood_axe", name: "ซ้ำ", icon: "🪓", out: { item: "wood", count: 1 }, needs: [{ item: "stone", count: 1 }] }, // duplicate id
    ],
  };

  it("merges without mutating base registries", () => {
    const baseItem = { ...ITEMS["wood"]! };
    const baseRecipes = RECIPES.length;
    const res = mergeContentPack(ITEMS, RECIPES, pack);
    // base untouched
    expect(ITEMS["wood"]!.name).toBe(baseItem.name);
    expect(RECIPES.length).toBe(baseRecipes);
    // merged view
    expect(res.itemsAdded).toBe(1);
    expect(res.itemsOverridden).toBe(1);
    expect(res.recipesAdded).toBe(1); // bad out-item + duplicate id are skipped
    expect(res.items["crystal"]).toBeDefined();
    expect(res.items["wood"]!.name).toBe("ไม้มหาศาล");
    expect(res.items["wood"]!.stack).toBe(99);
    expect(res.recipes.some((r) => r.id === "crystal_blade")).toBe(true);
    expect(res.recipes.some((r) => r.id === "bad_recipe")).toBe(false);
    expect(res.recipes.filter((r) => r.id === "wood_axe").length).toBe(1);
  });

  it("packFromStorage rejects garbage and accepts valid JSON", () => {
    expect(packFromStorage(null)).toBeNull();
    expect(packFromStorage("not json")).toBeNull();
    expect(packFromStorage(JSON.stringify({ nope: 1 }))).toBeNull();
    expect(packFromStorage(JSON.stringify({ name: "x" }))?.name).toBe("x");
  });
});

describe("bestiary", () => {
  it("all kinds have sane stats; boss flagged once", () => {
    for (const k of Object.values(ENEMY_KINDS)) {
      expect(k.hp).toBeGreaterThan(0);
      expect(k.dmg).toBeGreaterThan(0);
      expect(k.spd).toBeGreaterThan(0);
      expect(k.xp).toBeGreaterThan(0);
      expect(k.size).toBeGreaterThan(0);
    }
    expect(ENEMY_KINDS.slime_king!.boss).toBe(true);
    expect(Object.values(ENEMY_KINDS).filter((k) => k.boss).length).toBe(1);
    expect(ENEMY_KINDS.slime_king!.gold).toBeGreaterThan(ENEMY_KINDS.brute!.gold!);
  });

  it("enemyStats falls back to slime", () => {
    expect(enemyStats("nonexistent").kind).toBe("slime");
    expect(enemyStats("brute").kind).toBe("brute");
  });

  it("rollEnemyKind matches night/day mixtures for many draws", () => {
    let nightKinds = new Set<string>(), dayKinds = new Set<string>();
    for (let i = 0; i < 300; i++) {
      nightKinds.add(rollEnemyKind(true, Math.random()));
      dayKinds.add(rollEnemyKind(false, Math.random()));
    }
    expect(nightKinds.has("brute")).toBe(true);      // night-only
    expect(dayKinds.has("brute")).toBe(false);       // never in day
    expect(dayKinds.has("slime")).toBe(true);
  });

  it("boss spawns on night of day%3, once per day", () => {
    expect(shouldSpawnBoss(3, true, null)).toBe(true);
    expect(shouldSpawnBoss(3, false, null)).toBe(false);
    expect(shouldSpawnBoss(3, true, 3)).toBe(false);   // already spawned today
    expect(shouldSpawnBoss(6, true, 3)).toBe(true);    // new day
    expect(shouldSpawnBoss(4, true, null)).toBe(false); // not a boss day
  });
});

describe("new content", () => {
  it("hide_armor exists, is armor with defense, and reduces damage", () => {
    const armor = ITEMS["hide_armor"]!;
    expect(armor.category).toBe("armor");
    expect(armor.defense).toBeGreaterThan(0);
    expect(armor.maxDur).toBeGreaterThan(0);
    const p = newPlayer("t", "#fff", 0, 0);
    expect(equippedDefense(p)).toBe(0);
    p.armor = { chest: "hide_armor" }; // CP-019: เกราะสวมในช่อง chest
    expect(equippedDefense(p)).toBe(2);
    expect(damageAfterDefense(8, p)).toBe(6);
    expect(damageAfterDefense(2, p)).toBe(1); // min 1
    expect(RECIPES.some((r) => r.id === "hide_armor")).toBe(true);
  });

  it("snow patches generate, are walkable, and distinct from water", () => {
    const w = new World(77);
    let found = false;
    outer: for (let cz = 0; cz < 4; cz++) {
      for (let cx = 0; cx < 4; cx++) {
        for (let z = cz * 24; z < (cz + 1) * 24; z++) {
          for (let x = cx * 24; x < (cx + 1) * 24; x++) {
            const t = w.tileAt(x, z);
            if (t === T_SNOW) {
              found = true;
              expect(w.isWalkable(x, z)).toBe(true);
              break outer;
            }
          }
        }
      }
    }
    expect(found).toBe(true);
    expect(w.isWalkable(0, 0) === false && w.tileAt(0, 0) === T_GRASS).toBe(false);
    // sanity: world still has water somewhere in a big area
    let hasWater = false;
    for (let z = -48; z < 96 && !hasWater; z += 2) {
      for (let x = -48; x < 96; x += 2) {
        if (w.tileAt(x, z) === T_WATER) { hasWater = true; break; }
      }
    }
    expect(hasWater).toBe(true);
  });
});
