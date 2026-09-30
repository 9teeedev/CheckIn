import { NextResponse } from "next/server";
import { db, nowParts } from "@/lib/db";

export async function GET() {
  const { date } = nowParts();
  const rows = db
    .prepare(
      `SELECT c.id, c.student_id, s.name, c.time
       FROM checkins c JOIN students s ON s.student_id = c.student_id
       WHERE c.date = ?
       ORDER BY c.time DESC, c.id DESC`
    )
    .all(date);
  return NextResponse.json({ date, count: rows.length, checkins: rows });
}
