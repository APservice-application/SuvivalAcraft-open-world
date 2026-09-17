// Self-contained runtime world for the playable game.
// Tile-based 2D top-down. Data stays small so it works offline on mobile.
import { hash01 } from "../../game/src/core/rng.js";

export interface TPoint { x: number; z: number; }
export interface TChunk { cx: number; cz: number; tiles: Uint8Array; }
export type BiomeKind = "grassland" | "forest" | "rocky" | "water";

export const TILE_SIZE = 16;

// tile ids
export const T_GRASS = 0;
export const T_GRASS_ALT = 1;
export const T_DIRT = 2;
export const T_SAND = 3;
export const T_WATER = 4;
export const T_STONE = 5;
export const T_TREE = 6;
export const T_ROCK = 7;
export const T_BUSH = 8;
export const T_BERRY = 9;
export const T_FLOOR = 10;
export const T_PATH = 11;
// player-placed / farm tiles
export const T_FENCE = 12;
export const T_WALL = 13;
export const T_DOOR = 14;
export const T_DOOR_OPEN = 15;
export const T_CAMPFIRE = 16;
export const T_TILLED = 17;
export const T_CROP_0 = 18;
export const T_CROP_1 = 19;
export const T_CROP_2 = 20; // mature

const CHUNK = 24;

export function tileName(id: number): string {
  switch (id) {
    case T_GRASS: return "grass";
    case T_GRASS_ALT: return "grass";
    case T_DIRT: return "dirt";
    case T_SAND: return "sand";
    case T_WATER: return "water";
    case T_STONE: return "stone";
    case T_TREE: return "wood_log";
    case T_ROCK: return "stone";
    case T_BUSH: return "leaves";
    case T_BERRY: return "wheat_crop_2";
    case T_FLOOR: return "wood_planks";
    case T_PATH: return "cobblestone_block";
    default: return "grass";
  }
}

function chunkOf(x: number, z: number): TPoint {
  return { x: Math.floor(x / CHUNK), z: Math.floor(z / CHUNK) };
}

export class World {
  seed: number;
  /** player edits: key "x,z" -> tile id (overrides generated terrain) */
  private edits = new Map<string, number>();
  private chunks = new Map<string, TChunk>();

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  private ckey(cx: number, cz: number): string { return `${cx},${cz}`; }

  ensureChunk(cx: number, cz: number): TChunk {
    const k = this.ckey(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = this.generateChunk(cx, cz);
      this.chunks.set(k, c);
    }
    return c;
  }

  private generateChunk(cx: number, cz: number): TChunk {
    const tiles = new Uint8Array(CHUNK * CHUNK);
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const wx = cx * CHUNK + lx;
        const wz = cz * CHUNK + lz;
        const n = hash01(wx, wz, this.seed);
        let t = T_GRASS;
        // Water / river pockets
        if (n < 0.12) t = T_WATER;
        else if (n < 0.3) t = T_GRASS_ALT;
        else if (n < 0.4) t = T_DIRT;
        else if (n < 0.48) t = T_SAND;
        else if (n < 0.6) {
          t = hash01(wx, wz, this.seed + 7) < 0.5 ? T_TREE : T_GRASS;
        } else if (n < 0.66) {
          t = hash01(wx, wz, this.seed + 11) < 0.6 ? T_ROCK : T_STONE;
        } else if (n < 0.7) {
          t = T_BUSH;
        } else if (n < 0.73) {
          t = T_BERRY;
        }
        tiles[lz * CHUNK + lx] = t;
      }
    }
    // village at chunk (1,1)
    if (cx >= 0 && cx <= 2 && cz >= 0 && cz <= 2) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const wx = cx * CHUNK + lx;
          const wz = cz * CHUNK + lz;
          if (Math.abs(wx - 36) < 8 && Math.abs(wz - 36) < 8) {
            if (Math.abs(wx - 36) < 6 && Math.abs(wz - 36) < 6) {
              tiles[lz * CHUNK + lx] = (wx + wz) % 2 ? T_PATH : T_FLOOR;
            }
          }
        }
      }
    }
    return { cx, cz, tiles };
  }

  tileAt(x: number, z: number): number {
    const e = this.edits.get(`${x},${z}`);
    if (e !== undefined) return e;
    const c = chunkOf(x, z);
    const chunk = this.ensureChunk(c.x, c.z);
    const lx = ((x % CHUNK) + CHUNK) % CHUNK;
    const lz = ((z % CHUNK) + CHUNK) % CHUNK;
    return chunk.tiles[lz * CHUNK + lx] ?? 0;
  }

  /** Player-placed edit: overrides terrain at (x,z). tile = base tile removes the edit. */
  setEdit(x: number, z: number, tile: number): void {
    this.edits.set(`${x},${z}`, tile);
  }

  removeEdit(x: number, z: number): void {
    this.edits.delete(`${x},${z}`);
  }

  hasEdit(x: number, z: number): boolean {
    return this.edits.has(`${x},${z}`);
  }

  /** Serialize edits for save: [x, z, tile][] */
  getEdits(): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (const [k, t] of this.edits) {
      const [xs, zs] = k.split(",");
      out.push([Number(xs), Number(zs), t]);
    }
    return out;
  }

  /** Restore edits from a save. */
  setEdits(list: [number, number, number][]): void {
    this.edits.clear();
    for (const [x, z, t] of list) this.edits.set(`${x},${z}`, t);
  }

  /** Returns gathered yield for breaking resource tile, or 0. */
  gather(x: number, z: number): { item: string; count: number } | null {
    const t = this.tileAt(x, z);
    switch (t) {
      case T_TREE: return { item: "wood", count: 3 };
      case T_ROCK: return { item: "stone", count: 2 };
      case T_BUSH: return { item: "fiber", count: 2 };
      case T_BERRY: return { item: "berry", count: 1 };
      default: return null;
    }
  }

  /** Consume a resource tile (set to its base). */
  consume(x: number, z: number): void {
    const c = chunkOf(x, z);
    const chunk = this.ensureChunk(c.x, c.z);
    const lx = ((x % CHUNK) + CHUNK) % CHUNK;
    const lz = ((z % CHUNK) + CHUNK) % CHUNK;
    chunk.tiles[lz * CHUNK + lx] = T_GRASS;
  }

  isWalkable(x: number, z: number): boolean {
    const t = this.tileAt(x, z);
    return t !== T_WATER && t !== T_STONE && t !== T_ROCK && t !== T_TREE
      && t !== T_FENCE && t !== T_WALL && t !== T_DOOR && t !== T_CAMPFIRE;
  }
}
