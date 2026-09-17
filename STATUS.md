# STATUS — SuvivalAcraft Open World

ไฟล์เช็คสถานะการทำงานกลาง (source of truth) สำหรับ AI และผู้พัฒนา
อัปเดตครั้งล่าสุด: 2026-08-29 (UTC) — รอบ 2 เพิ่ม web build

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
| G7 | เพิ่มระบบ save/load จริง + หน้า UI เลือกโลก | ⏳ ยังไม่เริ่ม (มี web แบบ single-session) |
| G8 | Multiplayer (LAN/local-first เสมือน A_Survival) | ⏳ ยังไม่เริ่ม |
| G9 | Day/Night + Weather + Creature AI ในเกมจริง + sprite atlas | ✅ เสร็จ |

## 2. สถานะล่าสุด (Checkpoint)

- **งานกำลังทำ (IN PROGRESS)**: Building UI + Farming UI + G7 Local Save (IndexedDB) — Arena Agent 2026-09-17 (ดู CHECKPOINT.md CURRENT WORK)
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

- [ ] **G6 — Web build/UI**: พอร์ต game core ลงเบราว์เซอร์ (Vite + canvas), HUD, hotbar, วางบล็อก/คราฟต์ UI (อ้างอิง MCPE_Mirror studio pattern)
- [ ] **G7 — Save UI**: โหลด/บันทึกโลกผ่าน UI, เลือก world, auto-save
- [ ] **G8 — Multiplayer**: local-first LAN (อ้างอิง A_Survival: chained action log + validation)
- [ ] Audio: ใส่ไฟล์เสียงจริง (ตอนนี้มี event bus + profile แล้ว)
- [ ] เพิ่มเนื้อหา: biomes เพิ่ม, block ใหม่, อาวุธ/armor/ศัตรู/boss เพิ่ม
- [ ] Quest system: เพิ่ม objective type (talk/fish/collect-all), quest chain
- [ ] Farming: ใส่ปุ๋ย/น้ำ, crop variety, soil moisture
- [ ] ระบบวัน/คืน + lighting + mob spawn ตามเวลา
- [ ] เติม item icons จริงแทน SVG placeholder
- [ ] CI: เพิ่ม GitHub Actions (test + build + validate) ไว้ใน repo

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
