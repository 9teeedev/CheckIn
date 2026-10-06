export type TablePos = { x: number; y: number };
/** เรขาคณิตผ้าใบที่ใช้ตอนบันทึกตำแหน่ง (เปลี่ยนขนาดผ้าใบแล้ว rescale ตำแหน่งเก่าได้) */
export type CanvasGeo = { w: number; gx: number; gy: number };

/** รูปแบบ data ของแผนที่นั่ง v2:
 *  seats = { "โต๊ะ:ที่": รหัสนักศึกษา } เช่น { "3:5": "67040249128" }
 *  tables = ตำแหน่ง x/y ของแต่ละโต๊ะบีผืนผ้าใบ (ลากจัดเองได้)
 *  geo = ความกว้างผ้าใบ + ระยะห่างตารางตอนบันทึก */
export type SeatingData = {
  v: 2;
  seats: Record<string, string>;
  tables: Record<string, TablePos>;
  geo?: CanvasGeo;
};

/** คีย์ที่นั่ง "t:s" — โต๊ะ 1-999 ที่นั่ง 1-8 / รหัสนักศึกษา 11 หลัก */
const KEY_RE = /^([1-9]\d{0,2}):[1-8]$/;
const TABLE_NO_RE = /^[1-9]\d{0,2}$/;
const ID_RE = /^\d{11}$/;

function cleanSeats(input: unknown): Record<string, string> {
  const seats: Record<string, string> = {};
  if (!input || typeof input !== "object") return seats;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (KEY_RE.test(k) && typeof v === "string" && ID_RE.test(v)) seats[k] = v;
  }
  return seats;
}

function cleanTables(input: unknown): Record<string, TablePos> {
  const tables: Record<string, TablePos> = {};
  if (!input || typeof input !== "object") return tables;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const p = v as { x?: unknown; y?: unknown } | null;
    if (
      TABLE_NO_RE.test(k) &&
      p &&
      typeof p === "object" &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y)
    ) {
      tables[k] = { x: p.x as number, y: p.y as number };
    }
  }
  return tables;
}

function cleanGeo(input: unknown): CanvasGeo | undefined {
  if (!input || typeof input !== "object") return undefined;
  const g = input as { w?: unknown; gx?: unknown; gy?: unknown };
  if (
    Number.isFinite(g.w) &&
    Number.isFinite(g.gx) &&
    Number.isFinite(g.gy) &&
    (g.w as number) > 0
  ) {
    return { w: g.w as number, gx: g.gx as number, gy: g.gy as number };
  }
  return undefined;
}

/** อ่านแผนจาก DB — รูปเก่า { "t:s": รหัส } กลางเป็น seats, รูปใหม่ v2 ครบทั้ง seats+tables */
export function parseSeatingPlan(raw: string): SeatingData {
  try {
    const obj = JSON.parse(raw || "{}");
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      if (obj.v === 2) {
        return {
          v: 2,
          seats: cleanSeats(obj.seats),
          tables: cleanTables(obj.tables),
          geo: cleanGeo(obj.geo),
        };
      }
      return { v: 2, seats: cleanSeats(obj), tables: {} };
    }
  } catch {
    /* data เสียถือว่าแผนว่าง */
  }
  return { v: 2, seats: {}, tables: {} };
}

export function validSeatingData(data: unknown): data is SeatingData {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as { v?: unknown; seats?: unknown; tables?: unknown };
  if (d.v !== 2) return false;
  const seats = cleanSeats(d.seats);
  if (Object.keys(seats).length !== Object.keys(d.seats ?? {}).length) return false;
  if (d.tables != null) {
    const tables = cleanTables(d.tables);
    if (Object.keys(tables).length !== Object.keys(d.tables).length) return false;
  }
  return true;
}
