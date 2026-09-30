import { NextResponse } from "next/server";
import { db, nowParts } from "@/lib/db";

export async function GET() {
  const rows = db
    .prepare("SELECT student_id, name, created_at FROM students ORDER BY student_id")
    .all();
  return NextResponse.json({ count: rows.length, students: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const studentId = String(body.studentId ?? "").trim();
  const name = String(body.name ?? "").trim();

  if (!/^\d{11}$/.test(studentId)) {
    return NextResponse.json(
      { error: "รหัสนักศึกษาต้องเป็นตัวเลข 11 หลัก" },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json({ error: "กรอกชื่อ-นามสกุลด้วย" }, { status: 400 });
  }

  const dup = db
    .prepare("SELECT 1 FROM students WHERE student_id = ?")
    .get(studentId);
  if (dup) {
    return NextResponse.json(
      { error: "รหัสนี้มีอยู่ในทะเบียนแล้ว" },
      { status: 409 }
    );
  }

  db.prepare(
    "INSERT INTO students (student_id, name, created_at) VALUES (?, ?, ?)"
  ).run(studentId, name, nowParts().date);

  return NextResponse.json({ ok: true }, { status: 201 });
}
