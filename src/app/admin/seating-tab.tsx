"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { playTick, unlockAudio } from "@/lib/sound";

type Person = { student_id: string; name: string };
type PlanMeta = { id: number; label: string; updated_at: string; seated: number };
/** id ของคนที่กำลังจะวาง/ย้าย + ที่นั่งปัจจุบัน ("t:s" หรือ null = ยังไม่นั่ง) */
type Pick = { id: string; from: string | null };

const TABLES = 24;
const SEATS = 8;
const LS_PLAN = "checkin-seating-plan";

const SIZES = {
  md: {
    box: "h-56 w-56",
    inner: "inset-9",
    radius: 98,
    off: "-ml-[34px] -mt-3.5",
    pill: "h-7 w-[68px] text-[11px]",
    num: "text-2xl",
    cnt: "text-[10px]",
  },
  lg: {
    box: "h-64 w-64",
    inner: "inset-10",
    radius: 112,
    off: "-ml-[42px] -mt-4",
    pill: "h-8 w-[84px] text-[13px]",
    num: "text-3xl",
    cnt: "text-xs",
  },
} as const;

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

const displayName = (name: string | undefined, id: string) => name || id;

function TableCircle({
  t,
  size,
  assignments,
  nameById,
  pick,
  matchIds,
  onSeat,
  onDropSeat,
}: {
  t: number;
  size: keyof typeof SIZES;
  assignments: Record<string, string>;
  nameById: Map<string, string>;
  pick: Pick | null;
  matchIds: Set<string>;
  onSeat: (key: string, occupant: string | null) => void;
  onDropSeat: (id: string, key: string) => void;
}) {
  const cfg = SIZES[size];
  const prefix = size === "lg" ? "lg" : "md";
  const seats = Array.from({ length: SEATS }, (_, i) => i + 1);
  const seated = seats.filter((s) => assignments[`${t}:${s}`]).length;
  const hasMatch = seats.some((s) => {
    const id = assignments[`${t}:${s}`];
    return id != null && matchIds.has(id);
  });

  return (
    <div className={`relative shrink-0 ${cfg.box}`}>
      <div
        className={`absolute ${cfg.inner} flex flex-col items-center justify-center rounded-full border-2 bg-white transition-colors ${
          hasMatch ? "border-sky-600 seat-found" : "border-slate-200"
        }`}
      >
        <span className={`tnum font-bold ${cfg.num} text-slate-900`}>{t}</span>
        <span className={`tnum ${cfg.cnt} ${seated > 0 ? "text-slate-400" : "text-slate-300"}`}>
          {seated}/{SEATS}
        </span>
      </div>
      {seats.map((s, i) => {
        const key = `${t}:${s}`;
        const id = assignments[key] ?? null;
        const a = i * 45 - 90;
        const isPick = pick != null && id === pick.id;
        const isMatch = id != null && matchIds.has(id);
        const cls = id
            ? isPick
              ? "border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-400"
              : isMatch
                ? "border-amber-500 bg-amber-200 text-amber-950"
                : "border-sky-200 bg-sky-100 text-sky-900 hover:border-sky-400"
            : pick
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
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const sid = e.dataTransfer.getData("text/plain");
              if (sid) onDropSeat(sid, key);
            }}
            onClick={() => onSeat(key, id)}
            aria-label={`โต๊ะ ${t} ที่ ${s}${id ? ` — ${displayName(nameById.get(id), id)}` : " (ว่าง)"}`}
            title={id ? `${displayName(nameById.get(id), id)} • โต๊ะ ${t} ที่ ${s}` : `โต๊ะ ${t} ที่ ${s}`}
            className={`absolute left-1/2 top-1/2 ${cfg.off} ${cfg.pill} inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 px-1 font-semibold outline-offset-1 transition-colors ${cls} ${isMatch ? "seat-found" : ""}`}
            style={{ transform: `rotate(${a}deg) translate(0, -${cfg.radius}px) rotate(${-a}deg)` }}
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
  const [pick, setPick] = useState<Pick | null>(null);
  const [full, setFull] = useState(false);
  const [fsSearch, setFsSearch] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  // ข้าม autosave รอบที่โหลดแผนใหม่เข้ามาเอง (ไม่งั้นจะ PUT ข้อมูลเดิมกลับทันที)
  const skipSave = useRef(0);

  const nameById = useMemo(
    () => new Map(students.map((s) => [s.student_id, s.name])),
    [students]
  );
  const seatKeyOf = (id: string) =>
    Object.entries(assignments).find(([, sid]) => sid === id)?.[0] ?? null;
  const seatedCount = Object.keys(assignments).length;
  const seatedIds = useMemo(() => new Set(Object.values(assignments)), [assignments]);

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
    setAssignments(data.data ?? {});
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

  // บันทึกอัตโนมัติ (debounce) ทุกครั้งที่แผนเปลี่ยน
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
        body: JSON.stringify({ data: assignments }),
      });
      setSaveMsg(res.ok ? "บันทึกแล้ว" : "บันทึกไม่สำเร็จ");
    }, 700);
    return () => window.clearTimeout(t);
  }, [assignments, planId]);

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

  // ค้นหาเจอแล้วเลื่อนไปโต๊ะแรกที่เจอ
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
        }}
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

  const tableList = Array.from({ length: TABLES }, (_, i) => i + 1);

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
        </div>
        <p className="mt-3 text-sm text-slate-500">
          คลิกชื่อทางซ้าย แล้วคลิกที่นั่งว่าง (หรือลากชื่อไปวาง) — คลิกชื่อบนโต๊ะ
          เพื่อย้าย / สลับ / ถอนออก
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

        {/* แผนผัง 24 โต๊ะ */}
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-slate-300">
            ↑ ด้านหน้าห้อง
          </p>
          <div className="mx-auto grid w-fit grid-cols-1 justify-items-center gap-x-4 gap-y-6 min-[480px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {tableList.map((t) => (
              <TableCircle
                key={t}
                t={t}
                size="md"
                assignments={assignments}
                nameById={nameById}
                pick={pick}
                matchIds={matchIds}
                onSeat={seatClick}
                onDropSeat={placeAt}
              />
            ))}
          </div>
        </div>
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
              แผนใหม่จะเริ่มว่าง (แผนเก่ายังอยู่ เลือกย้อนได้จากดรอปดาวน์)
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

      {/* โหมดเต็มจอ — โชว์จอหน้าห้อง + ค้นหาชื่อ */}
      {full && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-50">
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <IconSeat className="h-5 w-5 text-sky-700" />
              ที่นั่ง — {label}
              <span className="tnum hidden text-sm font-medium text-slate-400 sm:inline">
                ({seatedCount}/{students.length} คน)
              </span>
            </h2>
            <div className="flex flex-1 items-center justify-end gap-3">
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
          <div className="flex flex-1 flex-col items-center gap-2 px-4 py-6 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-300">
              ↑ ด้านหน้าห้อง
            </p>
            <div className="mx-auto grid w-fit grid-cols-1 justify-items-center gap-x-6 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {tableList.map((t) => (
                <TableCircle
                  key={t}
                  t={t}
                  size="lg"
                  assignments={assignments}
                  nameById={nameById}
                  pick={pick}
                  matchIds={matchIds}
                  onSeat={seatClick}
                  onDropSeat={placeAt}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
