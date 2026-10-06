import { NextResponse } from "next/server";
import { db, nowParts } from "@/lib/db";
import { parseSeatingPlan } from "@/lib/seating";

export async function GET() {
  const rows = db
    .prepare(
      "SELECT id, label, updated_at, data FROM seating_plans ORDER BY updated_at DESC, id DESC"
    )
    .all() as Array<{ id: number; label: string; updated_at: string; data: string }>;
  return NextResponse.json({
    plans: rows.map((r) => ({
      id: r.id,
      label: r.label,
      updated_at: r.updated_at,
      seated: Object.keys(parseSeatingPlan(r.data).seats).length,
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim() || "แผนที่นั่ง";
  const now = nowParts();
  const stamp = `${now.date} ${now.time}`;
  const result = db
    .prepare(
      "INSERT INTO seating_plans (label, created_at, updated_at, data) VALUES (?, ?, ?, '{}')"
    )
    .run(label.slice(0, 60), stamp, stamp);
  return NextResponse.json(
    { id: Number(result.lastInsertRowid), label },
    { status: 201 }
  );
}
