// SuvivalAcraft Open World — main game wiring (mobile-first, touch-first)
import { World, TILE_SIZE, T_WATER, T_STONE, T_ROCK, T_TREE, T_BUSH, T_BERRY, T_GRASS, T_GRASS_ALT, T_DIRT, T_SAND, T_FLOOR, T_PATH, T_FENCE, T_WALL, T_DOOR, T_DOOR_OPEN, T_CAMPFIRE, T_TILLED, T_CROP_0, T_CROP_1, T_CROP_2, T_SNOW, tileName } from "./world.js";
import {
  PlayerState, newPlayer, addItem, removeItem, countItems, canCraft, craftRecipe,
  useItem, equippedDamage, damageAfterDefense, survivalTick, addXp, xpNeed,
  ITEMS, RECIPES, Slot,
} from "./state.js";
import { buildableByItem, isDoorTile, toggledDoor, itemForBuildingTile, occupiedTile } from "./building.js";
import { FarmPlots, CROPS, FERT_MULT, cropBySeedItem, plotKey } from "./farming.js";
import { SaveManager, pickStore, LEGACY_KEY, type WorldSaveV2, type WorldMeta } from "./saves.js";
import { EventScheduler, eventDef, type EventKind } from "./events.js";
import { ambientTemperature, warmthStep } from "./climate.js";
import { sortSlots, wearSlot } from "./inventory.js";
import { applyContentPack, packFromStorage } from "./content.js";
import { ENEMY_KINDS, enemyStats, rollEnemyKind, shouldSpawnBoss } from "./bestiary.js";
import { QuestLog } from "./quests.js";
import { Sfx } from "./audio.js";
import { TouchJoystick, KeyboardInput, setupButton } from "./controls.js";

// ---------- DOM ----------
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("game");
const ctx = canvas.getContext("2d")!;
const hud = $("hud");
const overlay = $("overlay");
const topBar = $("top-bar");
const msgEl = $("msg");

// ---------- State ----------
let player: PlayerState;
let world: World;
let gameSeed = 0;
let time = 6; // game-hour (6 = dawn)
const DAY_LEN = 240; // seconds per full day
let dayCount = 1;
let gameSeconds = 0; // total gameplay seconds since world start (drives crop growth)
let farmPlots = new FarmPlots();

// save system
let saveMgr: SaveManager | null = null;
let currentWorld: WorldMeta | null = null;
let autosaveTimer = 0;
let latestWorldId: string | null = null;
const AUTOSAVE_EVERY = 30; // seconds

// world events (task 14)
let eventSched = new EventScheduler(45);
let merchant: { x: number; z: number; until: number } | null = null;
let pickups: { x: number; z: number; item: string; count: number }[] = [];
let fireDmgAt = 0;
let coldMsgAt = 0;
let bannerEl: HTMLElement | null = null;
let tradeEl: HTMLElement | null = null;
let tradeOpen = false;

let camX = 0, camY = 0;
let running = false;
let lastTs = 0;
let msgTimer = 0;
let paused = false;
let selectedSlot = -1;
let dodgeUntil = 0;
let attackCooldown = 0;

// facing direction (unit-ish grid direction of last movement)
let faceX = 1, faceZ = 0;

interface Enemy { x: number; y: number; hp: number; maxHp: number; dmg: number; kind: string; aggro: boolean; spd: number; size: number; }
let bossSpawnedOnDay: number | null = null;
let enemies: Enemy[] = [];
let spawnTimer = 0;

// ---------- Minimap ----------
let minimapCv: HTMLCanvasElement | null = null;
let minimapCtx: CanvasRenderingContext2D | null = null;

// ---------- Quest tracker (chain) + audio + explore ----------
let questLog = new QuestLog();
let visitedZones = new Set<string>();
let lastLevel = 0;
const sfx = new Sfx();
let questEl: HTMLElement | null = null;

// ---------- Crafting ----------
let craftOpen = false;
let craftEl: HTMLElement | null = null;


// ============================================================
//  BOOTSTRAP UI (minimap / quest / crafting injected into DOM)
// ============================================================
function buildDynamicUI(): void {
  // Minimap (top-right, under top bar on right side)
  minimapCv = document.createElement("canvas");
  minimapCv.width = 120;
  minimapCv.height = 120;
  minimapCv.style.cssText = "position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 52px);right:12px;width:96px;height:96px;border:1px solid rgba(255,255,255,.25);border-radius:10px;background:#0a101e;pointer-events:none;z-index:6;";
  hud.appendChild(minimapCv);
  minimapCtx = minimapCv.getContext("2d");
  const miniLabel = document.createElement("div");
  miniLabel.textContent = "🗺";
  miniLabel.style.cssText = "position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 50px);right:112px;font-size:14px;pointer-events:none;z-index:6;";
  hud.appendChild(miniLabel);

  // Quest tracker (top-center-left)
  questEl = document.createElement("div");
  questEl.style.cssText = "position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 48px);left:12px;max-width:240px;pointer-events:none;z-index:6;display:flex;flex-direction:column;gap:4px;";
  hud.appendChild(questEl);

  // Crafting button + panel (separate, on HUD right side above quick bar)
  const craftBtn = document.createElement("button");
  craftBtn.id = "btn-craft";
  craftBtn.textContent = "🔨 คราฟต์";
  craftBtn.style.cssText = "position:absolute;right:10px;bottom:110px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(10,16,30,.8);color:#fff;font-size:13px;font-weight:700;z-index:6;";
  craftBtn.addEventListener("click", () => { craftOpen = !craftOpen; if (craftOpen) renderCraft(); else if (craftEl) craftEl.style.display = "none"; });
  hud.appendChild(craftBtn);

  craftEl = document.createElement("div");
  craftEl.id = "craft-panel";
  craftEl.style.cssText = "position:absolute;right:10px;bottom:150px;width:210px;max-height:46%;overflow:auto;background:rgba(10,16,30,.96);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px;z-index:7;display:none;";
  hud.appendChild(craftEl);

  // event banner (top-center under msg)
  bannerEl = document.createElement("div");
  bannerEl.style.cssText = "position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 84px);left:50%;transform:translateX(-50%);background:rgba(10,16,30,.85);border:1px solid rgba(255,213,79,.4);color:#ffd54f;font-size:12px;padding:4px 10px;border-radius:8px;z-index:6;display:none;pointer-events:none;";
  hud.appendChild(bannerEl);

  // trade panel (merchant)
  tradeEl = document.createElement("div");
  tradeEl.id = "trade-panel";
  tradeEl.style.cssText = "position:absolute;right:10px;bottom:150px;width:230px;max-height:46%;overflow:auto;background:rgba(10,16,30,.96);border:1px solid rgba(255,213,79,.35);border-radius:12px;padding:10px;z-index:7;display:none;";
  hud.appendChild(tradeEl);
}

function renderCraft(): void {
  if (!craftEl) return;
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-weight:700;color:#8fb0ff">🔨 คราฟต์</span>
    <button data-sort style="border:1px solid rgba(143,176,255,.5);border-radius:6px;padding:3px 8px;background:rgba(143,176,255,.15);color:#8fb0ff;font-size:11px;font-weight:700">↕ จัดเรียง</button>
  </div>`;
  for (const r of RECIPES) {
    const ok = canCraft(r, player);
    const need = r.needs.map((n) => `${ITEMS[n.item]?.icon ?? ""} ${countItems(player, n.item)}/${n.count}`).join(" · ");
    html += `<div style="padding:6px;border:1px solid ${ok ? "rgba(143,176,255,.6)" : "rgba(255,255,255,.12)"};border-radius:8px;margin-bottom:6px;background:${ok ? "rgba(143,176,255,.14)" : "transparent"};opacity:${ok ? "1" : ".6"}">
      <div style="font-size:14px;display:flex;justify-content:space-between;align-items:center">
        <span>${r.icon} ${r.name}</span>
        <button data-craft="${r.id}" style="border:0;border-radius:6px;padding:4px 8px;background:${ok ? "#577cff" : "#2a3450"};color:${ok ? "#06101f" : "#8b93ad"};font-weight:700" ${ok ? "" : "disabled"}>คราฟต์</button>
      </div>
      <div style="font-size:11px;color:#9fb0d8">${need}</div>
    </div>`;
  }
  craftEl.innerHTML = html;
  const sortBtn = craftEl.querySelector<HTMLButtonElement>("[data-sort]");
  if (sortBtn) {
    sortBtn.addEventListener("click", () => {
      player.inv = sortSlots(player.inv);
      notify("↕ จัดเรียงกระเป๋าแล้ว", "#aaf0c2");
      renderQuickBar();
      renderCraft();
    });
  }
  craftEl.querySelectorAll<HTMLButtonElement>("[data-craft]").forEach((b) => {
    b.addEventListener("click", () => {
      const r = RECIPES.find((x) => x.id === b.dataset.craft);
      if (r && craftRecipe(r, player)) {
        notify(`CRAFTED: ${r.icon} ${r.name}`, "#aaf0c2");
        sfx.play("craft");
        questProgress("craft_tool", 1);
        renderHud();
        renderCraft();
      } else {
        notify("วัตถุดิบไม่พอ", "#ff8a80");
      }
    });
  });
}

function renderQuests(): void {
  if (!questEl) return;
  const active = questLog.active();
  const locked = questLog.lockedCount();
  if (!active.length && !locked) {
    questEl.innerHTML = "<div style='color:#fff;font-size:13px;background:rgba(10,16,30,.7);border-radius:8px;padding:4px 8px'>✅ ภารกิจสำเร็จทั้งหมด</div>";
    return;
  }
  let html = active.map((q) => {
    const prog = questLog.progress[q.id] ?? 0;
    const pct = Math.min(100, Math.round((prog / q.target) * 100));
    return `<div style="background:rgba(10,16,30,.72);border-radius:8px;padding:5px 9px;font-size:12px;color:#ecf0ff;border:1px solid rgba(255,255,255,.12)">
      <div><b>${q.icon} ${q.name}</b></div>
      <div style="color:#9fb0d8;font-size:11px">${q.desc} <span style="color:#aaf0c2">${prog}/${q.target}</span></div>
      <div style="height:4px;background:#14203a;border-radius:2px;margin-top:3px"><div style="height:100%;width:${pct}%;background:#8fb0ff"></div></div>
    </div>`;
  }).join("");
  if (locked > 0) {
    html += `<div style="background:rgba(10,16,30,.5);border-radius:8px;padding:4px 9px;font-size:11px;color:#7f8db0">🔒 ภารกิจล็อกอยู่ ${locked} รายการ</div>`;
  }
  questEl.innerHTML = html;
}

// ============================================================
//  SCREEN HELPERS
// ============================================================
function showScreen(id: string): void {
  document.querySelectorAll<HTMLElement>(".screen").forEach((s) => s.classList.remove("visible"));
  $(id)?.classList.add("visible");
}
function showHud(on: boolean): void {
  hud.classList.toggle("playing", on);
}
function notify(text: string, color = "#aaf0c2"): void {
  msgEl.textContent = text;
  msgEl.style.color = color;
  msgTimer = 2.4;
}

// ============================================================
//  GAME SETUP
// ============================================================
function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function startGame(p: PlayerState, seed: number, t: number, restore?: WorldSaveV2): void {
  player = p;
  gameSeed = seed;
  world = new World(seed);
  time = t;
  camX = p.pos.x;
  camY = p.pos.y;
  enemies = [];
  spawnTimer = 1;
  autosaveTimer = 0;
  eventSched = new EventScheduler(45);
  merchant = null;
  pickups = [];
  fireDmgAt = 0;
  tradeOpen = false;
  if (tradeEl) tradeEl.style.display = "none";
  if (restore) {
    if (player.warmth === undefined) player.warmth = 50;
    questLog = new QuestLog();
    if (restore.quests) {
      questLog.progress = { ...restore.quests.progress };
      questLog.done = { ...restore.quests.done };
    }
    visitedZones = new Set(restore.zones || []);
    currentWorld = restore.meta;
    dayCount = restore.dayCount || 1;
    gameSeconds = restore.gameSeconds || 0;
    world.setEdits(restore.edits || []);
    farmPlots = new FarmPlots();
    farmPlots.loadFrom((restore.crops || {}) as Record<string, unknown>);
  } else {
    currentWorld = null;
    dayCount = 1;
    gameSeconds = 0;
    farmPlots = new FarmPlots();
    questLog = new QuestLog();
    visitedZones = new Set();
  }
  lastLevel = player.level;
  notify(`ยินดีต้อนรับ ${p.name} 🏕️`, "#aaf0c2");
  showScreen("none");
  showHud(true);
  overlay.classList.remove("visible");
  paused = false;
  running = true;
  lastTs = performance.now();
  renderCraft();
  renderQuests();
  lockLandscape();
}

async function beginNewGame(): Promise<void> {
  const seedInput = $<HTMLInputElement>("world-seed").value || "1337";
  const seed = seedFrom(seedInput);
  const name = $<HTMLInputElement>("char-name").value || "นักผจญภัย";
  const worldName = $<HTMLInputElement>("world-name").value || "โลกลิขิต";
  // spawn near village center (36,36)
  const p = newPlayer(name, outfitColor, 36, 36);
  const meta = saveMgr ? await saveMgr.createWorld(worldName, seed) : null;
  const skeleton: WorldSaveV2 | undefined = meta ? {
    v: 2, meta, time: 6, dayCount: 1, gameSeconds: 0, player: p, edits: [], crops: {}, savedAt: Date.now(),
  } : undefined;
  startGame(p, seed, 6, skeleton);
  void saveNow("auto");
}

// ============================================================
//  SAVE / LOAD
// ============================================================
async function saveNow(kind: "auto" | "manual"): Promise<void> {
  if (!saveMgr || !currentWorld || !world || !player) return;
  const save: WorldSaveV2 = {
    v: 2,
    meta: { ...currentWorld },
    time,
    dayCount,
    gameSeconds,
    player,
    edits: world.getEdits(),
    crops: { ...farmPlots.state } as { [k: string]: { crop: string; plantedAt: number; fert?: boolean } },
    quests: { progress: { ...questLog.progress }, done: { ...questLog.done } },
    zones: [...visitedZones],
    savedAt: Date.now(),
  };
  try {
    await saveMgr.saveWorld(save);
    currentWorld = save.meta;
    if (kind === "manual") notify("💾 บันทึกเกมแล้ว", "#aaf0c2");
  } catch {
    if (kind === "manual") notify("บันทึกไม่สำเร็จ", "#ff8a80");
  }
}

async function playWorld(id: string): Promise<void> {
  if (!saveMgr) return;
  const s = await saveMgr.loadWorld(id);
  if (!s) {
    notify("โหลดโลกไม่สำเร็จ", "#ff8a80");
    return;
  }
  startGame(s.player, s.meta.seed, s.time, s);
}

async function playLatestWorld(): Promise<void> {
  if (!saveMgr) return;
  const metas = (await saveMgr.listWorlds()).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!metas.length) return;
  await playWorld(metas[0]!.id);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

async function renderWorlds(): Promise<void> {
  const listEl = $("worlds-list");
  if (!listEl) return;
  if (!saveMgr) { listEl.innerHTML = "<div style='color:#9fb0d8;font-size:13px'>ระบบเซฟยังไม่พร้อม</div>"; return; }
  const metas = (await saveMgr.listWorlds()).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!metas.length) {
    listEl.innerHTML = "<div style='color:#9fb0d8;font-size:13px;text-align:center;padding:10px'>ยังไม่มีโลก — กดสร้างโลกใหม่เลย!</div>";
    return;
  }
  listEl.innerHTML = "";
  for (const m of metas) {
    const row = document.createElement("div");
    row.className = "world-row";
    const info = document.createElement("div");
    info.className = "world-info";
    info.innerHTML = `<b>${escapeHtml(m.name)}</b><div style="font-size:11px;color:#9fb0d8">seed ${m.seed} · ${new Date(m.updatedAt).toLocaleString()}</div>`;
    const play = document.createElement("button");
    play.className = "btn world-play";
    play.textContent = "▶ เล่น";
    play.addEventListener("click", () => { void playWorld(m.id); });
    const del = document.createElement("button");
    del.className = "btn world-del";
    del.textContent = "🗑";
    del.addEventListener("click", () => {
      if (del.dataset.confirm === "1") {
        void saveMgr?.deleteWorld(m.id).then(() => { void renderWorlds(); void updateContinueBtn(); });
      } else {
        del.dataset.confirm = "1";
        del.textContent = "แน่ใจ?";
        del.style.background = "#a33";
        setTimeout(() => { del.dataset.confirm = ""; del.textContent = "🗑"; del.style.background = ""; }, 2500);
      }
    });
    row.appendChild(info);
    row.appendChild(play);
    row.appendChild(del);
    listEl.appendChild(row);
  }
}

let outfitColor = "#e53935";

// ============================================================
//  RENDER WORLD
// ============================================================
function drawTileScreenSpace(sx: number, sy: number, id: number): void {
  switch (id) {
    case T_GRASS: case T_GRASS_ALT: ctx.fillStyle = "#3f8f43"; break;
    case T_DIRT: ctx.fillStyle = "#8a6a3b"; break;
    case T_SAND: ctx.fillStyle = "#d9c27a"; break;
    case T_WATER: ctx.fillStyle = "#3a7bd5"; break;
    case T_STONE: ctx.fillStyle = "#6b7280"; break;
    case T_TREE: ctx.fillStyle = "#2e6b2e"; break;
    case T_ROCK: ctx.fillStyle = "#555f6e"; break;
    case T_BUSH: ctx.fillStyle = "#57a05a"; break;
    case T_BERRY: ctx.fillStyle = "#b03d7a"; break;
    case T_FLOOR: ctx.fillStyle = "#a8845a"; break;
    case T_PATH: ctx.fillStyle = "#9aa0ac"; break;
    case T_FENCE: ctx.fillStyle = "#7a5a33"; break;
    case T_WALL: ctx.fillStyle = "#8d949e"; break;
    case T_DOOR: ctx.fillStyle = "#6b4a26"; break;
    case T_DOOR_OPEN: ctx.fillStyle = "#3f8f43"; break;
    case T_CAMPFIRE: ctx.fillStyle = "#3a3f4a"; break;
    case T_TILLED: ctx.fillStyle = "#5e4626"; break;
    case T_CROP_0: ctx.fillStyle = "#5e4626"; break;
    case T_CROP_1: ctx.fillStyle = "#5e4626"; break;
    case T_CROP_2: ctx.fillStyle = "#5e4626"; break;
    case T_SNOW: ctx.fillStyle = "#e8eef5"; break;
    default: ctx.fillStyle = "#3f8f43";
  }
  ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
  // tile details
  if (id === T_TREE || id === T_BUSH || id === T_BERRY || id === T_ROCK) {
    ctx.fillStyle = id === T_ROCK ? "#454c58" : "#1c5a1c";
    ctx.beginPath();
    ctx.arc(sx + 8, sy + 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // placed buildings / crops details
  if (id === T_FENCE) {
    ctx.fillStyle = "#9a7440";
    ctx.fillRect(sx + 1, sy + 6, 14, 2);
    ctx.fillRect(sx + 1, sy + 10, 14, 2);
    ctx.fillRect(sx + 2, sy + 3, 3, 11);
    ctx.fillRect(sx + 11, sy + 3, 3, 11);
  } else if (id === T_WALL) {
    ctx.fillStyle = "#7b8290";
    ctx.fillRect(sx + 1, sy + 1, 14, 3);
    ctx.fillRect(sx + 1, sy + 8, 14, 3);
    ctx.fillStyle = "#a2a9b5";
    ctx.fillRect(sx + 1, sy + 5, 7, 2);
    ctx.fillRect(sx + 8, sy + 12, 7, 2);
  } else if (id === T_DOOR) {
    ctx.fillStyle = "#8a6435";
    ctx.fillRect(sx + 3, sy + 1, 10, 14);
    ctx.fillStyle = "#f5d76e";
    ctx.fillRect(sx + 10, sy + 7, 2, 2);
  } else if (id === T_DOOR_OPEN) {
    ctx.fillStyle = "#8a6435";
    ctx.fillRect(sx, sy + 1, 4, 14);
  } else if (id === T_CAMPFIRE) {
    ctx.fillStyle = "#5a4632";
    ctx.fillRect(sx + 2, sy + 10, 12, 3);
    ctx.fillRect(sx + 5, sy + 12, 6, 2);
    ctx.fillStyle = "#ff9a3c";
    ctx.beginPath();
    ctx.moveTo(sx + 8, sy + 2);
    ctx.lineTo(sx + 12, sy + 10);
    ctx.lineTo(sx + 4, sy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe082";
    ctx.beginPath();
    ctx.moveTo(sx + 8, sy + 5);
    ctx.lineTo(sx + 10, sy + 10);
    ctx.lineTo(sx + 6, sy + 10);
    ctx.closePath();
    ctx.fill();
  } else if (id === T_TILLED) {
    ctx.fillStyle = "#4a3820";
    ctx.fillRect(sx + 1, sy + 4, 14, 2);
    ctx.fillRect(sx + 1, sy + 9, 14, 2);
  } else if (id === T_CROP_0) {
    ctx.fillStyle = "#69b06a";
    ctx.fillRect(sx + 7, sy + 9, 2, 5);
  } else if (id === T_CROP_1) {
    ctx.fillStyle = "#4f9e50";
    ctx.fillRect(sx + 7, sy + 4, 2, 10);
    ctx.fillRect(sx + 4, sy + 7, 3, 2);
    ctx.fillRect(sx + 9, sy + 6, 3, 2);
  } else if (id === T_CROP_2) {
    ctx.fillStyle = "#c9a53c";
    ctx.fillRect(sx + 6, sy + 2, 4, 5);
    ctx.fillStyle = "#4f9e50";
    ctx.fillRect(sx + 7, sy + 6, 2, 8);
    ctx.fillRect(sx + 3, sy + 9, 4, 2);
    ctx.fillRect(sx + 9, sy + 11, 4, 2);
  }
}

function worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
  return { sx: (wx - camX) * TILE_SIZE + canvas.width / 2, sy: (wy - camY) * TILE_SIZE + canvas.height / 2 };
}

function render(): void {
  const cw = canvas.width, ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  const rad = 24;
  const left = Math.floor(camX - (cw / 2) / TILE_SIZE);
  const top = Math.floor(camY - (ch / 2) / TILE_SIZE);
  const right = Math.ceil(camX + (cw / 2) / TILE_SIZE);
  const bottom = Math.ceil(camY + (ch / 2) / TILE_SIZE);
  for (let z = top; z <= bottom; z++) {
    for (let x = left; x <= right; x++) {
      const id = world.tileAt(x, z);
      const { sx, sy } = worldToScreen(x, z);
      drawTileScreenSpace(sx, sy, id);
    }
  }

  // enemies
  for (const e of enemies) {
    const { sx, sy } = worldToScreen(e.x, e.y);
    const st = enemyStats(e.kind);
    const sz = e.size || st.size;
    const ox = (16 - sz) / 2;
    ctx.fillStyle = e.kind === "slime" ? "#7ce0a0" : e.kind === "goblin" ? "#d97878" : e.kind === "brute" ? "#a3553f" : "#b56ad7";
    ctx.fillRect(sx + ox, sy + ox, sz, sz);
    // hp bar
    const pct = e.hp / e.maxHp;
    ctx.fillStyle = "#14203a";
    ctx.fillRect(sx, sy - 3, 16, 2);
    ctx.fillStyle = pct > 0.5 ? "#7ce07c" : "#e05353";
    ctx.fillRect(sx, sy - 3, 16 * pct, 2);
    // eyes
    ctx.fillStyle = "#000";
    const ex1 = sx + ox + sz * 0.3, ex2 = sx + ox + sz * 0.7, ey = sy + ox + sz * 0.35;
    ctx.fillRect(ex1, ey, 2, 2);
    ctx.fillRect(ex2, ey, 2, 2);
    if (st.boss) {
      ctx.font = "10px monospace";
      ctx.fillText("👑", sx + 3, sy - 5);
    }
  }

  // world event visuals
  if (eventSched.activeKind("storm", gameSeconds)) {
    ctx.fillStyle = "rgba(30,50,90,0.25)";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "rgba(160,190,255,0.5)";
    ctx.beginPath();
    for (let i = 0; i < 50; i++) {
      const rx = Math.random() * cw, ry = Math.random() * ch;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 3, ry + 10);
    }
    ctx.stroke();
  } else if (eventSched.activeKind("wildfire", gameSeconds)) {
    ctx.fillStyle = "rgba(200,80,20,0.14)";
    ctx.fillRect(0, 0, cw, ch);
  }

  // merchant
  if (merchant) {
    const ms = worldToScreen(merchant.x, merchant.z);
    ctx.fillStyle = "#c9a53c";
    ctx.fillRect(ms.sx + 4, ms.sy + 3, 8, 12);
    ctx.fillStyle = "#e8b57a";
    ctx.fillRect(ms.sx + 6, ms.sy, 4, 4);
    ctx.font = "9px monospace";
    ctx.fillText("💰", ms.sx + 9, ms.sy - 2);
  }
  // ground pickups
  for (const pk of pickups) {
    const ps = worldToScreen(pk.x, pk.z);
    ctx.font = "10px monospace";
    ctx.fillText(pk.item === "gold" ? "🪙" : (ITEMS[pk.item]?.icon ?? "📦"), ps.sx + 3, ps.sy + 12);
  }

  // player
  const { sx, sy } = worldToScreen(player.pos.x, player.pos.y);
  ctx.fillStyle = player.outfit || outfitColor;
  ctx.fillRect(sx + 3, sy + 3, 10, 12);
  ctx.fillStyle = "#e8b57a";
  ctx.fillRect(sx + 6, sy, 4, 4); // head
  // facing/equip indicator
  if (player.equip) {
    ctx.fillStyle = "#fff";
    ctx.font = "8px monospace";
    ctx.fillText(ITEMS[player.equip]?.icon ?? "✔", sx, sy - 4);
  }

  // day/night overlay
  const darkness = dayDarkness();
  if (darkness > 0.02) {
    ctx.fillStyle = `rgba(5,10,30,${darkness * 0.6})`;
    ctx.fillRect(0, 0, cw, ch);
  }
}

function dayDarkness(): number {
  // time in [0,24]; night when <6 or >20
  let d = 0;
  if (time < 6) d = (6 - time) / 6;
  else if (time > 20) d = (time - 20) / 4;
  else if (time > 17) d = (time - 17) / 3;
  if (d < 0) d = 0;
  if (eventSched.activeKind("storm", gameSeconds)) d += 0.3;
  else if (eventSched.activeKind("wildfire", gameSeconds)) d += 0.15;
  return Math.min(1, d);
}

function renderMinimap(): void {
  if (!minimapCtx || !minimapCv) return;
  const c = minimapCtx;
  const size = minimapCv.width;
  const scale = 2; // world units per minimap px
  c.clearRect(0, 0, size, size);
  c.fillStyle = "#0a101e";
  c.fillRect(0, 0, size, size);
  const mw = size / scale;
  // sample
  for (let my = 0; my < size; my++) {
    for (let mx = 0; mx < size; mx++) {
      const wx = Math.floor(camX + (mx - size / 2) / scale);
      const wy = Math.floor(camY + (my - size / 2) / scale);
      const id = world.tileAt(wx, wy);
      c.fillStyle = id === T_WATER ? "#3a7bd5" : id === T_TREE ? "#2e6b2e" : id === T_ROCK ? "#777" : id === T_SAND ? "#d9c27a" : id === T_SNOW ? "#dfe7ee" : "#3f8f43";
      c.fillRect(mx, my, 1, 1);
    }
  }
  // player marker
  c.fillStyle = "#fff";
  c.fillRect(size / 2 - 1, size / 2 - 1, 3, 3);
  // enemies
  for (const e of enemies) {
    const ex = size / 2 + (e.x - camX) * scale;
    const ey = size / 2 + (e.y - camY) * scale;
    if (ex < 0 || ex > size || ey < 0 || ey > size) continue;
    c.fillStyle = "#e05353";
    c.fillRect(ex, ey, 2, 2);
  }
}

// ============================================================
//  COMBAT / ENEMIES
// ============================================================
function spawnEnemies(): void {
  const isNight = dayDarkness() > 0.5;
  while (enemies.length < 3) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 80;
    const ex = Math.round(camX + Math.cos(ang) * dist);
    const ey = Math.round(camY + Math.sin(ang) * dist);
    if (!world.isWalkable(ex, ey)) continue;
    const kind = rollEnemyKind(isNight, Math.random());
    const st = enemyStats(kind);
    enemies.push({ x: ex, y: ey, hp: st.hp, maxHp: st.hp, dmg: st.dmg, kind, aggro: false, spd: st.spd, size: st.size });
  }
}

function updateEnemies(dt: number): void {
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnEnemies(); spawnTimer = 5; }

  // boss: ราชาสไลม์ ทุกคืนของวันที่หาร 3 ลงตัว
  if (shouldSpawnBoss(dayCount, dayDarkness() > 0.5, bossSpawnedOnDay) && !enemies.some((e) => e.kind === "slime_king")) {
    for (let tries = 0; tries < 30; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 14;
      const ex = Math.round(player.pos.x + Math.cos(ang) * dist);
      const ey = Math.round(player.pos.y + Math.sin(ang) * dist);
      if (!world.isWalkable(ex, ey)) continue;
      const st = enemyStats("slime_king");
      enemies.push({ x: ex, y: ey, hp: st.hp, maxHp: st.hp, dmg: st.dmg, kind: st.kind, aggro: true, spd: st.spd, size: st.size });
      bossSpawnedOnDay = dayCount;
      notify("👑 ราชาสไลม์ปรากฏตัว!", "#ff8a80");
      break;
    }
  }
  for (const e of enemies) {
    const dx = player.pos.x - e.x, dy = player.pos.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) e.aggro = true;
    if (e.aggro) {
      const speed = e.spd * dt;
      if (dist > 1) {
        e.x += (dx / dist) * speed;
        e.y += (dy / dist) * speed;
      }
      if (dist < 1.4) {
        if (performance.now() / 1000 > (e as any).atkTimer) {
          player.hp = Math.max(0, player.hp - damageAfterDefense(e.dmg, player));
          sfx.play("hurt");
          wearEquipped(1);
          (e as any).atkTimer = performance.now() / 1000 + 1;
          notify(`${e.kind} โจมตีคุณ! -${e.dmg}`, "#ff8a80");
        }
      }
    }
  }
  enemies = enemies.filter((e) => e.hp > 0);
}

function attack(): void {
  if (performance.now() / 1000 < attackCooldown) return;
  attackCooldown = performance.now() / 1000 + 0.5;
  // find nearest enemy within range 18
  let best: Enemy | null = null, bestD = 18;
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.pos.x, e.y - player.pos.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  const dmg = equippedDamage(player) + Math.floor(Math.random() * 2);
  if (best) {
    best.hp -= dmg;
    sfx.play("attack");
    wearEquipped(1);
    notify(`โจมตี ${best.kind}! -${dmg}`, "#ffd54f");
    if (best.hp <= 0) {
      const st = enemyStats(best.kind);
      notify(`⚔️ กำจัด ${st.name}! +${st.xp} XP`, "#aaf0c2");
      addXp(player, st.xp);
      questProgress("kill_slime", 1);
      if (st.boss) {
        questProgress("boss", 1);
        notify("👑 กำจัดราชาสไลม์ได้แล้ว!", "#ffd54f");
      }
      // loot
      const loot = Math.random() < 0.4 ? "meat_raw" : Math.random() < 0.5 ? "fiber" : null;
      if (loot) { addItem(player, loot, 1); notify(`ได้รับ ${ITEMS[loot]?.icon} ${ITEMS[loot]?.name}`, "#aaf0c2"); }
      if (st.hideChance && Math.random() < st.hideChance) {
        const n = st.boss ? 3 : 1;
        addItem(player, "hide", n);
        notify(`ได้รับ 🟫 หนังสัตว์ x${n}`, "#aaf0c2");
      }
      if (st.gold) { player.gold += st.gold; notify(`🪙 +${st.gold} gold`, "#ffd54f"); }
      sfx.play("kill");
      renderHud();
      if (addXpLevelCheck()) return;
    }
  } else {
    notify("ไม่มีศัตรูในระยะ", "#ffd54f");
  }
}

function addXpLevelCheck(): boolean {
  const leveled = addXp(player, 0);
  // addXp already called in kill; detect level up separately below in game loop
  return leveled;
}

// ============================================================
//  ACTION HANDLERS
// ============================================================
function facingTile(): { x: number; z: number } {
  return { x: Math.round(player.pos.x) + faceX, z: Math.round(player.pos.y) + faceZ };
}

function interact(): void {
  const px = Math.round(player.pos.x), pz = Math.round(player.pos.y);
  const ft = facingTile();

  // 0) merchant: trade
  if (merchant && ft.x === merchant.x && ft.z === merchant.z) {
    toggleTrade();
    return;
  }

  // 1) facing tile: door toggle / break placed building / harvest crop
  const ftTile = world.tileAt(ft.x, ft.z);
  if (isDoorTile(ftTile)) {
    const nt = toggledDoor(ftTile);
    if (nt !== undefined) {
      world.setEdit(ft.x, ft.z, nt);
      notify(nt === T_DOOR_OPEN ? "🚪 เปิดประตู" : "🚪 ปิดประตู", "#ffd54f");
    }
    return;
  }
  const breakItem = itemForBuildingTile(ftTile);
  if (breakItem) {
    world.removeEdit(ft.x, ft.z);
    addItem(player, breakItem, 1);
    notify(`ทุบ ${ITEMS[breakItem]?.icon} ${ITEMS[breakItem]?.name} ได้คืน 1`, "#ffd54f");
    renderHud();
    return;
  }
  if (ftTile === T_CROP_0 || ftTile === T_CROP_1 || ftTile === T_CROP_2) {
    harvestCrop(ft.x, ft.z);
    return;
  }

  // 2) standing tile: natural gather
  const g = world.gather(px, pz);
  if (g) {
    world.consume(px, pz);
    let mult = 1;
    const eq = player.equip ? ITEMS[player.equip] : null;
    if (eq?.tool === "axe" && g.item === "wood") mult = 2;
    if (eq?.tool === "pickaxe" && g.item === "stone") mult = 2;
    if (mult > 1) wearEquipped(1);
    addItem(player, g.item, g.count * mult);
    // chance of seeds when picking berries (farming starter)
    if (g.item === "berry" && Math.random() < 0.4) {
      addItem(player, "wheat_seed", 1);
      notify(`+${g.count * mult} ${ITEMS[g.item]?.icon} ${ITEMS[g.item]?.name} + 🌱 เมล็ดพืช`, "#aaf0c2");
    } else {
      notify(`+${g.count * mult} ${ITEMS[g.item]?.icon} ${ITEMS[g.item]?.name}`, "#aaf0c2");
    }
    if (g.item === "wood") questProgress("gather_wood", g.count * mult);
    if (g.item === "fiber" || g.item === "berry") addXp(player, 3);
    renderHud();
  }
}

function questProgress(id: string, amt: number): void {
  const finished = questLog.progressQuest(id, amt);
  if (finished) {
    const goldTxt = finished.rewardGold ? ` +${finished.rewardGold} gold` : "";
    notify(`✅ ภารกิจสำเร็จ: ${finished.icon} ${finished.name}! +${finished.rewardXp} XP${goldTxt}`, "#aaf0c2");
    addXp(player, finished.rewardXp);
    if (finished.rewardGold) player.gold += finished.rewardGold;
    sfx.play("quest");
  }
  renderQuests();
  renderHud();
}

function quickUse(slotIdx: number): void {
  const s = player.inv[slotIdx];
  selectedSlot = slotIdx;
  if (!s) { renderHud(); renderQuickBar(); return; }
  const def = ITEMS[s.item];
  if (def?.category === "food") {
    useItem(player, slotIdx);
    sfx.play("eat");
    notify(`กิน ${def.icon} ${def.name}`, "#aaf0c2");
  } else if (def?.category === "tool" || def?.category === "weapon") {
    useItem(player, slotIdx);
    player.equip = s.item;
    notify(`ถือ ${def.icon} ${def.name}`, "#ffd54f");
  }
  renderHud();
  renderQuickBar();
}

// ============================================================
//  BUILD / PLACE
// ============================================================
/** Place the selected placeable item at the facing tile. */
function placeBuilding(itemId: string): boolean {
  const def = buildableByItem(itemId);
  if (!def) return false;
  const ft = facingTile();
  const px = Math.round(player.pos.x), pz = Math.round(player.pos.y);
  if (ft.x === px && ft.z === pz) { notify("วางไม่ได้: ตรงตัวคุณ", "#ff8a80"); return false; }
  const t = world.tileAt(ft.x, ft.z);
  if (t === T_WATER) { notify("วางบนน้ำไม่ได้", "#ff8a80"); return false; }
  if (occupiedTile(t)) { notify("วางไม่ได้: มีสิ่งกีดขวาง", "#ff8a80"); return false; }
  if (!removeItem(player, itemId, 1)) { notify("ของไม่พอ", "#ff8a80"); return false; }
  world.setEdit(ft.x, ft.z, def.tile);
  sfx.play("place");
  notify(`วาง ${def.icon} ${def.name}`, "#aaf0c2");
  renderHud();
  return true;
}

/** Context action for the USE button, based on the selected slot. */
function useSelected(): void {
  if (selectedSlot < 0) return;
  const s = player.inv[selectedSlot];
  if (!s) return;
  if (buildableByItem(s.item)) {
    placeBuilding(s.item);
    return;
  }
  if (cropBySeedItem(s.item)) {
    plantSeed();
    return;
  }
  if (s.item === "fertilizer") {
    applyFertilizer();
    return;
  }
  quickUse(selectedSlot);
}

/** Label for the USE button given current selection. */
function useButtonLabel(): string {
  if (selectedSlot < 0) return "";
  const s = player.inv[selectedSlot];
  if (!s) return "";
  const b = buildableByItem(s.item);
  if (b) return `${b.icon}<br/><span style="font-size:9px">วาง</span>`;
  if (cropBySeedItem(s.item)) return `🌱<br/><span style="font-size:9px">ปลูก</span>`;
  if (s.item === "fertilizer") return `✨<br/><span style="font-size:9px">ปุ๋ย</span>`;
  const def = ITEMS[s.item];
  if (def?.category === "food") return `${def.icon}<br/><span style="font-size:9px">กิน</span>`;
  if (def?.category === "tool" || def?.category === "weapon") return `${def.icon}<br/><span style="font-size:9px">ถือ</span>`;
  return `${def?.icon ?? ""}<br/><span style="font-size:9px">ใช้</span>`;
}

// ============================================================
//  DURABILITY (task 07)
// ============================================================
/** ลดความทนทานของของที่ถืออยู่; แตกสลายเมื่อหมด */
function wearEquipped(amount = 1): void {
  if (!player.equip) return;
  const idx = player.inv.findIndex((x) => x.item === player.equip);
  if (idx < 0) { player.equip = null; return; }
  const slot = player.inv[idx]!;
  if (slot.dur === undefined) return;
  const r = wearSlot(slot, amount);
  slot.dur = r.dur;
  if (r.broke) {
    player.inv.splice(idx, 1);
    notify(`${ITEMS[slot.item]?.icon ?? ""} ${ITEMS[slot.item]?.name ?? slot.item} แตกสลาย!`, "#ff8a80");
    player.equip = null;
  }
  renderQuickBar();
}

// ============================================================
//  WORLD EVENTS (task 14)
// ============================================================
const TRADES: { give: string; giveCount: number; get: string; getCount: number }[] = [
  { give: "gold", giveCount: 8, get: "meat_cooked", getCount: 1 },
  { give: "gold", giveCount: 5, get: "torch", getCount: 2 },
  { give: "gold", giveCount: 4, get: "wheat_seed", getCount: 2 },
  { give: "gold", giveCount: 7, get: "corn_seed", getCount: 2 },
  { give: "gold", giveCount: 6, get: "fence", getCount: 2 },
  { give: "wood", giveCount: 4, get: "gold", getCount: 3 },
];

function spawnEnemyNear(dist: number): void {
  for (let tries = 0; tries < 12; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const ex = Math.round(player.pos.x + Math.cos(ang) * dist);
    const ey = Math.round(player.pos.y + Math.sin(ang) * dist);
    if (!world.isWalkable(ex, ey)) continue;
    const kind = rollEnemyKind(dayDarkness() > 0.5, Math.random());
    const st = enemyStats(kind);
    enemies.push({ x: ex, y: ey, hp: st.hp, maxHp: st.hp, dmg: st.dmg, kind, aggro: true, spd: st.spd, size: st.size });
    return;
  }
}

function freeTileNear(cx: number, cz: number, minD: number, maxD: number): { x: number; z: number } | null {
  for (let tries = 0; tries < 40; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const d = minD + Math.random() * (maxD - minD);
    const x = Math.round(cx + Math.cos(ang) * d);
    const z = Math.round(cz + Math.sin(ang) * d);
    if (world.isWalkable(x, z) && !(x === Math.round(player.pos.x) && z === Math.round(player.pos.y))) return { x, z };
  }
  return null;
}

function onEventStart(kind: EventKind): void {
  const def = eventDef(kind);
  notify(`${def.icon} เกิดเหตุการณ์: ${def.name}!`, "#ffd54f");
  if (kind === "migration") {
    for (let i = 0; i < 4; i++) spawnEnemyNear(24 + Math.random() * 20);
  } else if (kind === "merchant") {
    const spot = freeTileNear(Math.round(player.pos.x), Math.round(player.pos.y), 3, 8);
    if (spot) merchant = { x: spot.x, z: spot.z, until: gameSeconds + eventDef("merchant").duration };
    else notify("💰 พ่อค้าหาที่แวะไม่ได้...", "#ffd54f");
  } else if (kind === "camp") {
    const pool = ["wood", "stone", "berry", "fiber", "gold"];
    for (let i = 0; i < 3; i++) {
      const spot = freeTileNear(Math.round(player.pos.x), Math.round(player.pos.y), 2, 6);
      if (!spot) break;
      const item = pool[Math.floor(Math.random() * pool.length)]!;
      pickups.push({ x: spot.x, z: spot.z, item, count: item === "gold" ? 5 : 2 });
    }
    notify("⛺ พบแคมป์ร้าง — เดินเก็บของได้เลย", "#aaf0c2");
  }
}

function updateEvents(dt: number): void {
  void dt;
  const started = eventSched.tick(gameSeconds, dayCount, Math.random);
  if (started) onEventStart(started);

  if (merchant && gameSeconds >= merchant.until) {
    merchant = null;
    if (tradeOpen) closeTrade();
  }

  // wildfire: burn nearby resource tiles + heat damage tick
  if (eventSched.activeKind("wildfire", gameSeconds)) {
    const px = Math.round(player.pos.x), pz = Math.round(player.pos.y);
    for (let dz = -5; dz <= 5; dz++) {
      for (let dx = -5; dx <= 5; dx++) {
        const t = world.tileAt(px + dx, pz + dz);
        if ((t === T_TREE || t === T_BUSH || t === T_BERRY) && Math.random() < 0.08) world.consume(px + dx, pz + dz);
      }
    }
    if (gameSeconds >= fireDmgAt) {
      fireDmgAt = gameSeconds + 1;
      player.hp = Math.max(1, player.hp - 1);
      notify("🔥 ไฟป่าร้อนแรง! -1 HP", "#ff8a80");
    }
  }

  // ground pickups (walk over)
  const px = Math.round(player.pos.x), pz = Math.round(player.pos.y);
  pickups = pickups.filter((pk) => {
    if (pk.x !== px || pk.z !== pz) return true;
    if (pk.item === "gold") { player.gold += pk.count; notify(`🪙 +${pk.count} gold`, "#ffd54f"); }
    else { addItem(player, pk.item, pk.count); notify(`เก็บ ${ITEMS[pk.item]?.icon} ${ITEMS[pk.item]?.name} x${pk.count}`, "#aaf0c2"); }
    sfx.play("pickup");
    renderHud();
    return false;
  });

  // event banner countdown
  if (bannerEl) {
    const a = eventSched.active;
    if (a && gameSeconds < a.endsAt) {
      const def = eventDef(a.kind);
      bannerEl.textContent = `${def.icon} ${def.name} · ${Math.max(0, Math.ceil(a.endsAt - gameSeconds))}s`;
      bannerEl.style.display = "";
    } else {
      bannerEl.style.display = "none";
    }
  }
}

function toggleTrade(): void { if (tradeOpen) closeTrade(); else openTrade(); }
function openTrade(): void { tradeOpen = true; renderTrade(); }
function closeTrade(): void { tradeOpen = false; if (tradeEl) tradeEl.style.display = "none"; }

function renderTrade(): void {
  if (!tradeEl) return;
  let html = `<div style='font-weight:700;margin-bottom:6px;color:#ffd54f'>💰 พ่อค้าเร่ร่อน (gold: ${player.gold})</div>`;
  TRADES.forEach((tr, i) => {
    const gi = ITEMS[tr.give], ge = ITEMS[tr.get];
    const ok = countItems(player, tr.give) >= tr.giveCount;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px;border:1px solid ${ok ? "rgba(255,213,79,.5)" : "rgba(255,255,255,.12)"};border-radius:8px;margin-bottom:6px">
      <span style="font-size:12px">${gi?.icon ?? ""}${tr.giveCount} ➜ ${ge?.icon ?? ""}${tr.getCount} ${ge?.name ?? ""}</span>
      <button data-trade="${i}" style="border:0;border-radius:6px;padding:4px 8px;background:${ok ? "#b8860b" : "#2a3450"};color:${ok ? "#06101f" : "#8b93ad"};font-weight:700" ${ok ? "" : "disabled"}>แลก</button>
    </div>`;
  });
  tradeEl.innerHTML = html;
  tradeEl.style.display = "block";
  tradeEl.querySelectorAll<HTMLButtonElement>("[data-trade]").forEach((b) => {
    b.addEventListener("click", () => {
      const tr = TRADES[Number(b.dataset.trade)];
      if (!tr) return;
      if (!removeItem(player, tr.give, tr.giveCount)) { notify("ของไม่พอ", "#ff8a80"); return; }
      addItem(player, tr.get, tr.getCount);
      if (tr.get === "gold") notify(`💰 +${tr.getCount} gold`, "#ffd54f");
      else notify(`แลกได้ ${ITEMS[tr.get]?.icon} ${ITEMS[tr.get]?.name} x${tr.getCount}`, "#aaf0c2");
      questProgress("talk_merchant", 1);
      renderHud();
      renderTrade();
    });
  });
}

// ============================================================
//  FARMING
// ============================================================
const PLANTABLE_TILES = [T_GRASS, T_GRASS_ALT, T_DIRT];

/** Plant the selected seed item at the facing tile (grass/dirt only). */
function plantSeed(): boolean {
  const ft = facingTile();
  const t = world.tileAt(ft.x, ft.z);
  if (!PLANTABLE_TILES.includes(t)) {
    notify("ปลูกไม่ได้: ต้องเป็นหญ้าหรือดิน", "#ff8a80");
    return false;
  }
  if (occupiedTile(t) || farmPlots.has(ft.x, ft.z)) {
    notify("ปลูกไม่ได้: มีสิ่งกีดขวาง", "#ff8a80");
    return false;
  }
  const sel = selectedSlot >= 0 ? player.inv[selectedSlot] : undefined;
  const crop = sel ? cropBySeedItem(sel.item) : undefined;
  if (!crop || !removeItem(player, crop.seed, 1)) {
    notify("ไม่มีเมล็ดพืช", "#ff8a80");
    return false;
  }
  farmPlots.plant(ft.x, ft.z, crop.id, gameSeconds);
  world.setEdit(ft.x, ft.z, T_CROP_0);
  notify(`${crop.icon} ปลูก${crop.name}แล้ว รอโต...`, "#aaf0c2");
  renderHud();
  return true;
}

/** Stage 0..2 ของแปลงตามชนิดพืช (นับ elapsed แบบมีปุ๋ยเร่ง) */
function stageOf(cropId: string, plantedAt: number, fert: boolean): 0 | 1 | 2 {
  const crop = CROPS[cropId];
  if (!crop) return 0;
  const el = (gameSeconds - plantedAt) * (fert ? FERT_MULT : 1);
  return el >= crop.stages[2] ? 2 : el >= crop.stages[1] ? 1 : 0;
}

/** Advance crop growth; syncs world tiles to current stage. */
function farmingTick(dt: number): void {
  gameSeconds += dt;
  for (const e of farmPlots.entries()) {
    const stage = stageOf(e.plot.crop, e.plot.plantedAt, !!e.plot.fert);
    const tile = T_CROP_0 + stage;
    if (world.tileAt(e.x, e.z) !== tile) world.setEdit(e.x, e.z, tile);
  }
}

/** Harvest a mature crop at (x,z). */
function harvestCrop(x: number, z: number): void {
  if (!farmPlots.has(x, z)) return;
  if (!farmPlots.matureAt(x, z, gameSeconds)) {
    notify("🌱 พืชยังไม่โต", "#ffd54f");
    return;
  }
  const crop = farmPlots.harvest(x, z);
  if (!crop) return;
  world.setEdit(x, z, T_TILLED);
  const cnt = crop.harvestMin + Math.floor(Math.random() * (crop.harvestMax - crop.harvestMin + 1));
  addItem(player, crop.harvestItem, cnt);
  if (Math.random() < crop.seedChance) addItem(player, crop.seed, 1);
  addXp(player, 5);
  questProgress("harvest_crop", 1);
  sfx.play("harvest");
  notify(`${crop.icon} เก็บ${crop.name} x${cnt} +5 XP`, "#aaf0c2");
  renderHud();
}

/** ใส่ปุ๋ยแปลงที่หันหน้าไป (โตเร็วขึ้น) */
function applyFertilizer(): boolean {
  const ft = facingTile();
  if (!farmPlots.has(ft.x, ft.z)) { notify("ใส่ปุ๋ยได้เฉพาะแปลงปลูก", "#ff8a80"); return false; }
  if (farmPlots.matureAt(ft.x, ft.z, gameSeconds)) { notify("พืชสุกแล้ว เก็บได้เลย", "#ffd54f"); return false; }
  if (!farmPlots.fertilize(ft.x, ft.z)) { notify("แปลงนี้ใส่ปุ๋ยไปแล้ว", "#ffd54f"); return false; }
  if (!removeItem(player, "fertilizer", 1)) return false;
  notify("✨ ใส่ปุ๋ยแล้ว พืชโตเร็วขึ้น!", "#aaf0c2");
  renderHud();
  return true;
}

// ============================================================
//  QUICK BAR
// ============================================================
function renderQuickBar(): void {
  const qb = $("quick-bar");
  if (!qb) return;
  const shown = player.inv.slice(0, 6);
  qb.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const s = shown[i];
    const el = document.createElement("div");
    el.className = "qslot" + (i === selectedSlot ? " sel" : "");
    if (s) {
      const def = ITEMS[s.item];
      el.innerHTML = `${def?.icon ?? ""}<br/><span style="font-size:10px;color:#fff">${s.count}${def && (def.category === "tool" || def.category === "weapon") ? "•" : ""}</span>`;
    }
    el.addEventListener("touchstart", (e) => { e.preventDefault(); quickUse(i); }, { passive: false });
    el.addEventListener("mousedown", (e) => { e.preventDefault(); quickUse(i); });
    qb.appendChild(el);
  }
}

// ============================================================
//  HUD UPDATE
// ============================================================
function renderHud(): void {
  if (player.level > lastLevel) {
    if (lastLevel > 0) {
      sfx.play("levelup");
      notify(`⭐ เลเวลอัป! Lv ${player.level}`, "#ffd54f");
    }
    lastLevel = player.level;
  }
  $("hud-hp").textContent = `${Math.ceil(player.hp)}`;
  $("hud-hunger").textContent = `${Math.ceil(player.hunger)}`;
  const warmthEl = $("hud-warmth");
  if (warmthEl) warmthEl.textContent = `${Math.round(player.warmth ?? 50)}`;
  const goldEl = $("hud-gold");
  if (goldEl) goldEl.textContent = `${player.gold}`;
  $("hud-level").textContent = `${player.level}`;
  const need = xpNeed(player);
  const pct = Math.min(100, Math.round((player.xp / need) * 100));
  $("xp-fill").style.width = `${pct}%`;
}

// ============================================================
//  CONTROLS
// ============================================================
const joystick = new TouchJoystick();
const keyboard = new KeyboardInput();

function setupControls(): void {
  joystick.attach($("joy-zone"), $("joy-base"), $("joy-knob"));

  // attack
  setupButton($("btn-attack"), () => { attack(); });
  // interact (hold)
  setupButton($("btn-interact"), () => { interact(); }, () => {});
  // dodge
  setupButton($("btn-dodge"), () => { dodgeUntil = performance.now() / 1000 + 0.35; });
  // use (context: place building / eat / equip)
  setupButton($("btn-use"), () => { useSelected(); }, () => {});

  setupButton($("menu-btn"), () => { openPause(); }, () => {});
}

function dodgeMove(): boolean {
  return performance.now() / 1000 < dodgeUntil;
}

// ============================================================
//  PAUSE OVERLAY
// ============================================================
function openPause(): void {
  paused = true;
  running = false;
  overlay.classList.add("visible");
}

function closePause(): void {
  overlay.classList.remove("visible");
  paused = false;
  running = true;
  lastTs = performance.now();
}

// ============================================================
//  GAME UPDATE
// ============================================================
function update(dt: number): void {
  // movement
  const joy = joystick.read();
  const kb = keyboard.read();
  let dx = joy.dx || kb.dx;
  let dy = joy.dy || kb.dy;
  const mag = joy.magnitude || kb.magnitude;
  const speed = 90 * (dodgeMove() ? 3 : 1) * (eventSched.activeKind("storm", gameSeconds) ? 0.8 : 1);
  if (mag > 0) {
    // remember facing (dominant axis) for build/plant/interact targeting
    if (Math.abs(dx) >= Math.abs(dy)) { faceX = dx > 0 ? 1 : -1; faceZ = 0; }
    else { faceX = 0; faceZ = dy > 0 ? 1 : -1; }
    const nx = player.pos.x + dx * speed * dt;
    const ny = player.pos.y + dy * speed * dt;
    if (world.isWalkable(Math.round(nx), Math.round(player.pos.y))) player.pos.x = nx;
    if (world.isWalkable(Math.round(player.pos.x), Math.round(ny))) player.pos.y = ny;
  }

  // camera follow
  camX += (player.pos.x - camX) * Math.min(1, 8 * dt);
  camY += (player.pos.y - camY) * Math.min(1, 8 * dt);

  // explore quest: นับโซน 8x8 ที่เท้าถึงเป็นครั้งแรก
  const zoneKey = `${Math.floor(player.pos.x / 8)},${Math.floor(player.pos.y / 8)}`;
  if (!visitedZones.has(zoneKey)) {
    visitedZones.add(zoneKey);
    questProgress("explore", 1);
  }

  // survival
  survivalTick(player, dt);

  // body temperature (task 06)
  if (player.warmth === undefined) player.warmth = 50;
  const ambient = ambientTemperature(time, dayDarkness(), eventSched.activeKind("storm", gameSeconds), eventSched.activeKind("wildfire", gameSeconds));
  const standTile = world.tileAt(Math.round(player.pos.x), Math.round(player.pos.y));
  const faceTileHeat = world.tileAt(Math.round(player.pos.x) + faceX, Math.round(player.pos.y) + faceZ);
  const nearHeat = standTile === T_CAMPFIRE || faceTileHeat === T_CAMPFIRE || player.equip === "torch";
  const wr = warmthStep(player.warmth, ambient, nearHeat, dt);
  player.warmth = wr.warmth;
  if ((wr.cold || wr.hot) && player.warmth <= 0.5) {
    player.hp = Math.max(1, player.hp - dt * 0.8);
    if (gameSeconds >= coldMsgAt) {
      coldMsgAt = gameSeconds + 4;
      notify(wr.hot ? "🥵 ร้อนจัด! HP ลดลง" : "🥶 หนาวจัด! HP ลดลง", "#ff8a80");
    }
  }
  if (player.hp <= 0) {
    player.hp = 1;
    player.pos.x = 36; player.pos.y = 36;
    camX = 36; camY = 36;
    notify("💀 คุณฟื้นคืนชีพที่หมู่บ้าน!", "#ff8a80");
  }

  // time
  time += dt / DAY_LEN * 24;
  if (time >= 24) { time -= 24; dayCount++; }

  // farming growth
  farmingTick(dt);

  // world events
  updateEvents(dt);

  // autosave
  autosaveTimer += dt;
  if (autosaveTimer >= AUTOSAVE_EVERY) {
    autosaveTimer = 0;
    void saveNow("auto");
  }

  // combat
  updateEnemies(dt);

  // context: show interact button if gatherable tile OR facing building/door/crop
  const px = Math.round(player.pos.x), pz = Math.round(player.pos.y);
  const gatherable = world.gather(px, pz) !== null;
  const ft = facingTile();
  const ftTile = world.tileAt(ft.x, ft.z);
  const cropTile = ftTile === T_CROP_0 || ftTile === T_CROP_1 || ftTile === T_CROP_2;
  const facingInteractive = itemForBuildingTile(ftTile) !== undefined || isDoorTile(ftTile) || cropTile;
  $("btn-interact").style.display = (gatherable || facingInteractive) ? "" : "none";
  // use button follows selection, label reflects action
  const useEl = $("btn-use");
  const showUse = selectedSlot >= 0 && !!player.inv[selectedSlot];
  useEl.style.display = showUse ? "" : "none";
  if (showUse) {
    const lbl = useButtonLabel();
    if (useEl.dataset.lbl !== lbl) { useEl.innerHTML = lbl; useEl.dataset.lbl = lbl; }
  }
}

// ============================================================
//  MAIN LOOP
// ============================================================
function loop(ts: number): void {
  requestAnimationFrame(loop);
  if (!running) return;
  if (paused) return;
  if (window.innerHeight > window.innerWidth) return; // portrait -> rotate-screen shown by CSS
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  update(dt);
  render();
  renderMinimap();
  if (msgTimer > 0) {
    msgTimer -= dt;
    if (msgTimer <= 0) msgEl.textContent = "";
  }
  // level-up detection via HUD each frame (cheap enough)
  renderHud();
  renderQuickBar();
}

// ============================================================
//  MENU WIRING
// ============================================================
function goMainMenu(): void {
  void saveNow("auto");
  running = false;
  paused = false;
  showHud(false);
  overlay.classList.remove("visible");
  showScreen("screen-menu");
  void updateContinueBtn();
}

async function updateContinueBtn(): Promise<void> {
  const metas = saveMgr ? await saveMgr.listWorlds() : [];
  latestWorldId = metas.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null;
  $("btn-continue").style.display = latestWorldId ? "" : "none";
}


function lockLandscape(): void {
  try {
    const anyScr = screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } };
    const anyDoc = document as unknown as { webkitFullscreenElement?: Element; msFullscreenElement?: Element };
    const anyEl = document.documentElement as unknown as { webkitRequestFullscreen?: () => Promise<void> | void; msRequestFullscreen?: () => void };
    const fullscreen = document.fullscreenElement || anyDoc.webkitFullscreenElement || anyDoc.msFullscreenElement;
    // Request fullscreen (needed by some browsers before orientation lock)
    const fsReq = (document.documentElement as unknown as { requestFullscreen?: () => Promise<void> }).requestFullscreen ||
      anyEl.webkitRequestFullscreen || anyEl.msRequestFullscreen;
    if (fsReq && !fullscreen) {
      try { Promise.resolve(fsReq.call(document.documentElement)).catch(() => {}); } catch { /* ignore */ }
    }
    // Lock orientation to landscape
    if (anyScr.orientation && typeof anyScr.orientation.lock === "function") {
      anyScr.orientation.lock("landscape").catch(() => {});
    }
  } catch { /* orientation lock may be unsupported (desktop / iOS Safari) */ }
}

async function init(): Promise<void> {
  lockLandscape();
  buildDynamicUI();

  // save system (IndexedDB -> localStorage -> memory) + legacy migration
  try {
    const store = await pickStore();
    saveMgr = new SaveManager(store, () => {
      try { return localStorage.getItem(LEGACY_KEY); } catch { return null; }
    });
    await saveMgr.migrateLegacy();
  } catch {
    saveMgr = null; // game still playable without saves
  }

  // optional content pack (task 17): localStorage["suvival:content-pack"]
  try {
    const pack = packFromStorage(localStorage.getItem("suvival:content-pack"));
    if (pack) {
      const res = applyContentPack(pack);
      notify(`📦 content pack "${pack.name}": +${res.itemsAdded} items, ~${res.itemsOverridden} override, +${res.recipesAdded} recipes`, "#9fb0d8");
    }
  } catch { /* ignore pack errors */ }

  setupControls();

  // audio unlock on first user gesture (autoplay policy)
  const unlockAudio = () => sfx.unlock();
  addEventListener("pointerdown", unlockAudio, { once: true });
  addEventListener("touchstart", unlockAudio, { once: true });
  addEventListener("keydown", unlockAudio, { once: true });

  // menu
  $("btn-continue").addEventListener("click", () => { void playLatestWorld(); });
  $("btn-new").addEventListener("click", () => {
    showScreen("screen-create");
    // randomize seed
    $<HTMLInputElement>("world-seed").value = String(Math.floor(Math.random() * 999999));
  });
  $("btn-load").addEventListener("click", () => {
    showScreen("screen-worlds");
    void renderWorlds();
  });
  $("btn-settings").addEventListener("click", () => notify("ตั้งค่าอยู่ระหว่างพัฒนา", "#ffd54f"));
  $("btn-credits").addEventListener("click", () => notify("🧭 SuvivalCraft — ส่วนหนึ่งของ SuvivalAcraft", "#9fb0d8"));

  // worlds screen
  $("btn-worlds-new").addEventListener("click", () => {
    showScreen("screen-create");
    $<HTMLInputElement>("world-seed").value = String(Math.floor(Math.random() * 999999));
  });
  $("btn-worlds-back").addEventListener("click", () => { showScreen("screen-menu"); void updateContinueBtn(); });

  // character creation
  $("btn-random-seed").addEventListener("click", () => {
    $<HTMLInputElement>("world-seed").value = String(Math.floor(Math.random() * 999999));
  });
  document.querySelectorAll<HTMLElement>("#outfit-row .swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      document.querySelectorAll<HTMLElement>("#outfit-row .swatch").forEach((s) => s.classList.remove("sel"));
      sw.classList.add("sel");
      outfitColor = sw.dataset.c || "#e53935";
    });
  });
  $("btn-start").addEventListener("click", () => { void beginNewGame(); });

  // pause overlay
  $("btn-resume").addEventListener("click", () => { closePause(); });
  $("btn-save").addEventListener("click", () => { void saveNow("manual"); });
  $("btn-mainmenu").addEventListener("click", () => { goMainMenu(); });

  void updateContinueBtn();
  renderHud();

  // handle window resize
  function resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  resize();
  window.addEventListener("resize", resize);

  requestAnimationFrame(loop);
}

init().catch((err) => { console.error("init failed", err); });
