import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function parseCsv(text: string): { studentId: string; name: string }[] {
  const out: { studentId: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = trimmed.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;
    const idCol = cols[0];
    if (!/^\d{11}$/.test(idCol)) continue; // ข้าม header และแถวเสีย
    const name = cols.slice(1).filter(Boolean).join(" ");
    if (!name || seen.has(idCol)) continue;
    seen.add(idCol);
    out.push({ studentId: idCol, name });
  }
  return out;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let csvText = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file instanceof File) csvText = await file.text();
  } else {
    const body = await req.json().catch(() => ({}));
    csvText = String(body.csv ?? "");
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "ไม่พบแถวที่ถูกต้อง (รูปแบบ: รหัส11หลัก,ชื่อ)" },
      { status: 400 }
    );
  }

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO students (student_id, name, created_at) VALUES (?, ?, date('now'))"
  );
  let added = 0;
  for (const r of rows) {
    added += Number(stmt.run(r.studentId, r.name).changes);
  }

  return NextResponse.json({
    ok: true,
    parsed: rows.length,
    added,
    skipped: rows.length - added,
  });
}
