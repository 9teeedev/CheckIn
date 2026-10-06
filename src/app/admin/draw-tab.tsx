"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  isMuted,
  playCongrats,
  playSpinTick,
  playTick,
  setMuted,
  unlockAudio,
} from "@/lib/sound";
import { extractStudentId } from "@/lib/util";

type Person = { student_id: string; name: string };
type HistoryEntry = Person & { removed: boolean };

/** แบ่ง 11 หลักเป็นกลุ่ม 2-3-3-3 ตามลำดับการเฉลย */
const GROUPS: Array<[number, number]> = [
  [0, 2],
  [2, 5],
  [5, 8],
  [8, 11],
];

/** จังหวะสั่งเบรกวงล้อ (ms) — 67 → 040 → 249 ทีละกลุ่ม ส่วน 3 ตัวท้ายทีละตัว ช้าขึ้นเรื่อยๆ */
const REVEAL: Array<{ s: number; e: number; at: number }> = [
  { s: 0, e: 2, at: 1000 },
  { s: 2, e: 5, at: 2700 },
  { s: 5, e: 8, at: 4600 },
  { s: 8, e: 9, at: 6600 },
  { s: 9, e: 10, at: 8100 },
  { s: 10, e: 11, at: 9700 },
];
const NAME_AT = 11200;

/** เก็บวงสุ่ม + ประวัติไว้ใน localStorage รีเฟรชไม่หาย */
const LS_KEY = "checkin-draw";

const displayName = (p: Person) => p.name || p.student_id;

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

function IconPencil({ className = "" }: { className?: string }) {
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
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconX({ className = "" }: { className?: string }) {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconSpeakerOn({ className = "" }: { className?: string }) {
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
      <path d="M11 5 6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function IconSpeakerOff({ className = "" }: { className?: string }) {
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
      <path d="M11 5 6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5z" />
      <path d="M22 9l-6 6M16 9l6 6" />
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

/**
 * วงล้อสล็อต — แถบเลขของแต่ละหลัก slice จากรายชื่อจริงที่กรอก (เฉพาะเลขที่เป็นไปได้ที่หลักนั้น
 * เช่น 67xxx + 68xxx → หลักแรกมีแค่ 6 หลักสองมี 7,8) คัดซ้ำ+เรียง ทำซ้ำต่อกันเป็นแถบยาวเลื่อนขึ้น
 */
const REEL_REPEATS = 5; // ทำซ้ำกี่รอบ (ต้องยาวพอให้เห็นครบ 5 แถวตลอดช่วงเลื่อน)
const REEL_CYCLES = 3; // รอบ/วินาที ตอนหมุน (คูณจำนวนเลขของหลักนั้น = ช่อง/วินาที)
const REEL_OVER = 0.22; // สัดส่วนช่อง — เว่อร์เลยเป้าหมายแล้วเด้งกลับ ให้เหมือนเฟืองจริงกระแทกขอบตู้
const REEL_STAGGER = 90; // หน่วงจังหวะเบรกของหลักในกลุ่มเดียวกัน (ms)

const REEL_TILE =
  "tnum relative inline-flex h-[280px] w-10 sm:h-[320px] sm:w-14 items-center justify-center overflow-hidden rounded-xl border-2 font-mono text-2xl sm:text-3xl font-bold transition-colors duration-150";

/**
 * ม่านจางบน-ล่างของวงล้อ — จุดสีอยู่ที่ "กึ่งกลางแถว" พอดี (แถวละ 20%):
 * แถวกลาง (40-60%) โปร่งหมด = ชัดสุดหนึ่งเดียว, แถวติดกลางจางครึ่งนึง, แถวนอกสุดจางมากแต่ยังเห็น
 */
function veilGradient(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (a: number) =>
    `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  return `linear-gradient(to bottom, ${c(1)} 0%, ${c(0.78)} 10%, ${c(0.5)} 30%, ${c(0)} 40%, ${c(0)} 60%, ${c(0.5)} 70%, ${c(0.78)} 90%, ${c(1)} 100%)`;
}

/**
 * ช่องเลข 1 หลักแบบวงล้อสล็อต — หน้าต่างสูง 5 แถว แถวกลางชัดสุด แถวรอบจางลงไล่ระดับเหมือนมองวงล้อในตู้
 * mode="spin" แถบเลขเลื่อนขึ้นเรื่อย ๆ พอเปลี่ยนเป็น "brake" จะวิ่งอีกอย่างน้อยหนึ่งรอบเต็ม
 * เบรกช้าลง เว่อร์เลยเป้านิดหน่อยแล้วเด้งกลับนั่งลงบน target พอดีแถวกลาง เสียงติ๊กดังตอนนั่ง
 * (เลื่อนเป็น % ของความสูงแถบเอง ไม่ต้องวัด px — 1 ช่อง = 100 ÷ จำนวนช่องทั้งแถบ)
 */
function Reel({
  mode,
  digits,
  target,
  delay,
}: {
  mode: "idle" | "spin" | "brake";
  digits: string[];
  target: string;
  delay: number;
}) {
  const L = digits.length;
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [landed, setLanded] = useState(false);
  const st = useRef({
    pos: 0,
    L,
    phase: "idle" as "idle" | "spin" | "armed" | "brake" | "settle",
    t0: 0,
    from: 0,
    dest: 0,
    over: 0,
    dur: 1,
    last: 0,
    raf: 0,
    timer: 0,
  });
  // อัปเดตทุกเรนเดอร์ กัน frame/paint ที่ค้างจากเรนเดอร์ก่อนใช้ค่า L เก่า
  st.current.L = L;

  // เลื่อนแถบให้ "เลขปัจจุบัน" อยู่แถวกลางพอดี และมีเลขให้เห็นจาง ๆ ทั้งบน-ล่าง
  const paint = (pos: number) => {
    const el = stripRef.current;
    if (!el) return;
    const s = st.current;
    const q = ((pos % s.L) + s.L) % s.L;
    const cell = 100 / (s.L * REEL_REPEATS);
    el.style.transform = `translateY(${-(q + Math.max(s.L - 2, 0)) * cell}%)`;
  };

  const stopLoop = () => {
    cancelAnimationFrame(st.current.raf);
    st.current.raf = 0;
  };

  const frame = (now: number) => {
    const s = st.current;
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    if (s.phase === "spin" || s.phase === "armed") {
      s.pos += REEL_CYCLES * s.L * dt;
      paint(s.pos);
    } else if (s.phase === "brake") {
      const t = Math.min(1, (now - s.t0) / s.dur);
      s.pos = s.from + (s.dest - s.from) * (1 - Math.pow(1 - t, 3));
      paint(s.pos);
      if (t >= 1) {
        s.dest -= s.over; // จุดนั่งจริง = เป้าหมายพอดี (ตัดส่วนเว่อร์ออก)
        s.dur = 150;
        s.t0 = now;
        s.phase = "settle";
      }
    } else if (s.phase === "settle") {
      const t = Math.min(1, (now - s.t0) / s.dur);
      s.pos = s.dest + s.over * Math.pow(1 - t, 2);
      paint(s.pos);
      if (t >= 1) {
        s.phase = "idle";
        s.pos = s.dest;
        paint(s.pos);
        setLanded(true);
        playTick();
        stopLoop();
        return;
      }
    }
    s.raf = requestAnimationFrame(frame);
  };

  const startLoop = () => {
    if (st.current.raf) return;
    st.current.last = performance.now();
    st.current.raf = requestAnimationFrame(frame);
  };

  useEffect(() => {
    const s = st.current;
    if (mode === "idle") {
      window.clearTimeout(s.timer);
      stopLoop();
      s.phase = "idle";
      s.pos = 0;
      setLanded(false);
      paint(0);
      return;
    }
    if (mode === "spin") {
      if (s.phase !== "idle") return;
      setLanded(false);
      s.phase = "spin";
      startLoop();
      return;
    }
    // mode === "brake"
    if (s.phase === "armed" || s.phase === "brake" || s.phase === "settle")
      return;
    if (
      s.phase === "idle" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      s.pos = Math.max(0, digits.indexOf(target));
      paint(s.pos);
      setLanded(true);
      return;
    }
    if (s.phase === "idle") {
      s.phase = "spin";
      startLoop();
    }
    s.phase = "armed";
    s.timer = window.setTimeout(() => {
      const tIdx = Math.max(0, digits.indexOf(target));
      // ระยะแบบ "หนึ่งรอบเต็มขึ้นไป" เพื่อให้ปลายทางลงตัวบน target พอดี (mod L)
      const gap = ((((tIdx - s.pos) % s.L) + s.L) % s.L) + s.L;
      s.from = s.pos;
      s.dest = s.pos + gap;
      s.over = REEL_OVER;
      s.dur = Math.min(1250, Math.max(700, (gap * 3000) / (REEL_CYCLES * s.L)));
      s.t0 = performance.now();
      s.phase = "brake";
      startLoop();
    }, delay);
  }, [mode, digits, target, delay]);

  useEffect(() => {
    const s = st.current;
    return () => {
      window.clearTimeout(s.timer);
      cancelAnimationFrame(s.raf);
    };
  }, []);

  const spinning = mode !== "idle" && !landed;
  return (
    <span
      className={`${REEL_TILE} ${
        spinning || landed
          ? "border-slate-200 bg-slate-100 text-slate-400"
          : "border-slate-200 bg-slate-50 text-slate-300"
      }`}
    >
      {spinning || landed ? (
        <>
          <span
            ref={stripRef}
            aria-hidden="true"
            className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
          >
            {Array.from({ length: L * REEL_REPEATS }, (_, j) => (
              <span
                key={j}
                className="flex h-14 items-center justify-center sm:h-16"
              >
                {digits[j % L]}
              </span>
            ))}
          </span>
          {/* ได้ผลแล้ว — แถบกลาง (แถวที่ 3) เป็นสีเขียว เลขขาว พร้อมเด้ง */}
          {landed && (
            <span
              aria-hidden="true"
              className="draw-digit-pop absolute inset-x-0 top-[40%] flex h-[20%] items-center justify-center bg-emerald-600 font-mono text-2xl font-bold text-white sm:text-3xl"
            >
              {target}
            </span>
          )}
          {/* ม่านจางบน-ล่าง — แถวกลางชัดสุดเดียว แถวรอบจางลงเรื่อย ๆ เหมือนวงล้อลึกในตู้ */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{ background: veilGradient("#f1f5f9") }}
          />
        </>
      ) : (
        "–"
      )}
    </span>
  );
}

const CONFETTI_COLORS = ["#0284c7", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6"];

export default function DrawTab() {
  const [pool, setPool] = useState<Person[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [voiceOff, setVoiceOff] = useState(false);
  const [tickOff, setTickOff] = useState(false);

  const [rolling, setRolling] = useState(false);
  const [locked, setLocked] = useState(0);
  const [winner, setWinner] = useState<Person | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [stageResult, setStageResult] = useState<Person | null>(null);
  const [confetti, setConfetti] = useState<Piece[]>([]);
  const timers = useRef<number[]>([]);
  // จำนวนหลักที่ล็อคแล้วนับจากซ้าย (ref อัปเดตทันที กัน interval ตัวหมุนใช้ค่าเก่าเขียนทับ)
  const lockedRef = useRef(0);

  // เลขที่เป็นไปได้ของแต่ละหลัก — slice จากรายชื่อจริงที่กรอกเข้ามา (คัดซ้ำ เรียง)
  // เช่น 67040249128 + 68040249117 → หลัก 1 มีแค่ 6 / หลัก 2 มี 7,8 / หลัก 3 มีแค่ 0
  const poolDigits = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) =>
        [...new Set(pool.map((p) => p.student_id[i] ?? "0"))].sort()
      ),
    [pool]
  );

  useEffect(() => {
    const stash = timers.current;
    return () => stash.forEach((t) => window.clearTimeout(t));
  }, []);

  // โหลดวงสุ่มที่เคยกรอกไว้ (หลัง mount กัน hydration mismatch)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { pool?: Person[]; history?: HistoryEntry[] };
        if (Array.isArray(data.pool)) setPool(data.pool);
        if (Array.isArray(data.history)) setHistory(data.history);
      }
    } catch {
      /* localStorage พังก็ปล่อยเป็นวงว่าง */
    }
    setVoiceOff(isMuted("voice"));
    setTickOff(isMuted("tick"));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({ pool, history }));
    } catch {
      /* เต็ม/ถูกห้ามก็ข้าม */
    }
  }, [ready, pool, history]);

  // เสียงแต๊ะตามจังหวะวงล้อหมุน (ภาพวงล้อจัดการเองใน Reel)
  // เงียบช่วงท้าย (สั่งเบรกครบแล้ว ค้างไว้ก่อนเฉลยชื่อ) ให้เงียบเพิ่มความลุ้น
  useEffect(() => {
    if (!rolling) return;
    const iv = window.setInterval(() => {
      if (lockedRef.current < 11) playSpinTick();
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

  function resetStage() {
    setWinner(null);
    setRevealed(false);
    setStageResult(null);
    setLocked(0);
    lockedRef.current = 0;
  }

  function draw() {
    if (rolling || revealed || pool.length === 0) return;
    unlockAudio();
    clearTimers();
    lockedRef.current = 0;
    const w = pool[Math.floor(Math.random() * pool.length)];
    setWinner(w);
    setRevealed(false);
    setStageResult(null);
    setLocked(0);
    setRolling(true);

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      lockedRef.current = 11;
      setLocked(11);
      setRolling(false);
      setRevealed(true);
      playCongrats();
      return;
    }

    // สั่งเบรกวงล้อ 67 → 040 → 249 ทีละกลุ่ม แล้ว 3 ตัวท้ายทีละตัว
    // (แต่ละวงล้อค่อย ๆ เลื่อนขึ้นลงจอดบนเลขจริง เสียงติ๊กดังตอนจอด)
    REVEAL.forEach(({ e, at }) => {
      timers.current.push(
        window.setTimeout(() => {
          lockedRef.current = e;
          setLocked(e);
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

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // เก็บไว้ = คนนี้ยังอยู่ในวงสุ่ม (สุ่มซ้ำได้) + จดลงประวัติ
  function keepWinner() {
    if (!winner || !revealed) return;
    const w = winner;
    setHistory((h) => [...h, { ...w, removed: false }]);
    setStageResult(w);
    setRevealed(false);
  }

  // ลบออก = ตัดชื่อนี้ออกจากวงสุ่มถาวร (เหมือน wheelofnames) + จดลงประวัติ
  function dropWinner() {
    if (!winner || !revealed) return;
    const w = winner;
    setPool((p) => p.filter((x) => x.student_id !== w.student_id));
    setHistory((h) => [...h, { ...w, removed: true }]);
    resetStage();
  }

  function removeFromPool(id: string) {
    if (rolling || revealed) return;
    setPool((p) => p.filter((x) => x.student_id !== id));
  }

  function openEditor() {
    if (rolling || revealed) return;
    setEditorText(pool.map((p) => p.student_id).join("\n"));
    setEditorOpen(true);
  }

  // บันทึกรายชื่อจาก textarea: บรรทัดละ 1 คน — รับได้ทั้ง "รหัส" และ "รหัส, ชื่อ" (วางจากแท็บส่งออก)
  // ดึงเลข 11 หลักเป็นรหัส ตัวหลัง comma เป็นชื่อ (ใช้เมื่อไม่มีในทะเบียน) ตัดซ้ำตามรหัส
  async function savePool() {
    const lineNames = new Map<string, string>();
    const ids: string[] = [];
    for (const raw of editorText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const id = extractStudentId(line);
      if (!id) continue;
      const comma = line.indexOf(",");
      const name = comma >= 0 ? line.slice(comma + 1).trim() : "";
      if (!lineNames.has(id)) {
        lineNames.set(id, name);
        ids.push(id);
      }
    }
    const nameById = new Map<string, string>();
    try {
      const res = await fetch("/api/students");
      const data = await res.json();
      for (const s of data.students ?? []) {
        nameById.set(s.student_id, s.name);
      }
    } catch {
      /* ดึงทะเบียนไม่ได้ก็ใช้ชื่อจากบรรทัดที่วาง หรือโชว์รหัสแทน */
    }
    setPool(
      ids.map((id) => ({
        student_id: id,
        name: nameById.get(id) || lineNames.get(id) || "",
      }))
    );
    resetStage();
    setEditorOpen(false);
  }

  // Esc ที่ popup เฉลย = เก็บไว้ (action หลัก ปลอดภัยกว่าลบ) / ที่ popup กรอกรายชื่อ = ยกเลิก
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (winner && revealed) keepWinner();
      else if (editorOpen) setEditorOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const modalOpen = winner !== null && revealed;

  const status = !ready
    ? "…"
    : pool.length === 0
      ? 'ยังไม่มีรายชื่อ — กด "กรอกรายชื่อ" เพื่อใส่รหัสนักศึกษา'
      : `สุ่มจาก ${pool.length} คน`;

  return (
    <section className="flex flex-col gap-4">
      {/* การ์ดตั้งค่า */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <IconDice className="h-5 w-5 text-sky-700" />
          ตั้งค่าการสุ่ม
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openEditor}
            disabled={rolling || revealed}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconPencil className="h-4 w-4" />
            กรอกรายชื่อ
          </button>
          <button
            onClick={() => setHistory([])}
            disabled={rolling || history.length === 0}
            className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ล้างประวัติ
          </button>
          <button
            onClick={() => {
              const next = !voiceOff;
              setVoiceOff(next);
              setMuted("voice", next);
            }}
            aria-pressed={!voiceOff}
            title={voiceOff ? "เปิดเสียงพูด" : "ปิดเสียงพูด"}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              voiceOff
                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {voiceOff ? (
              <IconSpeakerOff className="h-4 w-4" />
            ) : (
              <IconSpeakerOn className="h-4 w-4" />
            )}
            เสียงพูด
          </button>
          <button
            onClick={() => {
              const next = !tickOff;
              setTickOff(next);
              setMuted("tick", next);
            }}
            aria-pressed={!tickOff}
            title={tickOff ? "เปิดเสียงติ๊ก" : "ปิดเสียงติ๊ก"}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              tickOff
                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {tickOff ? (
              <IconSpeakerOff className="h-4 w-4" />
            ) : (
              <IconSpeakerOn className="h-4 w-4" />
            )}
            เสียงติ๊ก
          </button>
        </div>
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
                const spinning = rolling || winner !== null;
                const mode = !spinning
                  ? "idle"
                  : i < locked
                    ? "brake"
                    : "spin";
                return (
                  <Reel
                    key={i}
                    mode={mode}
                    digits={poolDigits[i] ?? ["0"]}
                    target={
                      winner ? (winner.student_id[i] ?? poolDigits[i]?.[0]) : (poolDigits[i]?.[0] ?? "0")
                    }
                    delay={k * REEL_STAGGER}
                  />
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
              {displayName(stageResult)}
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
            disabled={rolling || revealed || pool.length === 0}
            className="cursor-pointer rounded-2xl bg-slate-900 px-12 py-4 text-lg font-bold text-white shadow-sm transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {rolling ? "กำลังสุ่ม…" : stageResult ? "สุ่มอีกครั้ง" : "สุ่ม!"}
          </button>
        </div>
      </div>

      {/* วงสุ่มปัจจุบัน */}
      {pool.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <IconDice className="h-5 w-5 text-sky-700" />
              รายชื่อในวงสุ่ม ({pool.length})
            </h2>
            <button
              onClick={openEditor}
              disabled={rolling || revealed}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconPencil className="h-3.5 w-3.5" />
              แก้ไข
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {pool.map((p) => (
              <span
                key={p.student_id}
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 py-1.5 pl-4 pr-2 text-sm font-semibold text-sky-800"
              >
                {displayName(p)}
                <button
                  onClick={() => removeFromPool(p.student_id)}
                  aria-label={`ตัด ${displayName(p)} ออกจากวงสุ่ม`}
                  className="cursor-pointer rounded-full p-1 text-sky-500 transition-colors hover:bg-sky-200 hover:text-sky-900"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ประวัติการสุ่ม */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <IconDice className="h-5 w-5 text-sky-700" />
            ประวัติ ({history.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...history].reverse().map((d, idx) => (
              <span
                key={`${d.student_id}-${history.length - idx}`}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  d.removed
                    ? "bg-red-50 text-red-400 line-through"
                    : idx === 0
                      ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400"
                      : "bg-sky-100 text-sky-800"
                }`}
              >
                {history.length - idx}. {displayName(d)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* popup กรอกรายชื่อ */}
      {editorOpen && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="กรอกรายชื่อที่จะสุ่ม"
        >
          <div className="modal-card w-full max-w-md rounded-3xl bg-white p-6 shadow-xl sm:p-8">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <IconPencil className="h-5 w-5 text-sky-700" />
              กรอกรายชื่อที่จะสุ่ม
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              บรรทัดละ 1 คน — ใส่รหัส 11 หลัก หรือวางจากแท็บส่งออก
              (“รหัส, ชื่อ”) ก็ได้ ดึงชื่อจากทะเบียนให้อัตโนมัติ
            </p>
            <label className="sr-only" htmlFor="draw-pool-editor">
              รายชื่อรหัสนักศึกษา
            </label>
            <textarea
              id="draw-pool-editor"
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              placeholder={"67040249128\n67040249112"}
              spellCheck={false}
              className="tnum mt-4 h-64 w-full resize-y rounded-xl border-2 border-slate-200 bg-slate-50 p-4 font-mono text-base leading-7 text-slate-900 outline-none transition-colors focus:border-sky-600"
            />
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:justify-between">
              <button
                onClick={() => setEditorOpen(false)}
                className="cursor-pointer rounded-xl border-2 border-slate-200 bg-white px-5 py-3 font-semibold text-slate-600 transition-all hover:bg-slate-100 active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                autoFocus
                onClick={() => void savePool()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition-all hover:bg-slate-700 active:scale-95"
              >
                <IconCheck className="h-5 w-5" />
                บันทึกรายชื่อ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* popup เฉลยชื่อ — เลือกว่าจะเก็บไว้ในวงสุ่มหรือตัดออก */}
      {modalOpen && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`ผู้ชนะการสุ่ม ${displayName(winner)}`}
        >
          <div className="modal-card w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <IconSparkle className="h-9 w-9" />
            </span>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-sky-700">
              ผู้ชนะการสุ่ม
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              {displayName(winner)}
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
              ลบออก = ตัดชื่อนี้ออกจากวงสุ่มถาวร • เก็บไว้ = ยังอยู่ในวงสุ่ม
              สุ่มซ้ำได้
            </p>
          </div>
        </div>
      )}
    </section>
  );
}