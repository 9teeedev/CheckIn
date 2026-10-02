/** รูปแบบ data ของแผนที่นั่ง: { "โต๊ะ:ที่": รหัสนักศึกษา } เช่น { "3:5": "67040249128" } */
export function parseSeatingData(raw: string): Record<string, string> {
  try {
    const obj = JSON.parse(raw || "{}");
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, string>;
    }
  } catch {
    /* data เสียถือว่าแผนว่าง */
  }
  return {};
}

/** โต๊ะ 1-24 ที่นั่ง 1-8 คีย์ "t:s" / รหัสนักศึกษา 11 หลัก */
const KEY_RE = /^([1-9]|1\d|2[0-4]):[1-8]$/;

export function validSeatingData(data: unknown): data is Record<string, string> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return Object.entries(data as Record<string, unknown>).every(
    ([k, v]) => KEY_RE.test(k) && typeof v === "string" && /^\d{11}$/.test(v)
  );
}
