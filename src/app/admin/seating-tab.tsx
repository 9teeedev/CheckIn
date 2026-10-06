"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { playTick, unlockAudio } from "@/lib/sound";
import type { TablePos } from "@/lib/seating";

type Person = { student_id: string; name: string };
type PlanMeta = { id: number; label: string; updated_at: string; seated: number };
/** id ของคนที่กำลังจะวาง/ย้าย + ที่นั่งปัจจุบัน ("t:s" หรือ null = ยังไม่นั่ง) */
type Pick = { id: string; from: string | null };

const LS_PLAN = "checkin-seating-plan";
const SEATS = 8;

/** ผืนผ้าใบจัดโต๊ะ — พิกัด px ตาราง 4 คอลัมน์กลางจอ ใต้เวที */
const CANVAS_W = 1680;
const TW = 320; // กล่องโต๊ะ (วงกลม + ที่นั่งรอบ)
const GX = 420; // ระยะกลาง-กลางแนวนอน (ช่องว่างระหว่างโต๊ะ = 100px)
const GY = 430; // ระยะกลาง-กลางแนวตั้ง (ช่องว่าง = 110px)
const TOP = 250; // เริ่มโต๊ะแถวแรกใต้เวที
const START_TABLES = 26;
/** geo ของแผนที่บันทึกตอนรูปแบบเก่า (ก่อนมีฟิลด์ geo) — ใช้ rescale ตอนโหลด */
const LEGACY_GEO = { w: 1240, gx: 296, gy: 320 };

/** ตำแหน่งเริ่มต้น: ตาราง 4 คอลัมน์ แถวขาดครึ่งจะครึ่งกลาง */
function defaultLayout(n: number): Record<number, TablePos> {
  const pos: Record<number, TablePos> = {};
  let placed = 0;
  let y = TOP;
  while (placed < n) {
    const rowCount = Math.min(4, n - placed);
    const rowW = (rowCount - 1) * GX + TW;
    const x0 = (CANVAS_W - rowW) / 2;
    for (let c = 0; c < rowCount; c++) {
      placed += 1;
      pos[placed] = { x: x0 + c * GX, y };
    }
    y += GY;
  }
  return pos;
}

function IconSeat({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconExpand({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconSearch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconX({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}

function IconMinus({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

function IconGrid({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

const displayName = (name: string | undefined, id: string) => name || id;

function TableCircle({
  t,
  pos,
  prefix,
  dragging,
  selected,
  seatOver,
  highlightEmpty,
  assignments,
  nameById,
  pick,
  matchIds,
  onSeat,
  onDropSeat,
  onTableDown,
  onTableMenu,
  onSeatOver,
}: {
  t: number;
  pos: TablePos;
  prefix: string;
  dragging: boolean;
  selected: boolean;
  seatOver: string | null;
  highlightEmpty: boolean;
  assignments: Record<string, string>;
  nameById: Map<string, string>;
  pick: Pick | null;
  matchIds: Set<string>;
  onSeat: (key: string, occupant: string | null) => void;
  onDropSeat: (id: string, key: string) => void;
  onTableDown: (t: number, e: ReactPointerEvent) => void;
  onTableMenu: (t: number, e: React.MouseEvent) => void;
  onSeatOver: (key: string | null) => void;
}) {
  const seats = Array.from({ length: SEATS }, (_, i) => i + 1);
  const seated = seats.filter((s) => assignments[`${t}:${s}`]).length;
  const hasMatch = seats.some((s) => {
    const id = assignments[`${t}:${s}`];
    return id != null && matchIds.has(id);
  });

  return (
    <div
      className="absolute"
      style={{ left: pos.x, top: pos.y, width: TW, height: TW }}
    >
      <div
        aria-label={`ย้ายโต๊ะ ${t}`}
        title={`โต๊ะ ${t} — ลากเพื่อย้าย • คลิกขวาเพื่อลบ`}
        onPointerDown={(e) => onTableDown(t, e)}
        onContextMenu={(e) => onTableMenu(t, e)}
        className={`absolute inset-16 flex touch-none select-none flex-col items-center justify-center rounded-full border-2 bg-white shadow-sm transition-colors ${
          dragging
            ? "z-20 cursor-grabbing border-sky-500 shadow-lg ring-4 ring-sky-200"
            : selected
              ? "cursor-grab border-sky-600 ring-4 ring-sky-200"
              : "cursor-grab border-slate-200"
        } ${hasMatch ? "seat-found border-sky-600" : ""}`}
      >
        <span className="tnum text-4xl font-bold text-slate-900">{t}</span>
        <span className="tnum text-xs text-slate-400">
          {seated}/{SEATS}
        </span>
      </div>
      {seats.map((s, i) => {
        const key = `${t}:${s}`;
        const id = assignments[key] ?? null;
        const a = i * 45 - 90;
        const isMatch = id != null && matchIds.has(id);
        const isPick = pick != null && id === pick.id;
        const over = seatOver === key;
        const cls = id
            ? isPick
              ? "border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-400"
              : isMatch
                ? "border-amber-500 bg-amber-200 text-amber-950"
                : "border-sky-200 bg-sky-100 text-sky-900 hover:border-sky-400"
            : highlightEmpty
              ? "border-dashed border-sky-500 bg-sky-50 text-sky-400 hover:bg-sky-100"
              : "border-dashed border-slate-200 bg-slate-50 text-slate-300";
        return (
          <button
            key={s}
            id={`seat-${prefix}-${key}`}
            draggable={id != null}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", id!);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              onSeatOver(key);
            }}
            onDragLeave={() => onSeatOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              onSeatOver(null);
              const sid = e.dataTransfer.getData("text/plain");
              if (sid) onDropSeat(sid, key);
            }}
            onClick={() => onSeat(key, id)}
            aria-label={`โต๊ะ ${t} ที่ ${s}${id ? ` — ${displayName(nameById.get(id), id)}` : " (ว่าง)"}`}
            title={id ? `${displayName(nameById.get(id), id)} • โต๊ะ ${t} ที่ ${s}` : `โต๊ะ ${t} ที่ ${s}`}
            className={`absolute left-1/2 top-1/2 -ml-[44px] -mt-[18px] inline-flex h-9 w-[88px] cursor-pointer touch-auto items-center justify-center overflow-hidden rounded-full border-2 px-1 text-sm font-semibold outline-offset-1 transition-all ${cls} ${isMatch ? "seat-found" : ""} ${
              over ? "z-10 scale-110 ring-2 ring-sky-500 ring-offset-1" : ""
            }`}
            style={{ transform: `rotate(${a}deg) translate(0, -122px) rotate(${-a}deg)` }}
          >
            <span className="w-full truncate text-center">
              {id ? displayName(nameById.get(id), id) : s}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function SeatingTab() {
  const [students, setStudents] = useState<Person[]>([]);
  const [plans, setPlans] = useState<PlanMeta[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [layout, setLayout] = useState<Record<number, TablePos>>({});
  const [pick, setPick] = useState<Pick | null>(null);
  const [full, setFull] = useState(false);
  const [fsSearch, setFsSearch] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [dragNo, setDragNo] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const setZoomStep = (v: number) =>
    setZoom(Math.min(2, Math.max(0.4, Math.round(v * 100) / 100)));
  // โต๊ะที่คลิกเลือก (แผงรายละเอียดด้านขวา) + ช่องที่กำลังเว่อร์รับการลาก
  const [selTable, setSelTable] = useState<number | null>(null);
  const [selSearch, setSelSearch] = useState("");
  const [seatOver, setSeatOver] = useState<string | null>(null);
  const [htmlDragging, setHtmlDragging] = useState(false);
  // ข้าม autosave รอบที่โหลดแผนใหม่เข้ามาเอง (ไม่งั้นจะ PUT ข้อมูลเดิมกลับทันที)
  const skipSave = useRef(0);
  // สถานะการลากโต๊ะ (ใช้ ref + listener รวมกลาง กัน re-render ผูก handler เก่า)
  const dragRef = useRef<{
    t: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    scale: number;
    moved: number;
  } | null>(null);

  const nameById = useMemo(
    () => new Map(students.map((s) => [s.student_id, s.name])),
    [students]
  );
  const seatKeyOf = (id: string) =>
    Object.entries(assignments).find(([, sid]) => sid === id)?.[0] ?? null;
  const seatedCount = Object.keys(assignments).length;
  const seatedIds = useMemo(() => new Set(Object.values(assignments)), [assignments]);

  const tableNos = useMemo(
    () => Object.keys(layout).map(Number).sort((a, b) => a - b),
    [layout]
  );
  const canvasH = useMemo(
    () =>
      Math.max(
        TOP + GY * 2,
        ...tableNos.map((n) => layout[n].y + TW + 72)
      ),
    [layout, tableNos]
  );

  async function refreshPlans(): Promise<PlanMeta[]> {
    const res = await fetch("/api/seating");
    const data = await res.json();
    const list: PlanMeta[] = data.plans ?? [];
    setPlans(list);
    return list;
  }

  async function openPlan(id: number) {
    const res = await fetch(`/api/seating/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    skipSave.current += 1;
    setPlanId(data.id);
    setLabel(data.label ?? "");
    setAssignments(data.data?.seats ?? {});
    const tbl = (data.data?.tables ?? {}) as Record<string, TablePos>;
    if (Object.keys(tbl).length) {
      // แผนบันทึกตอนผ้าใบขนาดเดิม — ย่อ/ขยายตำแหน่งเข้าเรขาคณิตปัจจุบัน
      const geo = data.data?.geo ?? LEGACY_GEO;
      const sx = CANVAS_W / geo.w;
      const sy = GY / geo.gy;
      setLayout(
        Object.fromEntries(
          Object.entries(tbl).map(([k, p]) => [
            Number(k),
            { x: p.x * sx, y: p.y * sy },
          ])
        )
      );
    } else {
      setLayout(defaultLayout(START_TABLES));
    }
    setPick(null);
    try {
      window.localStorage.setItem(LS_PLAN, String(data.id));
    } catch {
      /* ไม่ซีเรียส */
    }
  }

  // โหลดครั้งแรก: ทะเบียน + แผน (ถ้ายังไม่มีแผนเลย สร้างแผนแรกให้อัตโนมัติ)
  useEffect(() => {
    (async () => {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/seating"),
      ]);
      const sData = await sRes.json();
      setStudents(sData.students ?? []);
      let list: PlanMeta[] = (await pRes.json()).plans ?? [];
      if (list.length === 0) {
        const cRes = await fetch("/api/seating", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: "แผนที่นั่ง" }),
        });
        if (cRes.ok) list = await refreshPlans();
      } else {
        setPlans(list);
      }
      const saved = Number(window.localStorage.getItem(LS_PLAN) ?? "");
      const chosen = list.find((p) => p.id === saved) ?? list[0];
      if (chosen) await openPlan(chosen.id);
    })();
  }, []);

  // บันทึกอัตโนมัติ (debounce) ทุกครั้งที่ที่นั่งหรือตำแหน่งโต๊ะเปลี่ยน
  useEffect(() => {
    if (!planId) return;
    if (skipSave.current > 0) {
      skipSave.current -= 1;
      return;
    }
    setSaveMsg("กำลังบันทึก…");
    const t = window.setTimeout(async () => {
      const res = await fetch(`/api/seating/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            v: 2,
            seats: assignments,
            tables: layout,
            geo: { w: CANVAS_W, gx: GX, gy: GY },
          },
        }),
      });
      setSaveMsg(res.ok ? "บันทึกแล้ว" : "บันทึกไม่สำเร็จ");
    }, 700);
    return () => window.clearTimeout(t);
  }, [assignments, layout, planId]);

  // ลากย้ายโต๊ะ — listener รวมกลาง คำนวณจากจุดเริ่ม + เดลต้า (หาร scale ของผ้าใบ
  // เผื่อโหมดเต็มจอที่ขยายอยู่) แล้วขอบเขตไม่ให้หลุดออกนอกผ้าใบด้านซ้าย-ขวา
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      d.moved = Math.max(
        d.moved,
        Math.hypot(e.clientX - d.sx, e.clientY - d.sy)
      );
      const x = Math.min(
        Math.max(0, d.ox + (e.clientX - d.sx) / d.scale),
        CANVAS_W - TW
      );
      const y = Math.max(0, d.oy + (e.clientY - d.sy) / d.scale);
      setLayout((prev) => ({ ...prev, [d.t]: { x, y } }));
    }
    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      // กดแล้วปล่อยโดยไม่ขยับ = คลิกเลือกโต๊ะ (สลับการเลือกถ้าคลิกซ้ำ)
      if (d.moved < 6) {
        const t = d.t;
        setSelTable((s) => (s === t ? null : t));
      }
      dragRef.current = null;
      setDragNo(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function tableDown(t: number, e: ReactPointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = layout[t];
    if (!p) return;
    const root = (e.currentTarget as HTMLElement).closest(
      "[data-canvas]"
    ) as HTMLElement | null;
    const scale = root ? root.getBoundingClientRect().width / CANVAS_W : 1;
    dragRef.current = {
      t,
      sx: e.clientX,
      sy: e.clientY,
      ox: p.x,
      oy: p.y,
      scale,
      moved: 0,
    };
    setDragNo(t);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* เบราว์เซอร์ไม่รองรับก็ลากได้อยู่ (listener อยู่ที่ window) */
    }
  }

  // เพิ่มโต๊ะ: ต่อท้ายแถวล่างสุดกลางจอ แล้วค่อยลากเอง
  function addTable() {
    setLayout((prev) => {
      const nos = Object.keys(prev).map(Number);
      const next = (nos.length ? Math.max(...nos) : 0) + 1;
      const maxY = nos.length
        ? Math.max(...nos.map((n) => prev[n].y))
        : TOP - GY;
      return { ...prev, [next]: { x: (CANVAS_W - TW) / 2, y: maxY + GY } };
    });
  }

  // ลบโต๊ะ (คลิกขวา หรือปุ่มในแผงโต๊ะ) — คนบนโต๊ะนั้นถูกถอนออกจากที่นั่ง
  function tableMenu(t: number, e: React.MouseEvent) {
    e.preventDefault();
    deleteTable(t);
  }

  function deleteTable(t: number) {
    const seatedCountOnTable = Object.keys(assignments).filter((k) =>
      k.startsWith(`${t}:`)
    ).length;
    if (
      !confirm(
        `ลบโต๊ะ ${t}?\n` +
          (seatedCountOnTable > 0
            ? `คนที่นั่งบนโต๊ะนี้ ${seatedCountOnTable} คนจะถูกถอนออกจากที่นั่ง\n`
            : "") +
          "เลขโต๊ะที่เหลือไม่ถูกเรียงใหม่"
      )
    )
      return;
    setAssignments((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${t}:`)) delete next[k];
      }
      return next;
    });
    setLayout((prev) => {
      const next = { ...prev };
      delete next[t];
      return next;
    });
    // ถ้ากำลังหยิบคนที่นั่งอยู่บนโต๊ะที่ลบ — ถือเป็นหยิบจากรายชื่อ (ไม่มีที่นั่งเดิม)
    setPick((p) =>
      p && p.from?.startsWith(`${t}:`) ? { ...p, from: null } : p
    );
  }

  // จัดเรียงใหม่: กลับไปตาราง 4 คอลัมน์มาตรฐาน (ที่นั่งคนยังอยู่ครบ)
  function rearrangeTables() {
    if (
      !confirm(
        "เรียงโต๊ะทั้งหมดกลับเป็นตารางใหม่?\n(ตำแหน่งที่ลากไว้จะหาย — ที่นั่งของคนยังอยู่ครบ)"
      )
    )
      return;
    setLayout(defaultLayout(tableNos.length || START_TABLES));
  }

  // วาง id ลงที่นั่ง — จากรายชื่อ = วาง/แทนที่, จากโต๊ะอื่น = ย้าย/สลับ
  function placeAt(id: string, key: string) {
    const from = seatKeyOf(id);
    if (from === key) {
      setPick(null);
      return;
    }
    const occupant = assignments[key] ?? null;
    unlockAudio();
    playTick();
    setAssignments((prev) => {
      const next = { ...prev };
      if (from) delete next[from];
      if (occupant && from) next[from] = occupant;
      next[key] = id;
      return next;
    });
    setPick(null);
  }

  function seatClick(key: string, occupant: string | null) {
    if (pick) {
      placeAt(pick.id, key);
      return;
    }
    if (occupant) setPick({ id: occupant, from: key });
  }

  function chipClick(id: string) {
    if (pick?.id === id) {
      setPick(null);
      return;
    }
    setPick({ id, from: seatKeyOf(id) });
  }

  // ถอนคนออกจากที่นั่ง (จากแผงโต๊ะที่เลือก)
  function removeFromSeat(key: string) {
    unlockAudio();
    playTick();
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPick((p) => (p && p.from === key ? null : p));
  }

  function unpick() {
    if (!pick?.from) return;
    const from = pick.from;
    unlockAudio();
    playTick();
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[from];
      return next;
    });
    setPick(null);
  }

  async function createPlan() {
    const res = await fetch("/api/seating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim() || "แผนที่นั่ง" }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setNewOpen(false);
    await refreshPlans();
    await openPlan(created.id);
  }

  async function deletePlan() {
    if (planId == null) return;
    if (!confirm(`ลบแผน "${label}"?\nที่นั่งทั้งหมดในแผนนี้จะหายไป`)) return;
    await fetch(`/api/seating/${planId}`, { method: "DELETE" });
    const list = await refreshPlans();
    if (list.length > 0) {
      await openPlan(list[0].id);
    } else {
      const cRes = await fetch("/api/seating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "แผนที่นั่ง" }),
      });
      if (cRes.ok) {
        const fresh = await refreshPlans();
        if (fresh[0]) await openPlan(fresh[0].id);
      }
    }
  }

  function clearSeats() {
    if (seatedCount === 0) return;
    if (!confirm("ล้างที่นั่งทั้งหมดในแผนนี้?")) return;
    setPick(null);
    setAssignments({});
  }

  // Esc: ปิดเต็มจอ → ยกเลิกการวาง → ปิด popup แผนใหม่
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (full) setFull(false);
      else if (pick) setPick(null);
      else if (selTable != null) setSelTable(null);
      else if (newOpen) setNewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const q = rosterSearch.trim().toLowerCase();
  const rosterList = students.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.student_id.includes(q)
  );
  const unseated = rosterList.filter((p) => !seatedIds.has(p.student_id));
  const seatedList = rosterList.filter((p) => seatedIds.has(p.student_id));

  const fsQ = fsSearch.trim().toLowerCase();
  const matchIds = useMemo(() => {
    const s = new Set<string>();
    if (!fsQ) return s;
    for (const p of students) {
      if (p.name.toLowerCase().includes(fsQ) || p.student_id.includes(fsQ)) {
        s.add(p.student_id);
      }
    }
    return s;
  }, [fsQ, students]);
  const matchEntries = Object.entries(assignments).filter(([, id]) =>
    matchIds.has(id)
  );

  // ข้อมูลแผงโต๊ะที่เลือก: ที่นั่งว่างแรก + รายชื่อค้นหา (ยังไม่นั่งขึ้นก่อน)
  const selSeatNos = Array.from({ length: SEATS }, (_, i) => i + 1);
  const selFirstEmpty =
    selTable != null
      ? selSeatNos.find((s) => !assignments[`${selTable}:${s}`])
      : undefined;
  const selQ = selSearch.trim().toLowerCase();
  const selList = students.filter(
    (p) => !selQ || p.name.toLowerCase().includes(selQ) || p.student_id.includes(selQ)
  );

  // ค้นหาเจอแล้วเลื่อนไปที่นั่งแรกที่เจอ (โหมดเต็มจอ)
  useEffect(() => {
    if (!full || matchEntries.length === 0) return;
    const [key] = matchEntries[0];
    document
      .getElementById(`seat-lg-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fsQ, full, matchEntries.length]);

  const chip = (p: Person, seated: boolean) => {
    const seatKey = seatKeyOf(p.student_id);
    const tableNo = seatKey ? Number(seatKey.split(":")[0]) : null;
    const active = pick?.id === p.student_id;
    return (
      <span
        key={p.student_id}
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", p.student_id);
          e.dataTransfer.effectAllowed = "move";
          setHtmlDragging(true);
        }}
        onDragEnd={() => setHtmlDragging(false)}
        onClick={() => chipClick(p.student_id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            chipClick(p.student_id);
          }
        }}
        title={`${displayName(p.name, p.student_id)} • ${p.student_id}${tableNo ? ` • โต๊ะ ${tableNo}` : ""}`}
        className={`cursor-grab select-none rounded-full px-3 py-1.5 text-sm font-semibold transition-colors active:cursor-grabbing ${
          active
            ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400"
            : seated
              ? "bg-slate-100 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-200"
              : "bg-sky-100 text-sky-800 hover:bg-sky-200"
        }`}
      >
        {seated && tableNo != null && (
          <span className="tnum mr-1.5 text-xs text-slate-400">โต๊ะ {tableNo}</span>
        )}
        {displayName(p.name, p.student_id)}
      </span>
    );
  };

  /** ผืนผ้าใบจัดโต๊ะ — ใช้ทั้งโหมดแก้ไขและเต็มจอ (prefix แยก id กันกับ scroll) */
  function renderCanvas(prefix: string) {
    return (
      <div
        data-canvas
        className="relative mx-auto select-none rounded-2xl"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelTable(null);
        }}
        style={{
          width: CANVAS_W,
          height: canvasH,
          backgroundColor: "#f8fafc",
          backgroundImage:
            "radial-gradient(#e2e8f0 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
        }}
      >
        {/* เวที — สี่เหลี่ยมชิดขอบบน กลางจอ */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 flex h-[144px] w-[460px] -translate-x-1/2 flex-col items-center justify-center rounded-2xl border-2 border-slate-300 bg-gradient-to-b from-white to-slate-100 shadow-sm"
        >
          <span className="text-3xl font-bold tracking-[0.4em] text-slate-500">
            เวที
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-300">
            stage
          </span>
        </div>
        {tableNos.map((t) => (
          <TableCircle
            key={t}
            t={t}
            pos={layout[t]}
            prefix={prefix}
            dragging={dragNo === t}
            selected={selTable === t}
            seatOver={seatOver}
            highlightEmpty={pick != null || htmlDragging}
            assignments={assignments}
            nameById={nameById}
            pick={pick}
            matchIds={matchIds}
            onSeat={seatClick}
            onDropSeat={placeAt}
            onTableDown={tableDown}
            onTableMenu={tableMenu}
            onSeatOver={setSeatOver}
          />
        ))}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {/* การ์ดควบคุม */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <IconSeat className="h-5 w-5 text-sky-700" />
            จัดที่นั่ง — {label || "…"}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={planId ?? ""}
              onChange={(e) => void openPlan(Number(e.target.value))}
              aria-label="เลือกแผนที่นั่ง"
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.seated} ที่นั่ง)
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setNewLabel(`แผนที่นั่ง ${plans.length + 1}`);
                setNewOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <IconPlus className="h-3.5 w-3.5" />
              แผนใหม่
            </button>
            <button
              onClick={() => void deletePlan()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              <IconTrash className="h-3.5 w-3.5" />
              ลบแผน
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="tnum rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800">
            นั่งแล้ว {seatedCount}/{students.length} คน
          </span>
          <span className="tnum rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
            {tableNos.length} โต๊ะ
          </span>
          <button
            onClick={addTable}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <IconPlus className="h-4 w-4" />
            เพิ่มโต๊ะ
          </button>
          <button
            onClick={rearrangeTables}
            disabled={tableNos.length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconGrid className="h-4 w-4" />
            จัดเรียงใหม่
          </button>
          <button
            onClick={clearSeats}
            disabled={seatedCount === 0}
            className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ล้างที่นั่งทั้งหมด
          </button>
          <button
            onClick={() => {
              setFsSearch("");
              setFull(true);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-700 active:scale-95"
          >
            <IconExpand className="h-4 w-4" />
            เต็มจอ (โชว์หน้าห้อง)
          </button>
          {saveMsg && (
            <span role="status" className="text-sm font-medium text-slate-500">
              {saveMsg}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-1 py-0.5">
            <button
              onClick={() => setZoomStep(zoom - 0.1)}
              aria-label="ซูมออก"
              className="cursor-pointer rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100"
            >
              <IconMinus className="h-4 w-4" />
            </button>
            <span className="tnum w-12 text-center text-sm font-semibold text-slate-700">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoomStep(zoom + 0.1)}
              aria-label="ซูมเข้า"
              className="cursor-pointer rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100"
            >
              <IconPlus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
            >
              รีเซ็ต
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          ลากวงกลมกลางโต๊ะเพื่อย้ายตำแหน่ง • คลิกขวาเพื่อลบโต๊ะ •
          คลิกชื่อทางซ้ายแล้วคลิกที่นั่งว่าง (หรือลากชื่อไปวาง) —
          คลิกชื่อบนโต๊ะเพื่อย้าย / สลับ / ถอนออก
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* รายชื่อ */}
        <aside className="flex shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-72 lg:self-start">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
            <IconSearch className="h-4 w-4 text-sky-700" />
            รายชื่อ ({students.length})
          </h2>
          <label className="sr-only" htmlFor="roster-search">
            ค้นหารายชื่อ
          </label>
          <input
            id="roster-search"
            value={rosterSearch}
            onChange={(e) => setRosterSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / รหัส"
            className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-sky-600"
          />
          {students.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              ยังไม่มีรายชื่อ — เพิ่มในแท็บทะเบียนก่อน
            </p>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto pr-1">
              <div>
                <p className="tnum mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  ยังไม่นั่ง ({unseated.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {unseated.map((p) => chip(p, false))}
                </div>
              </div>
              {seatedList.length > 0 && (
                <div>
                  <p className="tnum mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    นั่งแล้ว ({seatedList.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {seatedList.map((p) => chip(p, true))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ผืนผ้าใบจัดโต๊ะ — เลื่อนได้ทั้งแนวนอน/แนวตั้ง ซูมได้จากแถบด้านบน */}
        <div className="max-h-[calc(100dvh-3rem)] flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div style={{ zoom }}>
            {renderCanvas("md")}
          </div>
        </div>

        {/* แผงโต๊ะที่เลือก — ที่นั่งทั้งโต๊ะ + ค้นหาชื่อมาวาง */}
        {selTable != null && (
          <aside className="flex shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-80 lg:self-start">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <IconSeat className="h-4 w-4 text-sky-700" />
                โต๊ะ {selTable}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    deleteTable(selTable);
                    setSelTable(null);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                  ลบโต๊ะ
                </button>
                <button
                  onClick={() => setSelTable(null)}
                  aria-label="ปิดแผงโต๊ะ"
                  className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              ที่นั่งบนโต๊ะนี้
            </p>
            <div className="flex flex-col gap-1.5">
              {selSeatNos.map((s) => {
                const key = `${selTable}:${s}`;
                const id = assignments[key];
                return (
                  <div
                    key={s}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                      id
                        ? "border-sky-100 bg-sky-50/60"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <span className="tnum w-5 text-center text-xs font-bold text-slate-400">
                      {s}
                    </span>
                    {id ? (
                      <>
                        <span className="flex-1 truncate text-sm font-semibold text-slate-900">
                          {displayName(nameById.get(id), id)}
                        </span>
                        <button
                          onClick={() => removeFromSeat(key)}
                          aria-label={`ถอน ${displayName(nameById.get(id), id)} ออกจากที่ ${s}`}
                          className="cursor-pointer rounded-full p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <IconX className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="flex-1 text-sm text-slate-300">ว่าง</span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
              ค้นหาชื่อเพื่อวางบนโต๊ะนี้
            </p>
            <label className="sr-only" htmlFor="sel-search">
              ค้นหาชื่อเพื่อวางบนโต๊ะ {selTable}
            </label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="sel-search"
                value={selSearch}
                onChange={(e) => setSelSearch(e.target.value)}
                placeholder="ชื่อ / รหัส"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-sky-600"
              />
            </div>
            {selFirstEmpty == null ? (
              <p className="mt-3 text-sm text-slate-400">
                โต๊ะนี้เต็มแล้ว ({SEATS}/{SEATS}) — ถอนใครออกก่อน หรือเลือกคนบนโต๊ะแล้วสลับ
              </p>
            ) : (
              <p className="tnum mt-2 text-xs text-slate-400">
                คลิกชื่อ = วางที่ว่างแรก (ที่ {selFirstEmpty})
              </p>
            )}
            <div className="mt-2 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
              {selList.map((p) => {
                const from = seatKeyOf(p.student_id);
                const fromTable = from ? Number(from.split(":")[0]) : null;
                return (
                  <button
                    key={p.student_id}
                    onClick={() =>
                      selFirstEmpty != null &&
                      placeAt(p.student_id, `${selTable}:${selFirstEmpty}`)
                    }
                    disabled={selFirstEmpty == null}
                    title={`${displayName(p.name, p.student_id)}${fromTable ? ` • อยู่โต๊ะ ${fromTable}` : ""}`}
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      fromTable
                        ? "bg-slate-100 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-200"
                        : "bg-sky-100 text-sky-800 hover:bg-sky-200"
                    }`}
                  >
                    {fromTable != null && fromTable !== selTable && (
                      <span className="tnum mr-1.5 text-xs text-slate-400">
                        โต๊ะ {fromTable}
                      </span>
                    )}
                    {displayName(p.name, p.student_id)}
                  </button>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {/* แถบลอยตอนกำลังวาง/ย้าย */}
      {pick && (
        <div className="fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-slate-900 py-3 pl-5 pr-3 text-white shadow-xl">
            <p className="text-sm font-semibold">
              <span className="mr-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900">
                {pick.from ? "ย้าย" : "วาง"}
              </span>
              {displayName(nameById.get(pick.id), pick.id)} — คลิกที่นั่งปลายทาง
              {pick.from && " (ที่นั่งที่มีคน = สลับกัน)"}
            </p>
            {pick.from && (
              <button
                onClick={unpick}
                className="cursor-pointer rounded-lg border border-red-300/60 px-3 py-1.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-400/20"
              >
                ถอนออก
              </button>
            )}
            <button
              onClick={() => setPick(null)}
              aria-label="ยกเลิกการวาง"
              className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* popup สร้างแผนใหม่ */}
      {newOpen && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="สร้างแผนที่นั่งใหม่"
        >
          <div className="modal-card w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl sm:p-8">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <IconSeat className="h-5 w-5 text-sky-700" />
              สร้างแผนที่นั่งใหม่
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              แผนใหม่จะเริ่มว่าง {START_TABLES} โต๊ะ (แผนเก่ายังอยู่
              เลือกย้อนได้จากดรอปดาวน์)
            </p>
            <label className="sr-only" htmlFor="new-plan-label">
              ชื่อแผน
            </label>
            <input
              id="new-plan-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void createPlan()}
              autoFocus
              className="mt-4 w-full rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition-colors focus:border-sky-600"
            />
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:justify-between">
              <button
                onClick={() => setNewOpen(false)}
                className="cursor-pointer rounded-xl border-2 border-slate-200 bg-white px-5 py-3 font-semibold text-slate-600 transition-all hover:bg-slate-100 active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void createPlan()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition-all hover:bg-slate-700 active:scale-95"
              >
                <IconCheck className="h-5 w-5" />
                สร้างแผน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* โหมดเต็มจอ — โชว์จอหน้าห้อง + ค้นหาชื่อ (ขยาย 1.2 เท่าให้อ่านง่าย) */}
      {full && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-slate-50">
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <IconSeat className="h-5 w-5 text-sky-700" />
              ที่นั่ง — {label}
              <span className="tnum hidden text-sm font-medium text-slate-400 sm:inline">
                ({seatedCount}/{students.length} คน)
              </span>
            </h2>
            <div className="flex flex-1 items-center justify-end gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-1 py-0.5">
                <button
                  onClick={() => setZoomStep(zoom - 0.1)}
                  aria-label="ซูมออก"
                  className="cursor-pointer rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <IconMinus className="h-4 w-4" />
                </button>
                <span className="tnum w-10 text-center text-sm font-semibold text-slate-700">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoomStep(zoom + 0.1)}
                  aria-label="ซูมเข้า"
                  className="cursor-pointer rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <IconPlus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
                >
                  รีเซ็ต
                </button>
              </div>
              <div className="relative w-full max-w-xs">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <label className="sr-only" htmlFor="fs-search">
                  ค้นหาชื่อหรือรหัสนักศึกษา
                </label>
                <input
                  id="fs-search"
                  value={fsSearch}
                  onChange={(e) => setFsSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ / รหัส → บอกโต๊ะ"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-sky-600"
                />
              </div>
              <button
                onClick={() => setFull(false)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-700 active:scale-95"
              >
                <IconX className="h-4 w-4" />
                ปิด
              </button>
            </div>
          </header>
          {fsQ && (
            <p
              role="status"
              className="px-4 pt-3 text-center text-sm font-semibold text-slate-600 sm:px-8"
            >
              {matchEntries.length === 0
                ? `ไม่พบ "${fsSearch}" ในแผนที่นั่ง`
                : matchEntries
                    .slice(0, 5)
                    .map(([key, id]) => {
                      const [t, s] = key.split(":");
                      return `${displayName(nameById.get(id), id)} → โต๊ะ ${t} ที่ ${s}`;
                    })
                    .join(" • ") +
                  (matchEntries.length > 5
                    ? ` และอีก ${matchEntries.length - 5} คน`
                    : "")}
            </p>
          )}
          <div className="flex flex-1 justify-center px-4 py-6 sm:px-8">
            <div style={{ zoom }}>{renderCanvas("lg")}</div>
          </div>
        </div>
      )}
    </section>
  );
}
