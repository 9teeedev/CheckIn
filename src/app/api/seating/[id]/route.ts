import { NextResponse } from "next/server";
import { db, nowParts } from "@/lib/db";
import { parseSeatingData, validSeatingData } from "@/lib/seating";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: "รหัสแผนไม่ถูกต้อง" }, { status: 400 });
  const row = db
    .prepare("SELECT id, label, data FROM seating_plans WHERE id = ?")
    .get(id) as { id: number; label: string; data: string } | undefined;
  if (!row) return NextResponse.json({ error: "ไม่พบแผนนี้" }, { status: 404 });
  return NextResponse.json({
    id: row.id,
    label: row.label,
    data: parseSeatingData(row.data),
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: "รหัสแผนไม่ถูกต้อง" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  if (!validSeatingData(body.data)) {
    return NextResponse.json({ error: "รูปแบบที่นั่งไม่ถูกต้อง" }, { status: 400 });
  }
  const now = nowParts();
  const result = db
    .prepare("UPDATE seating_plans SET data = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(body.data), `${now.date} ${now.time}`, id);
  if (Number(result.changes) === 0) {
    return NextResponse.json({ error: "ไม่พบแผนนี้" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: "รหัสแผนไม่ถูกต้อง" }, { status: 400 });
  const result = db.prepare("DELETE FROM seating_plans WHERE id = ?").run(id);
  if (Number(result.changes) === 0) {
    return NextResponse.json({ error: "ไม่พบแผนนี้" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
