import { describe, it, expect } from "vitest";
import {
  QUEST_DEFS, questDefById, isUnlocked, QuestLog,
} from "../web/src/quests.js";
import { SFX_PROFILES, Sfx, type SfxName } from "../web/src/audio.js";
import { SaveManager, MemoryKV, migrateV1 } from "../web/src/saves.js";
import { newPlayer } from "../web/src/state.js";

describe("quest chain", () => {
  it("defs form a valid chain (after references existing ids)", () => {
    const ids = new Set(QUEST_DEFS.map((q) => q.id));
    for (const q of QUEST_DEFS) {
      expect(q.target).toBeGreaterThan(0);
      expect(q.rewardXp).toBeGreaterThan(0);
      if (q.after) expect(ids.has(q.after)).toBe(true);
    }
    // new objective types exist
    expect(ids.has("explore")).toBe(true);
    expect(ids.has("talk_merchant")).toBe(true);
    expect(ids.has("boss")).toBe(true);
    // boss is at the end of its chain
    expect(questDefById("boss")!.after).toBe("talk_merchant");
  });

  it("only unlocked quests are active at start", () => {
    const log = new QuestLog();
    const active = log.active();
    expect(active.every((q) => isUnlocked(q, log.done))).toBe(true);
    expect(active.some((q) => q.id === "gather_wood")).toBe(true);
    expect(active.some((q) => q.id === "craft_tool")).toBe(false); // after gather_wood
    expect(log.lockedCount()).toBeGreaterThan(0);
  });

  it("progress on a locked quest is rejected", () => {
    const log = new QuestLog();
    expect(log.progressQuest("boss", 1)).toBeNull();
    expect(log.progress["boss"]).toBeUndefined();
  });

  it("completing a quest unlocks the next and pays defined rewards", () => {
    const log = new QuestLog();
    const gw = questDefById("gather_wood")!;
    // partial
    expect(log.progressQuest("gather_wood", 3)).toBeNull();
    expect(log.progress["gather_wood"]).toBe(3);
    // finish
    const finished = log.progressQuest("gather_wood", 2);
    expect(finished?.id).toBe("gather_wood");
    expect(finished!.rewardXp).toBe(gw.rewardXp);
    expect(log.done["gather_wood"]).toBe(true);
    // next in chain unlocks
    expect(log.active().some((q) => q.id === "craft_tool")).toBe(true);
    // extra progress after done is ignored (no double reward)
    expect(log.progressQuest("gather_wood", 5)).toBeNull();
  });

  it("explore quest counts zones up to target", () => {
    const log = new QuestLog();
    // explore needs gather_wood done first
    log.progressQuest("gather_wood", 999);
    let finished = null;
    for (let i = 1; i <= 5 && !finished; i++) {
      finished = log.progressQuest("explore", 1);
    }
    expect(finished?.id).toBe("explore");
    expect(questDefById("explore")!.target).toBe(4);
  });

  it("reset clears everything", () => {
    const log = new QuestLog();
    log.progressQuest("gather_wood", 999);
    log.reset();
    expect(log.active().length).toBeGreaterThan(0);
    expect(Object.keys(log.done).length).toBe(0);
  });

  it("quest progress round-trips through the save system", async () => {
    const mgr = new SaveManager(new MemoryKV());
    const meta = await mgr.createWorld("q", 1);
    const p = newPlayer("t", "#fff", 0, 0);
    const save = {
      v: 2 as const, meta, time: 6, dayCount: 1, gameSeconds: 0, player: p,
      edits: [], crops: {},
      quests: { progress: { gather_wood: 5 }, done: { gather_wood: true } },
      zones: ["0,0", "1,0"],
      savedAt: Date.now(),
    };
    await mgr.saveWorld(save);
    const loaded = await mgr.loadWorld(meta.id);
    expect(loaded!.quests!.done["gather_wood"]).toBe(true);
    expect(loaded!.zones).toEqual(["0,0", "1,0"]);
    // legacy saves without quests still load
    const legacy = migrateV1(JSON.stringify({ v: 1, p, seed: 2, time: 6 }));
    expect(legacy!.quests).toBeUndefined();
  });
});

describe("audio profiles", () => {
  it("every sfx name has a sane profile", () => {
    const names: SfxName[] = ["attack", "kill", "craft", "place", "eat", "harvest", "levelup", "hurt", "quest", "pickup", "click"];
    for (const n of names) {
      const p = SFX_PROFILES[n];
      expect(p.dur, n).toBeGreaterThan(0);
      expect(p.gain, n).toBeGreaterThan(0);
      expect(p.gain, n).toBeLessThanOrEqual(0.15);
      expect(["square", "sawtooth", "triangle", "sine"], n).toContain(p.type);
      if (p.endFreq !== undefined) expect(p.endFreq, n).toBeGreaterThan(0);
    }
  });

  it("Sfx.play is a safe no-op before unlock and when muted", () => {
    const s = new Sfx();
    expect(() => s.play("craft")).not.toThrow();
    s.unlock();
    s.muted = true;
    expect(() => s.play("quest")).not.toThrow();
  });
});
