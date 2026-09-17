import { describe, it, expect } from "vitest";
import {
  BUILDABLES, buildableByItem, isDoorTile, toggledDoor, itemForBuildingTile, occupiedTile,
} from "../web/src/building.js";
import { World, T_FENCE, T_WALL, T_DOOR, T_DOOR_OPEN, T_CAMPFIRE, T_GRASS, T_WATER, T_TREE } from "../web/src/world.js";
import { RECIPES, newPlayer, addItem, canCraft, craftRecipe, countItems } from "../web/src/state.js";

describe("building registry", () => {
  it("maps items to distinct tiles", () => {
    const tiles = Object.values(BUILDABLES).map((b) => b.tile);
    expect(new Set(tiles).size).toBe(tiles.length);
    expect(buildableByItem("fence")?.tile).toBe(T_FENCE);
    expect(buildableByItem("wall")?.tile).toBe(T_WALL);
    expect(buildableByItem("door")?.tile).toBe(T_DOOR);
    expect(buildableByItem("campfire")?.tile).toBe(T_CAMPFIRE);
    expect(buildableByItem("wood")).toBeUndefined();
  });

  it("door toggles closed<->open only for door tiles", () => {
    expect(toggledDoor(T_DOOR)).toBe(T_DOOR_OPEN);
    expect(toggledDoor(T_DOOR_OPEN)).toBe(T_DOOR);
    expect(isDoorTile(T_DOOR)).toBe(true);
    expect(isDoorTile(T_DOOR_OPEN)).toBe(true);
    expect(toggledDoor(T_GRASS)).toBeUndefined();
    expect(isDoorTile(T_FENCE)).toBe(false);
  });

  it("breaking placed tiles refunds the item", () => {
    expect(itemForBuildingTile(T_FENCE)).toBe("fence");
    expect(itemForBuildingTile(T_WALL)).toBe("wall");
    expect(itemForBuildingTile(T_DOOR)).toBe("door");
    expect(itemForBuildingTile(T_DOOR_OPEN)).toBe("door");
    expect(itemForBuildingTile(T_CAMPFIRE)).toBe("campfire");
    expect(itemForBuildingTile(T_GRASS)).toBeUndefined();
  });

  it("occupied tiles block placement", () => {
    for (const t of [T_FENCE, T_WALL, T_DOOR, T_DOOR_OPEN, T_CAMPFIRE, T_TREE]) {
      expect(occupiedTile(t)).toBe(true);
    }
    expect(occupiedTile(T_GRASS)).toBe(false);
  });
});

describe("building + world integration", () => {
  it("placed fence blocks movement until broken", () => {
    const w = new World(42);
    // find a deterministic walkable tile
    let x = 0, z = 0;
    outer: for (let tz = 0; tz < 64; tz++) {
      for (let tx = 0; tx < 64; tx++) {
        if (w.isWalkable(tx, tz)) { x = tx; z = tz; break outer; }
      }
    }
    expect(w.isWalkable(x, z)).toBe(true);
    w.setEdit(x, z, T_FENCE);
    expect(w.tileAt(x, z)).toBe(T_FENCE);
    expect(w.isWalkable(x, z)).toBe(false);
    w.removeEdit(x, z);
    expect(w.tileAt(x, z)).not.toBe(T_FENCE);
    expect(w.isWalkable(x, z)).toBe(true);
  });

  it("closed door blocks, open door walkable", () => {
    const w = new World(7);
    w.setEdit(3, 4, T_DOOR);
    expect(w.isWalkable(3, 4)).toBe(false);
    w.setEdit(3, 4, toggledDoor(T_DOOR)!);
    expect(w.isWalkable(3, 4)).toBe(true);
  });

  it("edits survive serialize round-trip", () => {
    const w = new World(9);
    w.setEdit(1, 2, T_WALL);
    w.setEdit(-3, 5, T_FENCE);
    w.setEdit(100, -100, T_DOOR);
    const w2 = new World(999);
    w2.setEdits(w.getEdits());
    expect(w2.tileAt(1, 2)).toBe(T_WALL);
    expect(w2.tileAt(-3, 5)).toBe(T_FENCE);
    expect(w2.tileAt(100, -100)).toBe(T_DOOR);
    expect(w2.getEdits().length).toBe(3);
  });

  it("edit overrides terrain but removal restores it", () => {
    const w = new World(5);
    // find a grass tile deterministically
    let gx = 0, gz = 0;
    outer: for (let z = 0; z < 64; z++) {
      for (let x = 0; x < 64; x++) {
        if (w.tileAt(x, z) === T_GRASS) { gx = x; gz = z; break outer; }
      }
    }
    const base = w.tileAt(gx, gz);
    w.setEdit(gx, gz, T_CAMPFIRE);
    expect(w.tileAt(gx, gz)).toBe(T_CAMPFIRE);
    expect(w.hasEdit(gx, gz)).toBe(true);
    w.removeEdit(gx, gz);
    expect(w.tileAt(gx, gz)).toBe(base);
  });

  it("water can never be a placed-building tile via occupied/walkable rules", () => {
    const w = new World(3);
    // scan for a water tile
    let wx = -1, wz = -1;
    outer: for (let z = -64; z < 64; z++) {
      for (let x = -64; x < 64; x++) {
        if (w.tileAt(x, z) === T_WATER) { wx = x; wz = z; break outer; }
      }
    }
    if (wx >= 0) {
      expect(w.isWalkable(wx, wz)).toBe(false);
      expect(itemForBuildingTile(T_WATER)).toBeUndefined();
    }
  });
});

describe("building recipes", () => {
  it("all buildables have a recipe", () => {
    for (const id of Object.keys(BUILDABLES)) {
      expect(RECIPES.some((r) => r.out.item === id)).toBe(true);
    }
  });

  it("fence is craftable from wood and consumes it transactionally", () => {
    const p = newPlayer("t", "#fff000", 0, 0);
    // newPlayer starts with 5 wood; add 3 more
    addItem(p, "wood", 3);
    expect(countItems(p, "wood")).toBe(8);
    const r = RECIPES.find((x) => x.id === "fence")!;
    expect(canCraft(r, p)).toBe(true);
    expect(craftRecipe(r, p)).toBe(true);
    expect(countItems(p, "fence")).toBe(2);
    expect(countItems(p, "wood")).toBe(6);
  });
});
