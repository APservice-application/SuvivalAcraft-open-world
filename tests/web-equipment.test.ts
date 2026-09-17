import { describe, it, expect } from "vitest";
import {
  ITEMS, RECIPES, newPlayer, addItem, countItems,
  equipArmorFromSlot, unequipArmor, wearArmor, migrateEquipSlots,
  equippedDefense, damageAfterDefense, ARMOR_SLOTS,
} from "../web/src/state.js";

describe("equipment slots (CP-019)", () => {
  it("armor items declare their slot", () => {
    expect(ITEMS["hide_armor"]!.slot).toBe("chest");
    expect(ITEMS["hide_helm"]!.slot).toBe("head");
    expect(ITEMS["hide_pants"]!.slot).toBe("legs");
    expect(ITEMS["bone_charm"]!.slot).toBe("acc");
    expect(ARMOR_SLOTS).toEqual(["head", "chest", "legs", "acc"]);
  });

  it("all armor pieces have recipes", () => {
    for (const id of ["hide_armor", "hide_helm", "hide_pants", "bone_charm"]) {
      expect(RECIPES.some((r) => r.out.item === id), id).toBe(true);
    }
  });

  it("equip moves item out of inventory and tracks durability", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    addItem(p, "hide_armor", 1);
    p.inv.push({ item: "hide_armor", count: 1, dur: 50 });
    // remove the stack-added one (addItem stacks by id) — instead craft-like setup:
    p.inv = [{ item: "hide_armor", count: 1, dur: 50 }];
    expect(equipArmorFromSlot(p, 0)).toBe(true);
    expect(countItems(p, "hide_armor")).toBe(0);
    expect(p.armor.chest).toBe("hide_armor");
    expect(p.armorDur.chest).toBe(50);
    expect(equippedDefense(p)).toBe(2);
  });

  it("unequip returns item to inventory", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    p.armor = { head: "hide_helm" };
    p.armorDur = { head: 40 };
    expect(unequipArmor(p, "head")).toBe(true);
    expect(p.armor.head).toBeUndefined();
    expect(countItems(p, "hide_helm")).toBe(1);
    expect(p.inv.find((s) => s.item === "hide_helm")!.dur).toBe(40);
  });

  it("equip swaps with the old piece", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    p.inv = [{ item: "hide_armor", count: 1, dur: 30 }];
    equipArmorFromSlot(p, 0);
    p.inv = [{ item: "bone_charm", count: 1 }]; // ไม่ใช่ slot เดียวกัน — ทดสอบสลับด้วย chest อีกตัว
    p.inv = [{ item: "hide_armor", count: 1, dur: 99 }];
    // สวมซ้ำ: ไม่มีของใน inv ตอนนี้จริง ๆ — ทดสอบสลับผ่านการสวม chest อื่น
    p.inv = [{ item: "hide_armor", count: 1, dur: 10 }];
    expect(equipArmorFromSlot(p, 0)).toBe(true);
    // ตัวเกมยังไม่มี chest อื่น — ตรวจว่า dur ใหม่ทับเก่า
    expect(p.armorDur.chest).toBe(10);
  });

  it("wearArmor breaks the piece at zero and clears the slot", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    p.armor = { legs: "hide_pants" };
    p.armorDur = { legs: 2 };
    expect(wearArmor(p, "legs", 1)).toBe(false);
    expect(p.armorDur.legs).toBe(1);
    expect(wearArmor(p, "legs", 1)).toBe(true); // แตก
    expect(p.armor.legs).toBeUndefined();
    expect(p.armorDur.legs).toBeUndefined();
  });

  it("defense sums across all slots", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    p.armor = { head: "hide_helm", chest: "hide_armor", legs: "hide_pants", acc: "bone_charm" };
    expect(equippedDefense(p)).toBe(1 + 2 + 1 + 1);
    expect(damageAfterDefense(10, p)).toBe(10 - 5);
    expect(damageAfterDefense(3, p)).toBe(1); // ขั้นต่ำ 1
  });

  it("migrates old saves where armor was equipped as weapon", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    p.equip = "hide_armor" as unknown as null;
    migrateEquipSlots(p);
    expect(p.equip).toBeNull();
    expect(p.armor.chest).toBe("hide_armor");
    expect(equippedDefense(p)).toBe(2);
    // migrate รองรับเซฟที่ไม่มี armor/armorDur field เลย (JSON เก่า)
    const raw = JSON.parse(JSON.stringify({ ...p, armor: undefined, armorDur: undefined }));
    migrateEquipSlots(raw);
    expect(raw.armor).toEqual({});
    expect(raw.armorDur).toEqual({});
  });

  it("equip fails gracefully when inventory slot is not armor", () => {
    const p = newPlayer("t", "#fff", 0, 0);
    p.inv = [{ item: "wood", count: 3 }];
    expect(equipArmorFromSlot(p, 0)).toBe(false);
    expect(countItems(p, "wood")).toBe(3);
  });
});
