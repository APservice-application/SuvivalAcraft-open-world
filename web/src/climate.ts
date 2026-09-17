// Climate / body temperature (web) — pure logic. งานที่ 06 (Temperature)
// Ambient temperature ขึ้นกับเวลาของวัน + ความมืด + สภาพอากาศ/เหตุการณ์
// ความอบอุ่น (warmth 0..100) ร่วงลงเมื่ออุณหภูมิโดยรอบสุดขั้ว, ฟื้นเมื่ออยู่ใกล้แหล่งความร้อน

export const WARMTH_MAX = 100;
export const WARMTH_START = 50;
export const COMFORT = 21; // °C ที่ร่างกายสบาย
export const COMFORT_BAND = 12; // ทนได้ ±12 °C โดยไม่เสีย warmth
const REGEN_RATE = 4; // warmth/s เมื่อสบาย
const HEAT_SOURCE_RATE = 10; // warmth/s ใกล้แคมป์ไฟ/คบเพลิง

/** Ambient temperature for the given conditions. */
export function ambientTemperature(hour: number, darkness: number, storm: boolean, wildfire: boolean): number {
  const dayCurve = Math.sin(((hour - 6) / 24) * Math.PI * 2); // peak ~12:00
  let t = 24 + dayCurve * 7 - darkness * 14;
  if (storm) t -= 4;
  if (wildfire) t += 6;
  return t;
}

/** Warmth drain per second (0 = comfortable). */
export function warmthDrain(ambient: number): number {
  const discomfort = Math.abs(ambient - COMFORT) - COMFORT_BAND;
  return discomfort > 0 ? Math.min(4, discomfort * 0.35) : 0;
}

export interface WarmthResult { warmth: number; draining: boolean; cold: boolean; hot: boolean; }

/** Advance warmth by dt. nearHeat = อยู่ใกล้แคมป์ไฟ / ถือคบเพลิง */
export function warmthStep(warmth: number, ambient: number, nearHeat: boolean, dt: number): WarmthResult {
  let w = warmth;
  const drain = warmthDrain(ambient);
  if (nearHeat) {
    w += HEAT_SOURCE_RATE * dt;
  } else if (drain > 0) {
    w -= drain * dt;
  } else {
    w += REGEN_RATE * dt;
  }
  w = Math.max(0, Math.min(WARMTH_MAX, w));
  return { warmth: w, draining: drain > 0 && !nearHeat, cold: w <= 20 && ambient < COMFORT, hot: w <= 20 && ambient > COMFORT + COMFORT_BAND };
}
