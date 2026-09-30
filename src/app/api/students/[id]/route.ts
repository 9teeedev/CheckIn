import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const studentId = id.trim();
  if (!/^\d{11}$/.test(studentId)) {
    return NextResponse.json({ error: "รหัสนักศึกษาไม่ถูกต้อง" }, { status: 400 });
  }
  const result = db
    .prepare("DELETE FROM students WHERE student_id = ?")
    .run(studentId);
  if (Number(result.changes) === 0) {
    return NextResponse.json({ error: "ไม่พบรหัสนี้ในทะเบียน" }, { status: 404 });
  }
  db.prepare("DELETE FROM checkins WHERE student_id = ?").run(studentId);
  return NextResponse.json({ ok: true });
}
