export type RosterRow = { studentId: string; name: string };

/**
 * อ่านรายชื่อจากข้อความที่วาง (autodetect) รองรับต่อบรรทัด:
 *  - รหัสนำหน้า:  "69040249101\tนางสาว พิชญญาดา ดวงศรี" (tab / เว้นวรรค / , / ;)
 *  - ชื่อนำหน้า:  "นางสาว พิชญญาดา ดวงศรี 69040249101"
 * แถวที่หาไม่เจอรหัส 11 หลัก (เช่นหัวตาราง) ถือเป็น bad ไม่นำเข้า
 */
export function parseRoster(
  text: string
): { rows: RosterRow[]; bad: string[] } {
  const rows: RosterRow[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    let id = "";
    let name = "";
    const idFirst = line.match(/^(\d{11})[\s,;]+(.+)$/);
    const idLast = line.match(/^(.+?)[\s,;]+(\d{11})$/);
    if (idFirst) {
      id = idFirst[1];
      name = idFirst[2];
    } else if (idLast) {
      id = idLast[2];
      name = idLast[1];
    }

    name = name.replace(/\s+/g, " ").trim();
    if (!id || !name) {
      bad.push(line);
      continue;
    }
    if (seen.has(id)) continue; // ซ้ำในชุดเดียวกัน — เอาแถวแรก
    seen.add(id);
    rows.push({ studentId: id, name });
  }

  return { rows, bad };
}
