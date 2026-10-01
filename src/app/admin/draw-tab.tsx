"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playCongrats, playSpinTick, playTick, unlockAudio } from "@/lib/sound";

type Person = { student_id: string; name: string };
type Source = "range" | "all";

/** แบ่ง 11 หลักเป็นกลุ่ม 2-3-3-3 ตามลำดับการเฉลย */
const GROUPS: Array<[number, number]> = [
  [0, 2],
  [2, 5],
  [5, 8],
  [8, 11],
];

/** จังหวะเฉลย (ms) — 67 → 040 → 249 ทีละกลุ่ม ส่วน 3 ตัวท้ายทีละตัว ช้าขึ้นเรื่อยๆ */
const REVEAL: Array<{ s: number; e: number; at: number }> = [
  { s: 0, e: 2, at: 1000 },
  { s: 2, e: 5, at: 2700 },
  { s: 5, e: 8, at: 4600 },
  { s: 8, e: 9, at: 6600 },
  { s: 9, e: 10, at: 8100 },
  { s: 10, e: 11, at: 9700 },
];
const NAME_AT = 11200;

const randDigit = () => String(Math.floor(Math.random() * 10));

const todayStr = () => new Date().toLocaleDateString("en-CA");

function IconDice({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="0.5" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="0.5" fill="currentColor" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="0.5" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconSparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

type Piece = {
  id: number;
  left: number;
  delay: number;
  color: string;
  size: number;
};

const CONFETTI_COLORS = ["#0284c7", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6"];

export default function DrawTab() {
  const [source, setSource] = useState<Source>("range");
  const [dFrom, setDFrom] = useState(todayStr());
  const [dTo, setDTo] = useState(todayStr());
  const [dFromTime, setDFromTime] = useState("");
  const [dToTime, setDToTime] = useState("");
  const [pool, setPool] = useState<Person[]>([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [noRepeat, setNoRepeat] = useState(true);
  const [drawn, setDrawn] = useState<Person[]>([]);

  const [rolling, setRolling] = useState(false);
  const [locked, setLocked] = useState(0);
  const [winner, setWinner] = useState<Person | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [stageResult, setStageResult] = useState<Person | null>(null);
  const [spin, setSpin] = useState("-----------");
  const [confetti, setConfetti] = useState<Piece[]>([]);
  const timers = useRef<number[]>([]);
  // จำนวนกลุ่มที่ล็อคแล้ว (ref อัปเดตทันที กัน interval ตัวหมุนใช้ค่าเก่าเขียนทับตัวเลขที่ล็อคไปแล้ว)
  const lockedRef = useRef(0);

  useEffect(() => {
    const stash = timers.current;
    return () => stash.forEach((t) => window.clearTimeout(t));
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // โหลดกลุ่มคนที่จะสุ่ม: กรองจากประวัติเช็คอิน (เหมือนแท็บส่งออก) หรือทั้งทะเบียน
  // เมื่อกรองเปลี่ยน วงการสุ่มเปลี่ยน → ล้างประวัติ/ผลเดิม
  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    setPoolError(null);
    try {
      let rows: Person[];
      if (source === "all") {
        const res = await fetch("/api/students");
        const data = await res.json();
        rows = data.students ?? [];
      } else {
        const qs = new URLSearchParams();
        if (dFrom) qs.set("from", dFrom);
        if (dTo) qs.set("to", dTo);
        if (dFromTime) qs.set("fromTime", dFromTime);
        if (dToTime) qs.set("toTime", dToTime);
        const res = await fetch(`/api/export?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "ดึงรายชื่อไม่สำเร็จ");
        rows = data.people ?? [];
      }
      setPool(rows);
      setDrawn([]);
      setWinner(null);
      setRevealed(false);
      setStageResult(null);
      setLocked(0);
      lockedRef.current = 0;
      setSpin("-----------");
    } catch (e) {
      setPool([]);
      setPoolError(e instanceof Error ? e.message : "ดึงรายชื่อไม่สำเร็จ");
    } finally {
      setPoolLoading(false);
    }
  }, [source, dFrom, dTo, dFromTime, dToTime]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  const candidates = useMemo(() => {
    if (!noRepeat) return pool;
    const seen = new Set(drawn.map((d) => d.student_id));
    return pool.filter((p) => !seen.has(p.student_id));
  }, [pool, drawn, noRepeat]);

  // ตัวเลขหมุนในตำแหน่งที่ยังไม่ล็อค (70ms/ครั้ง) — locked = จำนวนหลักที่ล็อคแล้วนับจากซ้าย
  // เสียงแต๊ะตามจังหวะหมุน — เงียบช่วงท้าย (ล็อคครบแล้ว ค้างไว้ก่อนเฉลยชื่อ) ให้เงียบเพิ่มความลุ้น
  useEffect(() => {
    if (!rolling) return;
    const iv = window.setInterval(() => {
      if (lockedRef.current < 11) playSpinTick();
      setSpin((s) =>
        Array.from({ length: 11 }, (_, i) =>
          i < lockedRef.current ? s[i] : randDigit()
        ).join("")
      );
    }, 70);
    return () => window.clearInterval(iv);
  }, [rolling]);

  function fireConfetti() {
    const pieces: Piece[] = Array.from({ length: 28 }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.35,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 7 + Math.random() * 7,
    }));
    setConfetti(pieces);
    timers.current.push(window.setTimeout(() => setConfetti([]), 2600));
  }

  function draw() {
    if (rolling || revealed || candidates.length === 0) return;
    unlockAudio();
    clearTimers();
    lockedRef.current = 0;
    const w = candidates[Math.floor(Math.random() * candidates.length)];
    setWinner(w);
    setRevealed(false);
    setStageResult(null);
    setLocked(0);
    setSpin(Array.from({ length: 11 }, randDigit).join(""));
    setRolling(true);

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      lockedRef.current = 11;
      setSpin(w.student_id);
      setLocked(11);
      setRolling(false);
      setRevealed(true);
      playCongrats();
      return;
    }

    // เฉลย 67 → 040 → 249 ทีละกลุ่ม แล้ว 3 ตัวท้ายทีละตัว ช้าขึ้นเรื่อยๆ ก่อนเฉลยชื่อ
    REVEAL.forEach(({ s, e, at }) => {
      timers.current.push(
        window.setTimeout(() => {
          lockedRef.current = e;
          setLocked(e);
          setSpin((prev) =>
            prev.slice(0, s) +
            w.student_id.slice(s, e).padEnd(e - s, "–") +
            prev.slice(e)
          );
          playTick();
        }, at)
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        setRolling(false);
        setRevealed(true);
        playCongrats();
        fireConfetti();
      }, NAME_AT)
    );
  }

  // เก็บไว้: ลงประวัติ + ห้ามสุ่มซ้ำ (ถ้าติ๊ก) แล้วโชว์ชื่อบนเวทีแทน popup
  function keepWinner() {
    if (!winner || !revealed) return;
    const w = winner;
    setDrawn((d) => [...d, w]);
    setStageResult(w);
    setRevealed(false);
  }

  // ลบออก: ทิ้งรอบนี้ ไม่ลงประวัติ คนนี้ยังอยู่ในวงสุ่มรอบถัดไป
  function dropWinner() {
    if (!winner || !revealed) return;
    setWinner(null);
    setRevealed(false);
    setStageResult(null);
    setLocked(0);
    lockedRef.current = 0;
    setSpin("-----------");
  }

  function clearHistory() {
    if (rolling) return;
    setDrawn([]);
  }

  // Esc ที่ popup = เก็บไว้ (action หลัก ปลอดภัยกว่าลบ)
  useEffect(() => {
    if (!revealed || !winner) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") keepWinner();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const active = rolling || winner !== null;
  const modalOpen = winner !== null && revealed;

  const status = poolError
    ? poolError
    : poolLoading
      ? "กำลังโหลดรายชื่อ…"
      : pool.length === 0
        ? source === "range"
          ? "ไม่มีคนเช็คอินในช่วงที่กรอง"
          : "ยังไม่มีรายชื่อในทะเบียน"
        : noRepeat && candidates.length === 0
          ? "สุ่มครบทุกคนแล้ว — กดล้างประวัติเพื่อเริ่มใหม่"
          : `สุ่มจาก ${candidates.length} คน`;

  const inputCls =
    "tnum rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition-colors focus:border-sky-600 disabled:opacity-50";
  const presetCls =
    "cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";

  const tileBase =
    "tnum inline-flex h-14 w-10 sm:h-16 sm:w-12 items-center justify-center rounded-xl border-2 font-mono text-2xl sm:text-3xl font-bold transition-colors duration-150";

  return (
    <section className="flex flex-col gap-4">
      {/* การ์ดตั้งค่า */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <IconDice className="h-5 w-5 text-sky-700" />
          ตั้งค่าการสุ่ม
        </h2>

        <div className="flex flex-wrap items-center gap-4">
          <div
            role="radiogroup"
            aria-label="กลุ่มที่สุ่ม"
            className="flex rounded-xl border border-slate-300 bg-slate-50 p-1"
          >
            {(["range", "all"] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={source === s}
                onClick={() => setSource(s)}
                disabled={rolling}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  source === s
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s === "range"
                  ? `กรองตามช่วงเวลา${source === "range" ? ` (${poolLoading ? "…" : pool.length})` : ""}`
                  : `ทั้งหมดในทะเบียน${source === "all" ? ` (${poolLoading ? "…" : pool.length})` : ""}`}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={noRepeat}
              onChange={(e) => setNoRepeat(e.target.checked)}
              disabled={rolling}
              className="h-4 w-4 accent-sky-700"
            />
            ไม่สุ่มซ้ำคนที่ออกแล้ว
          </label>
          <button
            onClick={clearHistory}
            disabled={rolling || drawn.length === 0}
            className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ล้างประวัติ
          </button>
        </div>

        {source === "range" && (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              จากวันที่
              <input
                type="date"
                value={dFrom}
                onChange={(e) => setDFrom(e.target.value)}
                disabled={rolling}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              ถึงวันที่
              <input
                type="date"
                value={dTo}
                onChange={(e) => setDTo(e.target.value)}
                disabled={rolling}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              เวลาเริ่ม
              <input
                type="time"
                value={dFromTime}
                onChange={(e) => setDFromTime(e.target.value)}
                disabled={rolling}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              เวลาจบ
              <input
                type="time"
                value={dToTime}
                onChange={(e) => setDToTime(e.target.value)}
                disabled={rolling}
                className={inputCls}
              />
            </label>
            <button
              onClick={() => {
                const t = todayStr();
                setDFrom(t);
                setDTo(t);
              }}
              disabled={rolling}
              className={presetCls}
            >
              วันนี้
            </button>
            <button
              onClick={() => {
                const t = todayStr();
                const weekAgo = new Date(Date.now() - 6 * 86400000)
                  .toLocaleDateString("en-CA");
                setDFrom(weekAgo);
                setDTo(t);
              }}
              disabled={rolling}
              className={presetCls}
            >
              7 วัน
            </button>
            <button
              onClick={() => {
                setDFrom("");
                setDTo("");
              }}
              disabled={rolling}
              className={presetCls}
            >
              ทั้งหมด
            </button>
          </div>
        )}

        <p role="status" className="mt-3 text-sm font-medium text-slate-500">
          {status}
        </p>
      </div>

      {/* เวทีสุ่ม */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-10 shadow-sm">
        {confetti.map((p) => (
          <span
            key={p.id}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 rounded-[2px]"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 1.6,
              backgroundColor: p.color,
              animation: `draw-confetti-fall 1.9s ${p.delay}s cubic-bezier(0.3, 0.4, 0.7, 1) forwards`,
            }}
          />
        ))}

        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 sm:gap-x-6"
          aria-hidden="true"
        >
          {GROUPS.map(([s, e], gi) => (
            <div key={gi} className="flex gap-1.5 sm:gap-2">
              {Array.from({ length: e - s }, (_, k) => {
                const i = s + k;
                const isLocked = active && i < locked;
                const ch = active ? spin[i] : "–";
                return (
                  <span
                    key={`${i}-${isLocked}`}
                    className={`${tileBase} ${
                      isLocked
                        ? "border-slate-900 bg-slate-900 text-white draw-digit-pop"
                        : active
                          ? "border-slate-200 bg-slate-100 text-slate-400"
                          : "border-slate-200 bg-slate-50 text-slate-300"
                    }`}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-10 flex min-h-24 items-center justify-center px-4 text-center">
          {stageResult ? (
            <p
              role="status"
              className="draw-name-in text-3xl font-bold text-slate-900 sm:text-4xl"
            >
              <IconSparkle className="mr-2 inline h-7 w-7 text-amber-500 sm:h-8 sm:w-8" />
              {stageResult.name}
              <IconSparkle className="ml-2 inline h-7 w-7 text-amber-500 sm:h-8 sm:w-8" />
            </p>
          ) : (
            <p className="text-sm font-medium text-slate-300">
              {rolling ? "" : "กดปุ่มด้านล่างเพื่อสุ่มรางวัล"}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={draw}
            disabled={rolling || revealed || candidates.length === 0}
            className="cursor-pointer rounded-2xl bg-slate-900 px-12 py-4 text-lg font-bold text-white shadow-sm transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {rolling ? "กำลังสุ่ม…" : stageResult ? "สุ่มอีกครั้ง" : "สุ่ม!"}
          </button>
        </div>
      </div>

      {/* popup เฉลยชื่อ — เลือกว่าจะเก็บไว้ในลิสต์การสุ่มหรือลบออก */}
      {modalOpen && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`ผู้ชนะการสุ่ม ${winner.name}`}
        >
          <div className="modal-card w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <IconSparkle className="h-9 w-9" />
            </span>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-sky-700">
              ผู้ชนะการสุ่ม
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              {winner.name}
            </p>
            <p className="tnum mt-2 font-mono text-lg tracking-wider text-slate-400">
              {winner.student_id}
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-between">
              <button
                onClick={dropWinner}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition-all hover:bg-red-50 active:scale-95"
              >
                <IconTrash className="h-5 w-5" />
                ลบออก
              </button>
              <button
                autoFocus
                onClick={keepWinner}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition-all hover:bg-slate-700 active:scale-95"
              >
                <IconCheck className="h-5 w-5" />
                เก็บไว้
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              ลบออก = ทิ้งรอบนี้ คนนี้ยังถูกสุ่มได้ในรอบถัดไป
            </p>
          </div>
        </div>
      )}

      {/* ประวัติการสุ่ม */}
      {drawn.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <IconDice className="h-5 w-5 text-sky-700" />
            ประวัติ ({drawn.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...drawn].reverse().map((d, idx) => (
              <span
                key={d.student_id}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  idx === 0
                    ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400"
                    : "bg-sky-100 text-sky-800"
                }`}
              >
                {drawn.length - idx}. {d.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
