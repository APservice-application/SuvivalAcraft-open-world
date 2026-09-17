// SuvivalAcraft Open World — main game wiring (mobile-first, touch-first)
import { World, TILE_SIZE, T_WATER, T_STONE, T_ROCK, T_TREE, T_BUSH, T_BERRY, T_GRASS, T_GRASS_ALT, T_DIRT, T_SAND, T_FLOOR, T_PATH, T_FENCE, T_WALL, T_DOOR, T_DOOR_OPEN, T_CAMPFIRE, T_TILLED, T_CROP_0, T_CROP_1, T_CROP_2, tileName } from "./world.js";
import {
  PlayerState, newPlayer, addItem, removeItem, countItems, canCraft, craftRecipe,
  useItem, equippedDamage, survivalTick, addXp, saveGame, loadGame, hasSave, xpNeed,
  ITEMS, RECIPES, Slot,
} from "./state.js";
import { buildableByItem, isDoorTile, toggledDoor, itemForBuildingTile, occupiedTile } from "./building.js";
import { FarmPlots, cropStageAt, isMatureAt, plotKey } from "./farming.js";
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

interface Enemy { x: number; y: number; hp: number; maxHp: number; dmg: number; kind: string; aggro: boolean; }
let enemies: Enemy[] = [];
let spawnTimer = 0;

// ---------- Minimap ----------
let minimapCv: HTMLCanvasElement | null = null;
let minimapCtx: CanvasRenderingContext2D | null = null;

// ---------- Quest tracker ----------
interface Quest { id: string; name: string; desc: string; target: number; progress: number; done: boolean; }
let quests: Quest[] = [
  { id: "gather_wood", name: "เก็บไม้", desc: "เก็บไม้ 5", target: 5, progress: 0, done: false },
  { id: "kill_slime", name: "ปราบศัตรู", desc: "กำจัดศัตรู 2", target: 2, progress: 0, done: false },
  { id: "harvest_crop", name: "เก็บเกี่ยว", desc: "เก็บพืชผล 2 ครั้ง", target: 2, progress: 0, done: false },
];
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
}

function renderCraft(): void {
  if (!craftEl) return;
  let html = "<div style='font-weight:700;margin-bottom:6px;color:#8fb0ff'>🔨 คราฟต์</div>";
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
  craftEl.querySelectorAll<HTMLButtonElement>("[data-craft]").forEach((b) => {
    b.addEventListener("click", () => {
      const r = RECIPES.find((x) => x.id === b.dataset.craft);
      if (r && craftRecipe(r, player)) {
        notify(`CRAFTED: ${r.icon} ${r.name}`, "#aaf0c2");
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
  const active = quests.filter((q) => !q.done);
  if (active.length === 0) {
    questEl.innerHTML = "<div style='color:#fff;font-size:13px;background:rgba(10,16,30,.7);border-radius:8px;padding:4px 8px'>✅ ภารกิจสำเร็จทั้งหมด</div>";
    return;
  }
  questEl.innerHTML = active.map((q) => {
    const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
    return `<div style="background:rgba(10,16,30,.72);border-radius:8px;padding:5px 9px;font-size:12px;color:#ecf0ff;border:1px solid rgba(255,255,255,.12)">
      <div><b>${q.name}</b></div>
      <div style="color:#9fb0d8;font-size:11px">${q.desc} <span style="color:#aaf0c2">${q.progress}/${q.target}</span></div>
      <div style="height:4px;background:#14203a;border-radius:2px;margin-top:3px"><div style="height:100%;width:${pct}%;background:#8fb0ff"></div></div>
    </div>`;
  }).join("");
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

function startGame(p: PlayerState, seed: number, t: number): void {
  player = p;
  gameSeed = seed;
  world = new World(seed);
  time = t;
  gameSeconds = 0;
  farmPlots = new FarmPlots();
  camX = p.pos.x;
  camY = p.pos.y;
  enemies = [];
  spawnTimer = 1;
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

function beginNewGame(): void {
  const seedInput = $<HTMLInputElement>("world-seed").value || "1337";
  const seed = seedFrom(seedInput);
  const name = $<HTMLInputElement>("char-name").value || "นักผจญภัย";
  // spawn near village center (36,36)
  const p = newPlayer(name, outfitColor, 36, 36);
  startGame(p, seed, 6);
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
    ctx.fillStyle = e.kind === "slime" ? "#7ce0a0" : "#d97878";
    ctx.fillRect(sx + 3, sy + 3, 10, 10);
    // hp bar
    const pct = e.hp / e.maxHp;
    ctx.fillStyle = "#14203a";
    ctx.fillRect(sx, sy - 3, 14, 2);
    ctx.fillStyle = pct > 0.5 ? "#7ce07c" : "#e05353";
    ctx.fillRect(sx, sy - 3, 14 * pct, 2);
    // eyes
    ctx.fillStyle = "#000";
    ctx.fillRect(sx + 5, sy + 5, 2, 2);
    ctx.fillRect(sx + 10, sy + 5, 2, 2);
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
      c.fillStyle = id === T_WATER ? "#3a7bd5" : id === T_TREE ? "#2e6b2e" : id === T_ROCK ? "#777" : id === T_SAND ? "#d9c27a" : "#3f8f43";
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
  while (enemies.length < 3) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 80;
    const ex = Math.round(camX + Math.cos(ang) * dist);
    const ey = Math.round(camY + Math.sin(ang) * dist);
    if (!world.isWalkable(ex, ey)) continue;
    enemies.push({ x: ex, y: ey, hp: 12, maxHp: 12, dmg: 3, kind: Math.random() < 0.5 ? "slime" : "goblin", aggro: false });
  }
}

function updateEnemies(dt: number): void {
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnEnemies(); spawnTimer = 5; }
  for (const e of enemies) {
    const dx = player.pos.x - e.x, dy = player.pos.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) e.aggro = true;
    if (e.aggro) {
      const speed = 2.4 * dt;
      if (dist > 1) {
        e.x += (dx / dist) * speed;
        e.y += (dy / dist) * speed;
      }
      if (dist < 1.4) {
        if (performance.now() / 1000 > (e as any).atkTimer) {
          player.hp = Math.max(0, player.hp - e.dmg);
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
    notify(`โจมตี ${best.kind}! -${dmg}`, "#ffd54f");
    if (best.hp <= 0) {
      notify(`⚔️ กำจัด ${best.kind}! +20 XP`, "#aaf0c2");
      addXp(player, 20);
      questProgress("kill_slime", 1);
      // loot
      const loot = Math.random() < 0.4 ? "meat_raw" : Math.random() < 0.5 ? "fiber" : null;
      if (loot) { addItem(player, loot, 1); notify(`ได้รับ ${ITEMS[loot]?.icon} ${ITEMS[loot]?.name}`, "#aaf0c2"); }
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
  const q = quests.find((x) => x.id === id && !x.done);
  if (!q) return;
  q.progress += amt;
  if (q.progress >= q.target) {
    q.done = true;
    notify(`✅ ภารกิจสำเร็จ: ${q.name}! +50 XP`, "#aaf0c2");
    addXp(player, 50);
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
  if (s.item === "wheat_seed") {
    plantSeed();
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
  if (s.item === "wheat_seed") return `🌱<br/><span style="font-size:9px">ปลูก</span>`;
  const def = ITEMS[s.item];
  if (def?.category === "food") return `${def.icon}<br/><span style="font-size:9px">กิน</span>`;
  if (def?.category === "tool" || def?.category === "weapon") return `${def.icon}<br/><span style="font-size:9px">ถือ</span>`;
  return `${def?.icon ?? ""}<br/><span style="font-size:9px">ใช้</span>`;
}

// ============================================================
//  FARMING
// ============================================================
const PLANTABLE_TILES = [T_GRASS, T_GRASS_ALT, T_DIRT];

/** Plant the seed item at the facing tile (grass/dirt only). */
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
  if (!removeItem(player, "wheat_seed", 1)) {
    notify("ไม่มีเมล็ดพืช", "#ff8a80");
    return false;
  }
  farmPlots.plant(ft.x, ft.z, gameSeconds);
  world.setEdit(ft.x, ft.z, T_CROP_0);
  notify("🌱 ปลูกเมล็ดพืชแล้ว รอโต...", "#aaf0c2");
  renderHud();
  return true;
}

/** Advance crop growth; syncs world tiles to current stage. */
function farmingTick(dt: number): void {
  gameSeconds += dt;
  for (const e of farmPlots.entries()) {
    const stage = cropStageAt(e.plantedAt, gameSeconds);
    const tile = T_CROP_0 + stage;
    if (world.tileAt(e.x, e.z) !== tile) world.setEdit(e.x, e.z, tile);
  }
}

/** Harvest a mature crop at (x,z). */
function harvestCrop(x: number, z: number): void {
  const planted = farmPlots.state[plotKey(x, z)];
  if (planted === undefined) return;
  if (!isMatureAt(planted, gameSeconds)) {
    notify("🌱 พืชยังไม่โต", "#ffd54f");
    return;
  }
  farmPlots.harvest(x, z);
  world.setEdit(x, z, T_TILLED);
  const cnt = 1 + (Math.random() < 0.5 ? 1 : 0);
  addItem(player, "wheat", cnt);
  if (Math.random() < 0.5) addItem(player, "wheat_seed", 1);
  addXp(player, 5);
  questProgress("harvest_crop", 1);
  notify(`🌾 เก็บข้าว x${cnt} +5 XP`, "#aaf0c2");
  renderHud();
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
  $("hud-hp").textContent = `${Math.ceil(player.hp)}`;
  $("hud-hunger").textContent = `${Math.ceil(player.hunger)}`;
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
  const speed = 90 * (dodgeMove() ? 3 : 1);
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

  // survival
  survivalTick(player, dt);
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
  running = false;
  paused = false;
  showHud(false);
  overlay.classList.remove("visible");
  showScreen("screen-menu");
  updateContinueBtn();
}

function updateContinueBtn(): void {
  $("btn-continue").style.display = hasSave() ? "" : "none";
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

function init(): void {
  lockLandscape();
  buildDynamicUI();

  setupControls();

  // menu
  $("btn-continue").addEventListener("click", () => {
    const s = loadGame();
    if (s) {
      // outfit from saved player
      startGame(s.p, s.seed, s.time);
    }
  });
  $("btn-new").addEventListener("click", () => {
    showScreen("screen-create");
    // randomize seed
    $<HTMLInputElement>("world-seed").value = String(Math.floor(Math.random() * 999999));
  });
  $("btn-load").addEventListener("click", () => {
    const s = loadGame();
    if (s) {
      startGame(s.p, s.seed, s.time);
    } else {
      notify("ไม่มีไฟล์เซฟ", "#ff8a80");
      showScreen("screen-menu");
    }
  });
  $("btn-settings").addEventListener("click", () => notify("ตั้งค่าอยู่ระหว่างพัฒนา", "#ffd54f"));
  $("btn-credits").addEventListener("click", () => notify("🧭 SuvivalCraft — ส่วนหนึ่งของ SuvivalAcraft", "#9fb0d8"));

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
  $("btn-start").addEventListener("click", () => { beginNewGame(); });

  // pause overlay
  $("btn-resume").addEventListener("click", () => { closePause(); });
  $("btn-save").addEventListener("click", () => {
    saveGame(player, gameSeed, time);
    notify("💾 บันทึกเกมแล้ว", "#aaf0c2");
  });
  $("btn-mainmenu").addEventListener("click", () => { goMainMenu(); });

  updateContinueBtn();
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

init();
