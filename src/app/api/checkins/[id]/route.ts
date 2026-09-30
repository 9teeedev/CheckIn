import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return NextResponse.json({ error: "รหัสรายการไม่ถูกต้อง" }, { status: 400 });
  }
  const result = db.prepare("DELETE FROM checkins WHERE id = ?").run(numId);
  if (Number(result.changes) === 0) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
