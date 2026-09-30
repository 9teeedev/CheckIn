import { NextResponse } from "next/server";
import { db, nowParts } from "@/lib/db";
import { extractStudentId } from "@/lib/util";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw: string = String(body.raw ?? body.studentId ?? "");
  const id = extractStudentId(raw);

  if (!id) {
    return NextResponse.json(
      { status: "badformat", message: "ไม่พบเลขรหัสนักศึกษา 11 หลัก" },
      { status: 400 }
    );
  }

  const student = db
    .prepare("SELECT name FROM students WHERE student_id = ?")
    .get(id) as { name: string } | undefined;

  if (!student) {
    return NextResponse.json(
      { status: "notfound", studentId: id, message: "รหัสนี้ไม่อยู่ในทะเบียน" },
      { status: 404 }
    );
  }

  const { date, time } = nowParts();

  const dup = db
    .prepare("SELECT time FROM checkins WHERE student_id = ? AND date = ?")
    .get(id, date) as { time: string } | undefined;

  if (dup) {
    return NextResponse.json({
      status: "duplicate",
      studentId: id,
      name: student.name,
      time: dup.time,
    });
  }

  db.prepare(
    "INSERT INTO checkins (student_id, date, time) VALUES (?, ?, ?)"
  ).run(id, date, time);

  return NextResponse.json({
    status: "ok",
    studentId: id,
    name: student.name,
    time,
  });
}
