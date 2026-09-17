# SUVIVALACRAFT OPEN WORLD — CHECKPOINT

## Project
SuvivalAcraft Open World (2D Top-Down Survival · Offline-First · LAN-ready)

## Architecture
2D Top-Down · Offline-First · LAN Multiplayer (planned) · Online Update (planned)
Engine แยกออกจาก Renderer (game/ = logic Engine, web/ = Renderer/UI)

## หลักการ (จาก blueprint)
- ทุก Subtask เสร็จ = Checkpoint 1 ครั้ง (IMPLEMENT → VERIFY → CHECKPOINT → NEXT)
- ห้ามประกาศ DONE โดยไม่มี Evidence (test/check/build/commit)
- Read repo ก่อนเสมอ; อัปเดต CHECKPOINT.md ก่อนหยุด/เลิก Token

---

# MASTER TASK LIST

| ID | Task | Status | Owner |
|----|------|--------|-------|
| 01 | Core Engine (engine interface, state, tick, system manager, event bus) | DONE | master |
| 02 | Tile System (tile data: walkable/moveCost/temp/moisture/fertility/biome) | DONE | master |
| 03 | Chunk System (chunk 32x32, coord, storage, load) | DONE (16x16) | master |
| 04 | World Generator (seed -> biome/terrain/resource/creature) | DONE (basic) | master |
| 05 | Player (move, camera, hotbar, stats) | DONE (basic) | master |
| 06 | Survival System (health/hunger/thirst/stamina/temperature) | DONE (hp/hunger/thirst/stamina) | master |
| 07 | Inventory (item id/quantity/durability/metadata) | DONE (id/quantity) | master |
| 08 | Crafting (data-driven recipes, tiers) | DONE (basic) | master |
| 09 | Building (fence/wall/door/wood_planks/sap + grid) | DONE | master |
| 10 | Creature AI (state machine: idle/wander/sense/search/chase/attack/flee) | DONE | master |
| 11 | Combat (weapon stats/damage/armor/crit) | DONE | master |
| 12 | Day/Night (cycle + visibility/temperature/creature activity) | DONE | master |
| 13 | Weather (clear/rain/storm/fog + gameplay effect) | DONE | master |
| 14 | World Events (migration/storm/wildfire/merchant/camp...) | PENDING | master |
| 15 | Local Save (IndexedDB/PWA) + Save Migration (version) | PENDING | master |
| 16 | LAN Multiplayer (host-authoritative) | PENDING | master |
| 17 | Update Content System (engine/content pack) | PENDING | master |

---

# CURRENT WORK

Task: เคลียร์ REMAINING ทั้งหมด — 14 World Events / 06 Temperature / 07 Durability+sort / 17 Content Pack + content ใหม่ / Farming ขยาย / Quest chain+explore / Audio / 16 LAN / CI
Owner: Arena Agent
Status: IN_PROGRESS (claimed 2026-09-17 รอบ 2) — ทำเป็น CP-008..CP-014 ทีละ checkpoint

---

# COMPLETED

- [x] 01 Core Engine — `game/src/engine/`, `game/src/core/` (GameEngine, tick, event bus, rng, math)
- [x] 02 Tile System — `game/src/world/chunk.ts` (block+variant+data), tile data driven
- [x] 03 Chunk System — `game/src/world/world.ts` (chunk coord, storage, setBlock/get, radius)
- [x] 04 World Generator (basic) — `game/src/procedural/terrain.ts`, seeded deterministic
- [x] 05 Player (basic) — `game/src/player/`, web move+camera+hotbar
- [x] 06 Survival (basic) — `game/src/survival/` (hp/hunger/thirst/stamina)
- [x] 07 Inventory (basic) — `game/src/inventory/`
- [x] 08 Crafting (basic, data-driven) — `game/src/crafting/` + `shared/registries/recipes.ts`
- [x] 09 Building (basic) — `game/src/building/`
- [x] 11 Combat — `game/src/combat/`
- [x] Web build & GitHub Pages deploy
- [x] Sprite atlas (assets/tiles/atlas.png) + renderer sprite-based

---

# REMAINING

- [x] 10 Creature AI — `game/src/ai/` state machine: IDLE/WANDER/SENSE/SEARCH/CHASE/ATTACK/FLEE/RETURN + Creature entity
- [x] 12 Day/Night — `game/src/world/daynight.ts` (DAWN/DAY/EVENING/NIGHT + light curve + day counter)
- [x] 13 Weather — `game/src/world/weather.ts` (clear/rain/heavy_rain/storm/fog/heat/cold + effects + scheduler)
- [ ] 14 World Events — events เปลี่ยน World State จริง
- [ ] 15 Local Save — IndexedDB (web) + version migration
- [ ] 16 LAN Multiplayer — host-authoritative
- [ ] 17 Content Update — engine กับ content pack แยก
- [ ] 06 Temperature ต่อ survival
- [ ] 07 Inventory durability/metadata

---

# LAST COMPLETED

CP-012 Quest chain + explore/talk/boss + Audio SFX (ก่อนหน้า: CP-011 Farming v2)

---

# NEXT ACTION

ตัวเลือกถัดไป: 14 World Events / 16 LAN Multiplayer / เพิ่ม content (อ้างงาน REMAINING ด้านล่าง)

---

# BLOCKERS

None

---

# EVIDENCE

Files: game/src/core/, game/src/world/, game/src/ai/ (ใหม่), game/src/survival/, ...
Tests: `npm test` (47 PASS baseline)
Checks: `npm run check` PASS, `npm run build` PASS
Build: `npx vite build` PASS
Commit: f1a25b9 (web build), ดูรายหน่วยต่อไป

---

# LAST COMMIT

f1a25b9 (baseline before AI engine work)

---

# CHECKPOINT HISTORY

## CP-001
Task: Baseline + web build
Status: DONE
Evidence: tests 47/47, build PASS, Pages deployed
Commit: f1a25b9

## CP-002
Task: 10 Creature AI (state machine)
Status: DONE
Evidence: `game/src/ai/state-machine.ts` + `creature.ts` + `tests/ai.test.ts` (7 tests PASS); suite 54/54
Commit: (AI engine commit นี้)

## CP-003
Task: 12 Day/Night + 13 Weather + 10 AI-in-web
Status: DONE
Evidence: `game/src/world/daynight.ts`, `game/src/world/weather.ts`, `tests/daynight-weather.test.ts` (4 tests); suite 58/58; web build PASS
Commit: (นี้)

## CP-004
Task: 08 Crafting recipes + 09 Building (fence/wall/door) + sprites + data sync
Status: DONE
Evidence: items/blocks/recipes registries + data JSON aligned; content:validate PASS; tests 58/58; web build PASS
Commit: (นี้)

## CP-005
Task: 09.x Building UI (web)
Status: DONE
Evidence: web/src/building.ts (pure) + world.ts edits system + state.ts items/recipes ใหม่ 4 + main.ts place/break/door-toggle; tests/web-building.test.ts (11 tests); suite 69/69 PASS; npm run check PASS; web typecheck PASS; vite build PASS
Commit: (commit ถัดจาก CP-005)

## CP-006
Task: Farming UI (web) — plant/grow/harvest
Status: DONE
Evidence: web/src/farming.ts (pure, stage จาก gameSeconds) + main.ts (plantSeed/farmingTick/harvestCrop + quest harvest_crop + seed จาก berry 40%); tests/web-farming.test.ts (10 tests); suite 79/79 PASS; check PASS; web typecheck PASS; vite build PASS
Commit: (commit ถัดจาก CP-006)

## CP-007
Task: 15 Local Save (IndexedDB) + G7 Save UI
Status: DONE
Evidence: web/src/saves.ts (KVStore: IndexedDB/localStorage/memory + SaveManager + migrateV1 จาก v1) + main.ts (multi-world create/play/delete + autosave 30s + save ตอน pause/ออกเมนู) + index.html (หน้า "โลกของฉัน" + ลบแบบยืนยัน 2 จังหวะ); tests/web-saves.test.ts (9 tests); suite 88/88 PASS; check PASS; web typecheck PASS; vite build PASS; content:validate PASS
Commit: (commit ถัดจาก CP-007)

## CP-008
Task: 14 World Events (web)
Status: DONE
Evidence: web/src/events.ts (scheduler ล้วน + weighted pick + minDay) + main.ts (event visuals ฝน/ไฟ, migration spawn, merchant พร้อมหน้าแลกของ 5 รายการ, camp เก็บของเดินเก็บได้, banner นับถอยหลัง, gold chip); tests/web-events.test.ts (10 tests); suite 98/98 PASS; check PASS; web typecheck PASS; vite build PASS
Commit: (commit ถัดจาก CP-008)

## CP-009
Task: 06 Temperature + 07 Inventory durability/metadata + ปุ่มจัดเรียง
Status: DONE
Evidence: web/src/climate.ts (ambient ตามเวลา/พายุ/ไฟป่า + warmth drain/regen/heat source) + web/src/inventory.ts (sortSlots merge+tie-break, wearSlot) + state.ts (Slot.dur, ItemDef.maxDur, PlayerState.warmth, craftRecipe แถม dur เต็ม, equippedDefense/damageAfterDefense, สวม armor) + main.ts (temperature tick + หนาว/ร้อนลด HP, อาวุธ/เครื่องมือสึกจนแตก, เกราะลดดาเมจ, ปุ่ม ↕ จัดเรียง, HUD 🌡/🪙); tests/web-climate-inventory.test.ts (12 tests); suite 110/110 PASS; check PASS; web typecheck PASS; vite build PASS
Commit: (commit ถัดจาก CP-009)

## CP-010
Task: 17 Content Update System + content ใหม่ (armor/hide/enemies/boss/snow)
Status: DONE
Evidence: web/src/content.ts (merge/apply pack, ตรวจ reference ก่อนเพิ่มสูตร) + web/src/bestiary.ts (ENEMY_KINDS 4 ชนิด + rollEnemyKind + shouldSpawnBoss) + state.ts (hide/hide_armor + สูตร) + world.ts (T_SNOW patches) + main.ts (spawn ตามกลางวัน/คืน, บอสทุกคืนวันที่หาร 3, draw ขนาด/สี/มงกุฎ, loot hide/gold, content pack จาก localStorage); tests/web-content-bestiary.test.ts (8 tests); suite 118/118 PASS; check PASS; web typecheck PASS; vite build PASS
Commit: (commit ถัดจาก CP-010)

## CP-011
Task: Farming ขยาย (ปุ๋ย/แปลง, crop variety)
Status: DONE
Evidence: web/src/farming.ts v2 (CROPS wheat/corn คนละ timing+yield, cropStage crop-aware, FERT_MULT=1.6, fertilize ครั้งเดียว/แปลง, normalizePlot migration จาก number, loadFrom รับ mixed payload) + state.ts (corn_seed/corn/fertilizer + สูตรปุ๋ย) + saves.ts (crops type PlotSave) + main.ts (plantSeed เลือกตามเมล็ดที่ถือ, applyFertilizer, harvestCrop ตาม crop def, TRADES เพิ่ม corn_seed); tests/web-farming.test.ts rewrite + saves test update; suite 120/120 PASS; check PASS; web typecheck PASS; vite build PASS
Commit: (commit ถัดจาก CP-011)

## CP-012
Task: Quest system ขยาย (chain + explore/talk/boss) + Audio
Status: DONE
Evidence: web/src/quests.ts (QUEST_DEFS 7 อันเป็นสาย after-chain, QuestLog progress/done/unlock/reward) + web/src/audio.ts (SFX สังเคราะห์ 11 เสียง, unlock on gesture) + main.ts (quest chain UI + locked count, explore นับโซน 8x8, craft/talk/boss hooks, sfx ครบทุก event, levelup notify, save/load quests+zones); tests/web-quests.test.ts (9 tests); suite 129/129 PASS; check PASS; web typecheck PASS; vite build PASS
Commit: (commit ถัดจาก CP-012)
