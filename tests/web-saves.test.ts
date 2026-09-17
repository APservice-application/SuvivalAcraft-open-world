import { describe, it, expect } from "vitest";
import {
  MemoryKV, LocalStorageKV, SaveManager, migrateV1,
  LEGACY_ID, LEGACY_KEY, SAVE_VERSION,
  type WorldSaveV2,
} from "../web/src/saves.js";
import { newPlayer } from "../web/src/state.js";

describe("MemoryKV", () => {
  it("get/set/del/keys round-trip", async () => {
    const kv = new MemoryKV();
    expect(await kv.get("a")).toBeNull();
    await kv.set("a", "1");
    await kv.set("b", "2");
    expect(await kv.get("a")).toBe("1");
    expect((await kv.keys()).sort()).toEqual(["a", "b"]);
    await kv.del("a");
    expect(await kv.get("a")).toBeNull();
  });
});

describe("LocalStorageKV", () => {
  it("wraps a localStorage-like object with graceful failure", async () => {
    const backing = new Map<string, string>();
    const fake = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => { backing.set(k, v); },
      removeItem: (k: string) => { backing.delete(k); },
      key: (i: number) => [...backing.keys()][i] ?? null,
      get length() { return backing.size; },
    };
    const kv = new LocalStorageKV(fake);
    await kv.set("x", "y");
    expect(await kv.get("x")).toBe("y");
    expect(await kv.keys()).toEqual(["x"]);
    await kv.del("x");
    expect(await kv.get("x")).toBeNull();
  });

  it("throws when storage is unavailable", () => {
    expect(() => new LocalStorageKV(undefined)).toThrow();
  });
});

describe("SaveManager", () => {
  it("create/list/load/save/delete multi-world flow", async () => {
    const kv = new MemoryKV();
    const mgr = new SaveManager(kv);
    expect(await mgr.listWorlds()).toEqual([]);

    const w1 = await mgr.createWorld("โลกหนึ่ง", 111);
    const w2 = await mgr.createWorld("โลกสอง", 222);
    expect((await mgr.listWorlds()).length).toBe(2);

    const save: WorldSaveV2 = {
      v: SAVE_VERSION,
      meta: w1,
      time: 8.5,
      dayCount: 3,
      gameSeconds: 720,
      player: newPlayer("เอ", "#fff000", 1, 2),
      edits: [[1, 2, 12]],
      crops: { "3,4": { crop: "wheat", plantedAt: 100 } },
      savedAt: Date.now(),
    };
    await mgr.saveWorld(save);
    // updatedAt bumped and index synced
    const after = (await mgr.listWorlds()).find((m) => m.id === w1.id)!;
    expect(after.updatedAt).toBeGreaterThanOrEqual(w1.updatedAt);

    const loaded = await mgr.loadWorld(w1.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.name).toBe("โลกหนึ่ง");
    expect(loaded!.player.name).toBe("เอ");
    expect(loaded!.edits).toEqual([[1, 2, 12]]);
    expect(loaded!.crops["3,4"]).toEqual({ crop: "wheat", plantedAt: 100 });

    await mgr.deleteWorld(w2.id);
    expect((await mgr.listWorlds()).map((m) => m.id)).toEqual([w1.id]);
    expect(await mgr.loadWorld(w2.id)).toBeNull();
  });

  it("loadWorld returns null for corrupt data", async () => {
    const kv = new MemoryKV();
    const mgr = new SaveManager(kv);
    await kv.set("suvival:world:bad", "{{{not json");
    expect(await mgr.loadWorld("bad")).toBeNull();
    await kv.set("suvival:world:bad2", JSON.stringify({ v: 99 }));
    expect(await mgr.loadWorld("bad2")).toBeNull();
    expect(await mgr.loadWorld("missing")).toBeNull();
  });

  it("migrateLegacy imports v1 slot once", async () => {
    const legacy = JSON.stringify({
      v: 1,
      p: newPlayer("เก่า", "#00ff00", 5, 6),
      seed: 424242,
      time: 13.5,
      savedAt: 1,
    });
    const backing: Record<string, string> = { [LEGACY_KEY]: legacy };
    const kv = new MemoryKV();
    const mgr = new SaveManager(kv, () => backing[LEGACY_KEY] ?? null);

    const meta = await mgr.migrateLegacy();
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe(LEGACY_ID);
    const loaded = await mgr.loadWorld(LEGACY_ID);
    expect(loaded!.player.name).toBe("เก่า");
    expect(loaded!.meta.seed).toBe(424242);
    expect(loaded!.time).toBe(13.5);
    expect(loaded!.edits).toEqual([]);

    // second run: no duplicate migration
    expect(await mgr.migrateLegacy()).toBeNull();
    expect((await mgr.listWorlds()).filter((m) => m.id === LEGACY_ID).length).toBe(1);
  });

  it("migrateLegacy does nothing without legacy data", async () => {
    const mgr = new SaveManager(new MemoryKV(), () => null);
    expect(await mgr.migrateLegacy()).toBeNull();
    expect(await mgr.listWorlds()).toEqual([]);
  });
});

describe("migrateV1 (pure)", () => {
  it("converts a valid v1 payload to v2", () => {
    const now = 1_700_000_000_000;
    const p = newPlayer("t", "#ffffff", 9, 9);
    const out = migrateV1(JSON.stringify({ v: 1, p, seed: 7, time: 3.25, savedAt: 0 }), now);
    expect(out).not.toBeNull();
    expect(out!.v).toBe(2);
    expect(out!.meta.id).toBe(LEGACY_ID);
    expect(out!.meta.seed).toBe(7);
    expect(out!.time).toBe(3.25);
    expect(out!.player.level).toBe(p.level);
    expect(out!.dayCount).toBe(1);
    expect(out!.gameSeconds).toBe(0);
  });

  it("rejects invalid payloads", () => {
    expect(migrateV1("not json")).toBeNull();
    expect(migrateV1(JSON.stringify({ v: 2 }))).toBeNull();
    expect(migrateV1(JSON.stringify({ v: 1, seed: 1 }))).toBeNull(); // no player
  });
});
