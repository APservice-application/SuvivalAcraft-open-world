# STATUS — SuvivalAcraft Open World

ไฟล์เช็คสถานะการทำงานกลาง (source of truth) สำหรับ AI และผู้พัฒนา
อัปเดตครั้งล่าสุด: 2026-09-17 (UTC) — รอบ 4: เคลียร์ FUTURE/DISCOVERED ครบ (CP-015..CP-018) — ทั้ง repo ไม่มีงานค้าง

> กติกา: อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง / อัปเดตหลังงานทุกครั้ง
> เพิ่มงานใหม่ได้ตลอดที่หัวข้อ "เพิ่มงาน / คำสั่งใหม่" — ใส่ timestamp, ผู้เสนอ, และสถานะ

---

## 1. เป้าหมายปัจจุบัน (Current Goals)

| # | เป้าหมาย | สถานะ |
|---|----------|--------|
| G1 | สร้าง survival open-world craft ที่เล่นได้: game core + world gen + content | ✅ เสร็จ |
| G2 | Studio tools สำหรับผู้พัฒนา (editors/generators/export) | ✅ เสร็จ |
| G3 | Test suite ครอบคลุมทุกระบบหลัก และผ่าน 100% | ✅ เสร็จ (47/47) |
| G4 | อัปโหลดขึ้น GitHub repo `SuvivalAcraft-open-world` และซิงค์ commit | ✅ เสร็จ (5603531) |
| G5 | สร้างสถานะ/checkpoint ไฟล์สำหรับการต่องานหลาย AI | ✅ เสร็จ (ไฟล์นี้) |
| G6 | Web build (HTML/canvas เล่นได้บนเบราว์เซอร์) | ✅ เสร็จ (deploy GitHub Pages) |
| G7 | เพิ่มระบบ save/load จริง + หน้า UI เลือกโลก | ✅ เสร็จ (CP-007: IndexedDB multi-world + autosave 30s + migration v1) |
| G8 | Multiplayer (LAN/local-first เสมือน A_Survival) | ✅ เสร็จ (CP-013: co-op local host-authoritative, transport pluggable) |
| G9 | Day/Night + Weather + Creature AI ในเกมจริง + sprite atlas | ✅ เสร็จ |

## 2. สถานะล่าสุด (Checkpoint)

- **งานกำลังทำ (IN PROGRESS)**: ไม่มี — MASTER TASK LIST 17/17 + FUTURE ครบ, tests 152/152 PASS
- **สรุปรอบนี้ (2026-09-17, Arena Agent)**:
  - CP-005 Building UI: วาง/ทุบ fence/wall/door/campfire + เปิด-ปิดประตู + สูตรคราฟต์ 4 ใหม่
  - CP-006 Farming UI: ปลูก/โต 3 ระยะ/เก็บเกี่ยว + เควสเก็บเกี่ยว + เมล็ดจากเบอร์รี่
  - CP-007 Local Save: IndexedDB multi-world + หน้า "โลกของฉัน" + autosave 30s + migration จาก v1
- **สรุปรอบ 3 ต่อ (CP-008..CP-014, 2026-09-17, Arena Agent)**:
  - CP-008 World Events: migration/storm/wildfire/merchant(แลกของ)/camp + gold
  - CP-009 Temperature + Durability + ปุ่มจัดเรียง + เกราะลดดาเมจ
  - CP-010 Content Pack + ศัตรู 4 ชนิด + บอสราชาสไลม์ + เสื้อหนัง + หิมะ
  - CP-011 Farming ขยาย: ข้าวโพด + ปุ๋ยเร่งโต + migration แปลงปลูก
  - CP-012 Quest chain 7 อัน (explore/talk/boss) + SFX สังเคราะห์ 11 เสียง
  - CP-013 Co-op local multiplayer (host-authoritative + action log + ghost)
  - CP-014 CI workflow (test/build/validate ทุก push)
- **Branch**: `main`
- **Commit ล่าสุด (local == remote)**: ดูจาก `git log --oneline -1` (web build ใน commit ถัดไป)
- **Working tree**: สะอาด (ไม่มีงานค้าง)
- **ผลตรวจล่าสุด**:
  - `npm run check` → PASS
  - `npm test` → PASS (47/47)
  - `npm run build` → PASS
  - `npm run content:validate` → PASS
  - `npm run world:generate` → 49 chunks

## 3. งานที่ทำเสร็จแล้ว (Done)

- [x] โครงสร้างโปรเจกต์: `game/`, `shared/`, `studio/`, `data/`, `assets/`, `blueprints/`, `docs/`, `tests/`, `tools/`
- [x] Data-driven content: items, blocks, biomes, recipes, crops, enemies, NPC, quests + zod schemas + validators
- [x] World gen: seeded/chunk/radius + biome + tree/ore (deterministic)
- [x] Game systems: inventory, crafting (transaction), farming (stages), combat (armour/crit), survival (hunger/thirst/hp/stamina), quests+level, economy, building, NPC trade
- [x] Save system: snapshot + validate ก่อน serialize (SAVE_VERSION=1)
- [x] Engine: fixed tick + frame loop + event bus
- [x] Studio: DataEditor, BlueprintManager, WorldEditor, BuildingEditor, generators (world/content/blueprint), ascii preview, export content pack
- [x] Docs: README, ARCHITECTURE, GAME_RULES
- [x] Assets: SVG tiles ตัวอย่าง + manifest
- [x] **Push ขึ้น GitHub**: commit `5603531` บน `origin/main`

## 4. งานค้าง / ยังไม่ได้ทำ (Backlog)

- [x] ~~**G6 — Web build/UI**~~ (เสร็จตั้งแต่รอบ 2 + ขยายรอบ 3)
- [x] ~~**G7 — Save UI**: โหลด/บันทึกโลกผ่าน UI, เลือก world, auto-save~~ (เสร็จ CP-007 2026-09-17)
- [x] ~~**G8 — Multiplayer**~~: co-op local host-authoritative + chained action log + validation (CP-013); ข้ามเครื่อง = future (WebRTC transport)
- [x] ~~Audio~~: SFX สังเคราะห์ WebAudio 11 เสียง (CP-012) — ไฟล์เสียง/เพลงจริง = future
- [x] ~~เพิ่มเนื้อหา~~: หิมะ, เสื้อหนัง/หนังสัตว์, ศัตรู goblin/brute, บอสราชาสไลม์ (CP-010)
- [x] ~~Quest system~~: chain + explore/talk/boss (CP-012); fish/collect-all = future
- [x] ~~Farming~~: ปุ๋ย + corn variety (CP-011); น้ำ/soil moisture = future
- [x] ~~ระบบวัน/คืน + mob spawn ตามเวลา~~: spawn กลางวัน/คืนต่างกัน + บอสทุก 3 วัน (CP-010)
- [x] ~~เติม item icons จริงแทน emoji~~: pixel art 16x16 ทุก item (CP-017)
- [x] ~~CI~~: .github/workflows/ci.yml (CP-014)

## 5. วิธีต่องาน (Handoff สำหรับ AI ตัวต่อไป)

1. `git pull` (หรือ clone) แล้วอ่าน `STATUS.md` + `AGENTS.md` + `docs/ARCHITECTURE.md`
2. เลือกงานจาก Backlog (หัวข้อ 4) หรือจาก "เพิ่มงาน / คำสั่งใหม่" ที่ยังไม่เสร็จ
3. ก่อนแก้: mark งานนั้นเป็น `IN PROGRESS` พร้อมชื่อ AI/ผู้ทำ + timestamp
4. หลังแก้:
   - รัน `npm run check` และ `npm test` ให้ผ่านเสมอ
   - อัปเดต `STATUS.md` (ย้ายงานที่เสร็จไป Done, อัปเดต commit, สถานะ)
   - commit + push พร้อม message ระบุชัด
5. ห้ามแก้ code ส่วนที่ AI อื่นกำลังทำอยู่ (ดูจาก IN PROGRESS)

## 6. เพิ่มงาน / คำสั่งใหม่ (Add Tasks Anytime)

> เพิ่มรายการใหม่ต่อท้ายได้เลย รูปแบบ: `- [ ] [วันที่] งาน: คำอธิบายสั้น (ผู้เสนอ)`

- [ ] 2026-08-29 — (ตัวอย่าง) ทำ inventory sorting ปุ่มจัดเรียง
- [ ] 2026-08-29 — (ตัวอย่าง) เพิ่ม quest type "explore" ให้เปิดแผนที่ครบ N จุด

## 8. Web build (เพิ่มรอบ 2)

- สร้าง `web/` — เกม HTML/canvas เล่นได้จริงจาก game core
- ใช้ WASD เดิน, คลิกวาง/ขุดบล็อก, คราฟต์ปุ่ม C, HUD แสดง HP/ความหิว/กระหาย, hotbar
- Deploy: GitHub Actions `.github/workflows/pages.yml` → GitHub Pages
- เปิดเล่นได้ที่: `https://apirak272543-ship-it.github.io/SuvivalAcraft-open-world/`

- [x] 2026-09-17 — Building UI (CP-005) + Farming UI (CP-006) + Local Save IndexedDB/เลือกโลก/autosave (CP-007) — Arena Agent

- [x] 2026-09-17 (รอบ 3 ต่อ) — CP-008..CP-014: World Events / Temperature / Durability / Content Pack+เนื้อหา / Farming ขยาย / Quest chain+Audio / Co-op / CI — Arena Agent — **MASTER TASK LIST 17/17 DONE, tests 141/141**

- [x] 2026-09-17 (รอบ 4) — CP-015..CP-018: co-op world sync / ws relay ข้ามเครื่อง / pixel icons / เพลงสังเคราะห์ — Arena Agent — tests 152/152
