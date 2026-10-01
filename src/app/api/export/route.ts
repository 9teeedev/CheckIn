import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const fromTime = url.searchParams.get("fromTime") ?? "";
  const toTime = url.searchParams.get("toTime") ?? "";

  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return NextResponse.json(
      { error: "รูปแบบวันที่ต้องเป็น YYYY-MM-DD" },
      { status: 400 }
    );
  }
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (
    (fromTime && !TIME_RE.test(fromTime)) ||
    (toTime && !TIME_RE.test(toTime))
  ) {
    return NextResponse.json(
      { error: "รูปแบบเวลาต้องเป็น HH:MM" },
      { status: 400 }
    );
  }

  const conditions: string[] = [];
  const params: string[] = [];
  if (from) {
    conditions.push("c.date >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("c.date <= ?");
    params.push(to);
  }
  if (fromTime) {
    conditions.push("substr(c.time, 1, 5) >= ?");
    params.push(fromTime);
  }
  if (toTime) {
    conditions.push("substr(c.time, 1, 5) <= ?");
    params.push(toTime);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT s.student_id AS student_id, s.name AS name, MIN(c.date || ' ' || c.time) AS first_at
       FROM checkins c
       JOIN students s ON s.student_id = c.student_id
       ${where}
       GROUP BY c.student_id
       ORDER BY first_at`
    )
    .all(...params) as { student_id: string; name: string; first_at: string }[];

  return NextResponse.json({
    from: from || null,
    to: to || null,
    count: rows.length,
    names: rows.map((r) => r.name),
    // คู่รหัส+ชื่อ สำหรับหน้าสุ่มรางวัล
    people: rows.map((r) => ({ student_id: r.student_id, name: r.name })),
  });
}
