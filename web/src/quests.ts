// Quest system (web) — pure. เควสเป็นสาย (chain) + ประเภทใหม่: explore / talk / boss
export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  target: number;
  rewardXp: number;
  rewardGold?: number;
  /** ปลดล็อกเมื่อเควสนี้เสร็จก่อน (quest chain) */
  after?: string;
}

export const QUEST_DEFS: QuestDef[] = [
  { id: "gather_wood", name: "เก็บไม้", desc: "เก็บไม้ 5", icon: "🪵", target: 5, rewardXp: 50 },
  { id: "craft_tool", name: "ตีเครื่องมือ", desc: "คราฟต์ของ 1 ชิ้น", icon: "🪓", target: 1, rewardXp: 40, after: "gather_wood" },
  { id: "kill_slime", name: "ปราบศัตรู", desc: "กำจัดศัตรู 2", icon: "⚔️", target: 2, rewardXp: 50, after: "craft_tool" },
  { id: "explore", name: "นักสำรวจ", desc: "สำรวจพื้นที่ 4 โซน", icon: "🧭", target: 4, rewardXp: 60, rewardGold: 10, after: "gather_wood" },
  { id: "harvest_crop", name: "เก็บเกี่ยว", desc: "เก็บพืชผล 2 ครั้ง", icon: "🌾", target: 2, rewardXp: 45, after: "explore" },
  { id: "talk_merchant", name: "เจอพ่อค้า", desc: "แลกของกับพ่อค้า 1 ครั้ง", icon: "💰", target: 1, rewardXp: 30, rewardGold: 5, after: "harvest_crop" },
  { id: "boss", name: "ราชาแห่งสไลม์", desc: "กำจัดราชาสไลม์", icon: "👑", target: 1, rewardXp: 100, rewardGold: 50, after: "talk_merchant" },
];

export function questDefById(id: string): QuestDef | undefined {
  return QUEST_DEFS.find((q) => q.id === id);
}

/** เควสปลดล็อกเมื่อไม่มีเงื่อนไข after หรือเควสก่อนหน้าเสร็จแล้ว */
export function isUnlocked(def: QuestDef, done: Record<string, boolean>): boolean {
  return !def.after || !!done[def.after];
}

export class QuestLog {
  progress: Record<string, number> = {};
  done: Record<string, boolean> = {};

  reset(): void {
    this.progress = {};
    this.done = {};
  }

  /** เควสที่ปลดล็อกและยังไม่เสร็จ */
  active(): QuestDef[] {
    return QUEST_DEFS.filter((q) => !this.done[q.id] && isUnlocked(q, this.done));
  }

  /** จำนวนเควสที่ยังล็อกอยู่ */
  lockedCount(): number {
    return QUEST_DEFS.filter((q) => !this.done[q.id] && !isUnlocked(q, this.done)).length;
  }

  /** บันทึกความคืบหน้า; คืน def ทันทีที่เควสเสร็จ (ครั้งเดียว), ไม่งั้น null */
  progressQuest(id: string, amt: number): QuestDef | null {
    const def = questDefById(id);
    if (!def || this.done[id]) return null;
    if (!isUnlocked(def, this.done)) return null; // ยังล็อก — นับไม่ได้
    const before = this.progress[id] ?? 0;
    this.progress[id] = before + amt;
    if (this.progress[id]! >= def.target) {
      this.done[id] = true;
      return def;
    }
    return null;
  }
}
