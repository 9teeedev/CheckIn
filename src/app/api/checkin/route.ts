import { NextResponse } from "next/server";
import { db, nowParts } from "@/lib/db";
import { extractStudentId } from "@/lib/util";
import { parseSeatingPlan } from "@/lib/seating";

/** หาโต๊ะ/ที่นั่งของคนนี้จากแผนที่นั่ง (แผนที่แก้ไขล่าสุดที่มีชื่อนี้เป็นหลัก) */
function lookupSeat(id: string): { table: number; seat: number } | null {
  const rows = db
    .prepare(
      "SELECT data FROM seating_plans ORDER BY updated_at DESC, id DESC"
    )
    .all() as Array<{ data: string }>;
  for (const r of rows) {
    const { seats } = parseSeatingPlan(r.data);
    const key = Object.entries(seats).find(([, sid]) => sid === id)?.[0];
    if (key) {
      const [t, s] = key.split(":").map(Number);
      return { table: t, seat: s };
    }
  }
  return null;
}

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
      seat: lookupSeat(id) ?? undefined,
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
    seat: lookupSeat(id) ?? undefined,
  });
}
