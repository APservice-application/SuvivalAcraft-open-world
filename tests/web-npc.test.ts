import { describe, it, expect } from "vitest";
import {
  NPC_DEFS, npcById, SHOP_STOCK, SELLABLE,
  buyPrice, sellPrice, applyBuy, applySell, repairCost, applyRepair, villageNpcs,
} from "../web/src/npc.js";
import { ITEMS, newPlayer, addItem, countItems, equipArmorFromSlot } from "../web/src/state.js";

describe("NPC village (CP-020)", () => {
  it("มี NPC ครบ 3 ตัว: elder/merchant/blacksmith พร้อม dialogue options", () => {
    const ids = NPC_DEFS.map((n) => n.id);
    expect(ids).toEqual(["elder", "merchant", "blacksmith"]);
    for (const n of NPC_DEFS) {
      expect(n.name.length).toBeGreaterThan(0);
      expect(n.greeting.length).toBeGreaterThan(0);
      expect(n.options.length).toBeGreaterThan(0);
    }
    expect(npcById("elder")?.options.some((o) => o.action === "gift" && o.once)).toBe(true);
    expect(npcById("merchant")?.options.some((o) => o.action === "shop")).toBe(true);
    expect(npcById("blacksmith")?.options.some((o) => o.action === "repair")).toBe(true);
  });

  it("ตำแหน่ง NPC อยู่ในหมู่บ้าน และไม่ซ้ำกัน", () => {
    const npcs = villageNpcs();
    expect(npcs).toHaveLength(3);
    const seen = new Set<string>();
    for (const n of npcs) {
      const k = `${n.x},${n.z}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it("ราคาร้านค้า: ทุก stock มีใน ITEMS + sellPrice = ครึ่งซื้อปัดลง ขั้นต่ำ 1", () => {
    for (const s of SHOP_STOCK) {
      expect(ITEMS[s.item], s.item).toBeDefined();
      expect(s.price).toBeGreaterThan(0);
    }
    expect(buyPrice("meat_cooked")).toBe(8);
    expect(sellPrice("meat_cooked")).toBe(4);
    expect(sellPrice("torch")).toBe(1); // ซื้อ 3 → ขาย 1.5 → 1
    expect(sellPrice("wood")).toBe(1); // ของธรรมชาติ
    expect(sellPrice("wood_sword")).toBeUndefined(); // ไม่อยู่ใน SELLABLE
    expect(buyPrice("nothing_xyz")).toBeUndefined();
    expect(SELLABLE.length).toBeGreaterThan(5);
  });

  it("applyBuy ตัด gold เพิ่มของ / ไม่ซื้อเมื่อเงินไม่พอหรือกระเป๋าเต็ม", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    p.gold = 10;
    const r = applyBuy(p, "meat_cooked");
    expect(r.ok).toBe(true);
    expect(r.player.gold).toBe(2);
    expect(countItems(r.player, "meat_cooked")).toBe(1);
    expect(countItems(p, "meat_cooked")).toBe(0); // ต้นฉบับไม่ถูกแก้ (pure)
    expect(applyBuy(p, "hide_armor").ok).toBe(false); // เงินไม่พอ
    // กระเป๋าเต็ม
    const p2 = newPlayer("t2", "#fff", 0, 0);
    p2.gold = 100;
    p2.inv = Array.from({ length: 24 }, (_, i) => ({ item: "wood", count: i + 1 }));
    const r2 = applyBuy(p2, "torch");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toContain("เต็ม");
  });

  it("applySell ได้ gold และของหาย / ขายไม่ได้เมื่อไม่มีของ", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    p.gold = 0;
    p.inv = []; // เคลียร์ของเริ่มต้นออกก่อน
    addItem(p, "wood", 5);
    const r = applySell(p, "wood");
    expect(r.ok).toBe(true);
    expect(r.gain).toBe(1);
    expect(r.player.gold).toBe(1);
    expect(countItems(r.player, "wood")).toBe(4);
    expect(applySell(p, "wood").ok).toBe(true);
    expect(applySell(r.player, "berry").ok).toBe(false); // ไม่มี
    expect(applySell(p, "wood_sword").ok).toBe(false); // ขายไม่ได้
  });

  it("repairCost: คิดจาก inv dur + armor slots / ซ่อมเมื่อมีเงินพอ", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    expect(repairCost(p)).toEqual({ cost: 0, broken: 0, items: 0 });
    const swordMax = ITEMS["wood_sword"]!.maxDur!;
    const armorMax = ITEMS["hide_armor"]!.maxDur!;
    p.inv = [{ item: "wood_sword", count: 1, dur: swordMax - 10 }];
    let rc = repairCost(p);
    expect(rc.broken).toBe(1);
    expect(rc.cost).toBe(5); // ceil(10/2)
    p.armor = { chest: "hide_armor" };
    p.armorDur = { chest: armorMax - 30 };
    rc = repairCost(p);
    expect(rc.items).toBe(2);
    expect(rc.cost).toBe(20); // ceil(40/2)
    // เงินไม่พอ
    p.gold = 5;
    const fail = applyRepair(p);
    expect(fail.ok).toBe(false);
    // เงินพอ → ซ่อมเต็ม
    p.gold = 100;
    const ok = applyRepair(p);
    expect(ok.ok).toBe(true);
    expect(ok.cost).toBe(20);
    expect(ok.player.inv[0]!.dur).toBe(swordMax);
    expect(ok.player.armorDur.chest).toBe(armorMax);
    expect(ok.player.gold).toBe(80);
    // ซ่อมซ้ำ = ไม่มีอะไรให้ซ่อม
    expect(applyRepair(ok.player).reason).toContain("สมบูรณ์");
  });

  it("ซ่อมอุปกรณ์ที่สวมอยู่ผ่าน armorDur ได้จริง (end-to-end: equip → wear → repair)", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    const armorMax = ITEMS["hide_armor"]!.maxDur!;
    p.inv = [{ item: "hide_armor", count: 1, dur: armorMax }];
    equipArmorFromSlot(p, 0);
    p.armorDur.chest = 5;
    p.gold = 100;
    const r = applyRepair(p);
    expect(r.ok).toBe(true);
    expect(r.player.armorDur.chest).toBe(armorMax);
  });
});
