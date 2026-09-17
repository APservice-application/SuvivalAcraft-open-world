import { describe, it, expect } from "vitest";
import { painterFor, hasPainter, iconDataUrl, iconHTML, ICON_GRID, clearIconCache } from "../web/src/icons.js";
import { ITEMS } from "../web/src/state.js";
import {
  noteFreq, buildSequence, DAY_THEME, NIGHT_THEME, THEME_STEPS, themeLengthSec, MusicEngine,
} from "../web/src/music.js";

describe("pixel icons (CP-017)", () => {
  it("ทุก item ใน registry มี pixel painter", () => {
    for (const id of Object.keys(ITEMS)) {
      expect(hasPainter(id), id).toBe(true);
      const rects = painterFor(id)!;
      expect(rects.length, id).toBeGreaterThan(0);
    }
  });

  it("ทุก rect อยู่ในกริด 16x16 และสีเป็น hex", () => {
    for (const [id, rects] of Object.entries({
      wood: painterFor("wood"), hide_armor: painterFor("hide_armor"), wall: painterFor("wall"),
    })) {
      void id;
      for (const [x, y, w, h, color] of rects!) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(ICON_GRID);
        expect(y + h).toBeLessThanOrEqual(ICON_GRID);
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("iconDataUrl/iconHTML ปลอดภัยเมื่อไม่มี DOM (node)", () => {
    clearIconCache();
    // vitest node env ไม่มี document
    expect(iconDataUrl("wood")).toBeNull();
    const html = iconHTML("wood");
    expect(html).toContain("🪵"); // fallback emoji
    expect(iconHTML("unknown-item")).toBe("");
  });
});

describe("music (CP-018)", () => {
  it("noteFreq ตรงมาตรฐาน A4=440, C5, F#3", () => {
    expect(noteFreq("A4")).toBeCloseTo(440, 5);
    expect(noteFreq("C5")).toBeCloseTo(523.25, 2);
    expect(noteFreq("F#3")).toBeCloseTo(185.0, 1);
    expect(noteFreq("bogus")).toBe(440); // fallback
  });

  it("ธีมทั้งสองมีโน้ตและเว้นจังหวะ ไม่ว่าง", () => {
    for (const theme of [DAY_THEME, NIGHT_THEME]) {
      expect(theme.length).toBeGreaterThanOrEqual(16);
      expect(theme.some((n) => n !== null)).toBe(true);
      expect(theme.some((n) => n === null)).toBe(true); // มี rest
    }
  });

  it("buildSequence ข้าม rest และคำนวณ step/freq/dur ถูกต้อง", () => {
    const seq = buildSequence(["A4", null, "C5"], 0.25);
    expect(seq.length).toBe(2);
    expect(seq[0]).toEqual({ step: 0, freq: 440, dur: 0.25 * 0.9 });
    expect(seq[1]!.step).toBe(2);
    expect(themeLengthSec("day")).toBeCloseTo(DAY_THEME.length * THEME_STEPS.day.stepSec, 6);
  });

  it("MusicEngine ปลอดภัยโดยไม่มี AudioContext (node)", () => {
    const m = new MusicEngine();
    expect(() => m.start()).not.toThrow();
    expect(() => m.setTheme("night")).not.toThrow();
    expect(m.currentTheme).toBe("night");
    expect(m.toggleMute()).toBe(true); // เปิด mute
    expect(() => m.stop()).not.toThrow();
    // หลัง mute แล้ว start ต้อง no-op
    m.start();
    m.toggleMute(); // unmute
    m.stop();
  });
});
