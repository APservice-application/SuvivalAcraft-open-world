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
| 14 | World Events (migration/storm/wildfire/merchant/camp...) | DONE | Arena Agent |
| 15 | Local Save (IndexedDB/PWA) + Save Migration (version) | DONE | Arena Agent |
| 16 | LAN Multiplayer (host-authoritative) | DONE (local co-op, transport pluggable) | Arena Agent |
| 17 | Update Content System (engine/content pack) | DONE | Arena Agent |

---

# CURRENT WORK

Task: (ว่าง — MASTER TASK LIST ครบ 17/17 แล้ว)
Owner: -
Status: AVAILABLE

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
- [x] 14 World Events — CP-008 (migration/storm/wildfire/merchant/camp + trade)
- [x] 15 Local Save — CP-007 (IndexedDB multi-world + migration v1→v2)
- [x] 16 LAN Multiplayer — CP-013 (host-authoritative local co-op)
- [x] 17 Content Update — CP-010 (content pack + bestiary)
- [x] 06 Temperature — CP-009 (warmth + ambient ตามเวลา/สภาพอากาศ)
- [x] 07 Inventory durability/metadata — CP-009 (+ sort)

---

# LAST COMPLETED

CP-014 CI + ปิดงานเอกสาร (MASTER TASK LIST 17/17 DONE) (ก่อนหน้า: CP-013 Co-op)

---

# NEXT ACTION

(ไม่มีงานค้างใน MASTER TASK LIST) — งาน future (ตาม RULE 18 DISCOVERED): item icon ศิลป์จริง, WebRTC transport ข้ามเครื่อง, world-effect sync ใน co-op, ไฟล์เสียงเพลงจริง

---

# BLOCKERS

None

---

# FUTURE / DISCOVERED (นอก scope ปัจจุบัน — ทำต่อได้เมื่อสั่ง)

- [ ] item icons ศิลป์จริง (ตอนนี้ใช้ emoji)
- [ ] WebRTC/WebSocket transport สำหรับ co-op ข้ามเครื่อง (protocol พร้อม)
- [ ] world-effect sync ใน co-op (ตอนนี้ตำแหน่ง/presence authoritative, เอฟเฟกต์โลกยัง local)
- [ ] เพลง/ไฟล์เสียงจริง (ตอนนี้ SFX สังเคราะห์ WebAudio)

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

## CP-013
Task: 16 LAN/Local Multiplayer (host-authoritative)
Status: DONE (scope: local co-op ข้ามแท็บผ่าน BroadcastChannel; Transport เป็น interface — ต่อ WebRTC/WebSocket ข้ามเครื่องได้ภายหลังโดยไม่แก้ protocol)
Evidence: web/src/multiplayer.ts (protocol join/welcome/action/snapshot/leave + HostSession ตรวจ intent + rate-limit 12/s + chained action log cap 200 + integrate เดินด้วย MP_SPEED + GuestSession reconcile > 2 tiles + makeRoomCode + Loopback/BroadcastChannel Transport) + main.ts (หน้า Co-op เปิดห้อง/เข้าร่วม, ghost players พร้อมชื่อ, ส่ง move intent 10Hz, พาเนลสถานะห้อง) + index.html (screen-coop); tests/web-multiplayer.test.ts (8 tests); suite 141/141 PASS; check PASS; web typecheck PASS; vite build PASS
Commit: (commit ถัดจาก CP-013)

## CP-014
Task: CI (GitHub Actions) + ปิดงานเอกสาร
Status: DONE
Evidence: .github/workflows/ci.yml (check + web typecheck + tests + content:validate + build ทุก push/PR) + STATUS.md/CHECKPOINT.md อัปเดตครบ (MASTER TASK LIST 17/17); suite 141/141 PASS ณ commit นี้
Commit: (commit ถัดจาก CP-014)

## CP-015
Task: World-effect sync ใน co-op (DISCOVERED future #3)
Status: DONE
Evidence: protocol เพิ่ม MpWorldState (enemies/pickups/event/merchant) ใน snapshot + HostSession.setWorld + GuestSession.world; main.ts host ส่งสถานะจริงทุก tick, guest เห็นศัตรู host (จาง)/merchant ghost/แบนเนอร์ event ของ host; eventDef fallback ปลอดภัย; tests +2; suite 143/143 PASS; check + web typecheck + vite build PASS
Commit: (commit ถัดจาก CP-015)

## CP-016
Task: WebSocket transport + relay server (DISCOVERED future #2 — co-op ข้ามเครื่อง)
Status: DONE
Evidence: server/mp-server.mjs (relay แยกห้องตาม field room, npm run mp-server, PORT env) + web/src/ws-transport.ts (queue ก่อน open + bind frame ผูกห้องทันที + injectable WS impl) + main.ts (เปิดห้อง/เข้าร่วมผ่านเซิร์ฟเวอร์จาก UI) + index.html (ช่อง ws:// URL); tests/web-ws-transport.test.ts (2 integration tests ผ่าน relay จริง: join/welcome/action/world + กันข้ามห้อง); suite 145/145 PASS; check + web typecheck + vite build PASS; ทดสอบ server เริ่ม/ตอบ HTTP ได้
Commit: (commit ถัดจาก CP-016)
