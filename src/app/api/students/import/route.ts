import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseRoster } from "@/lib/parse-roster";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let text = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file instanceof File) text = await file.text();
  } else {
    const body = await req.json().catch(() => ({}));
    text = String(body.csv ?? "");
  }

  const { rows } = parseRoster(text);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "ไม่พบแถวที่ถูกต้อง (รูปแบบ: รหัส11หลัก ชื่อ-นามสกุล)" },
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
