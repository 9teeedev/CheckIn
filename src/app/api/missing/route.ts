import { NextResponse } from "next/server";
import { db, nowParts } from "@/lib/db";

export async function GET() {
  const { date } = nowParts();
  const rows = db
    .prepare(
      `SELECT s.student_id, s.name
       FROM students s
       WHERE NOT EXISTS (
         SELECT 1 FROM checkins c WHERE c.student_id = s.student_id AND c.date = ?
       )
       ORDER BY s.student_id`
    )
    .all(date);
  return NextResponse.json({ date, count: rows.length, missing: rows });
}
