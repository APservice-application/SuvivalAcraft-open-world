// Building system (web) — pure logic, no DOM.
// Maps placeable item ids <-> world tiles, with door open/close rules.
import { T_FENCE, T_WALL, T_DOOR, T_DOOR_OPEN, T_CAMPFIRE, T_TREE, T_ROCK, T_BUSH, T_BERRY } from "./world.js";

export interface BuildableDef {
  item: string;
  name: string;
  icon: string;
  tile: number;
  /** door can be toggled open/closed */
  door?: boolean;
}

/** Items the player can place into the world. */
export const BUILDABLES: Record<string, BuildableDef> = {
  fence: { item: "fence", name: "รั้วไม้", icon: "🚧", tile: T_FENCE },
  wall: { item: "wall", name: "กำแพงหิน", icon: "🧱", tile: T_WALL },
  door: { item: "door", name: "ประตูไม้", icon: "🚪", tile: T_DOOR, door: true },
  campfire: { item: "campfire", name: "แคมป์ไฟ", icon: "🔥", tile: T_CAMPFIRE },
};

export function buildableByItem(itemId: string): BuildableDef | undefined {
  return BUILDABLES[itemId];
}

/** Door tiles (closed or open) — used for interact/toggle. */
export function isDoorTile(t: number): boolean {
  return t === T_DOOR || t === T_DOOR_OPEN;
}

/** Toggle a door tile; returns the new tile or undefined if not a door. */
export function toggledDoor(t: number): number | undefined {
  if (t === T_DOOR) return T_DOOR_OPEN;
  if (t === T_DOOR_OPEN) return T_DOOR;
  return undefined;
}

/** Item id refunded when breaking a placed tile (undefined = not a placed building). */
export function itemForBuildingTile(t: number): string | undefined {
  switch (t) {
    case T_FENCE: return "fence";
    case T_WALL: return "wall";
    case T_DOOR: case T_DOOR_OPEN: return "door";
    case T_CAMPFIRE: return "campfire";
    default: return undefined;
  }
}

/** True if a tile already contains something that blocks building on top of it. */
export function occupiedTile(t: number): boolean {
  switch (t) {
    case T_FENCE: case T_WALL: case T_DOOR: case T_DOOR_OPEN: case T_CAMPFIRE:
    case T_TREE: case T_ROCK: case T_BUSH: case T_BERRY:
      return true;
    default:
      return false;
  }
}
