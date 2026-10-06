"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { playVoice, unlockAudio } from "@/lib/sound";

type CheckinResult = {
  status: "ok" | "duplicate" | "notfound" | "badformat";
  studentId?: string;
  name?: string;
  time?: string;
  message?: string;
  seat?: { table: number; seat: number };
};

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconAlert({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
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

function IconCamera({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export default function CheckinPage() {
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [manual, setManual] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const busyRef = useRef(false);

  const [countdown, setCountdown] = useState(0);

  const closeResult = useCallback(() => setResult(null), []);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/today");
      const data = await res.json();
      setTodayCount(data.count ?? 0);
    } catch {
      /* แสดงครั้งหน้า */
    }
  }, []);

  const submit = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });
        const data: CheckinResult = await res.json();
        setResult(data);
        playVoice(
          data.status === "ok"
            ? "success"
            : data.status === "duplicate"
              ? "duplicate"
              : "error"
        );
        if (data.status === "ok" || data.status === "duplicate") void refreshCount();
      } catch {
        setResult({ status: "badformat", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
        playVoice("error");
      } finally {
        setTimeout(() => {
          busyRef.current = false;
        }, 800);
      }
    },
    [refreshCount]
  );

  const onDecoded = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      // คูลดาวน์ 5 วิต่อรอบ กัน html5-qrcode ยิงซ้ำตอนบัตรยังอยู่ในภาพ เสียง/popup ซ้อนกัน
      if (now - lastScanRef.current.at < 5000) return;
      lastScanRef.current = { text: decodedText, at: now };
      void submit(decodedText);
    },
    [submit]
  );

  const startCamera = useCallback(
    async () => {
      setCamError(null);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        // MacBook มีกล้องหน้าเดียว
        // html5-qrcode: argument แรกรับแค่ facingMode/deviceId เท่านั้น
        // resolution ต้องอยู่ใน videoConstraints ของ config (ตัวนี้แหละที่ส่งให้ getUserMedia)
        await scanner.start(
          { facingMode: "user" },
          {
            fps: 15,
            videoConstraints: {
              facingMode: "user",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              // กรอบ 70% ของภาพ ไม่ต้องเล็งกลางจอ
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
              return { width: edge, height: edge };
            },
          },
          (decodedText) => onDecoded(decodedText),
          () => {
            /* เฟรมที่สแกนไม่เจอ */
          }
        );
        setCamOn(true);
      } catch (err) {
        scannerRef.current = null;
        setCamOn(false);
        // html5-qrcode มัก throw เป็น string ไม่ใช่ Error — String() ให้เห็นสาเหตุจริง
        setCamError(
          err instanceof Error
            ? `เปิดกล้องไม่ได้: ${err.message}`
            : `เปิดกล้องไม่ได้: ${String(err)}`
        );
      }
    },
    [onDecoded]
  );

  const stopCamera = useCallback(async () => {
    try {
      await scannerRef.current?.stop();
      scannerRef.current = null;
      setCamOn(false);
    } catch {
      /* กล้องปิดไปแล้ว */
    }
  }, []);

  useEffect(() => {
    void startCamera();
    void refreshCount();
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      void stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ปุ่ม Esc ปิด popup
  useEffect(() => {
    if (result === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeResult();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, closeResult]);

  // นับถอยหลัง 5 วิแล้วปิด popup เอง (รอบใหม่ = รีเซ็ต)
  useEffect(() => {
    if (result === null) return;
    setCountdown(5);
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [result]);

  useEffect(() => {
    if (countdown <= 0) closeResult();
  }, [countdown, closeResult]);

  const seatLine =
    result?.seat != null ? `โต๊ะ ${result.seat.table} ที่ ${result.seat.seat}` : "";

  const modal = (() => {
    if (result === null)
      return {
        cls: "",
        icon: null,
        title: "",
        detail: "",
      };
    if (result.status === "ok")
      return {
        cls: "border-emerald-300 bg-emerald-50 text-emerald-900",
        icon: <IconCheck className="h-24 w-24 text-emerald-600" />,
        title: "เช็คอินสำเร็จ",
        detail: `${result.name ?? ""} • ${result.studentId ?? ""} • ${result.time ?? ""}`,
      };
    if (result.status === "duplicate")
      return {
        cls: "border-amber-300 bg-amber-50 text-amber-900",
        icon: <IconAlert className="h-24 w-24 text-amber-600" />,
        title: "เช็คไปแล้ววันนี้",
        detail: `${result.name ?? ""} เช็คตอน ${result.time ?? ""}`,
      };
    return {
      cls: "border-red-300 bg-red-50 text-red-900",
      icon: <IconX className="h-24 w-24 text-red-600" />,
      title: "ไม่สำเร็จ",
      detail: result.message ?? "รหัสไม่ถูกต้อง",
    };
  })();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">
            ลงทะเบียนเข้าร่วมงานบายเนียร์
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            สแกนบัตรนักศึกษา หรือพิมพ์รหัส 11 หลัก
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tnum rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800">
            วันนี้ {todayCount ?? "…"} คน
          </span>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            หน้าแอดมิน
          </Link>
        </div>
      </header>

      <div className="grid flex-1 items-start gap-6 lg:grid-cols-2">
        {/* กล้อง */}
        <section
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          aria-label="กล้องสแกน QR"
        >
          <div className="relative aspect-[4/3] w-full bg-slate-100">
            <div id="reader" className="h-full w-full" />
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <IconCamera className="h-16 w-16 text-slate-300" />
                <button
                  onClick={() => void startCamera()}
                  className="cursor-pointer rounded-xl bg-sky-700 px-6 py-3 text-base font-semibold text-white transition-transform hover:bg-sky-600 active:scale-95"
                >
                  เปิดกล้องสแกน QR
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            {camError ? (
              <p className="text-sm font-medium text-red-700">{camError}</p>
            ) : (
              <p className="text-sm text-slate-500">
                {camOn ? "กล้องเปิดอยู่ — รอสแกนบัตร" : "กล้องปิดอยู่"}
              </p>
            )}
            {camOn && (
              <button
                onClick={() => void stopCamera()}
                className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                ปิดกล้อง
              </button>
            )}
          </div>
        </section>

        <div className="flex flex-col justify-center gap-4">
          {/* พิมพ์รหัส */}
          <section
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            aria-label="พิมพ์รหัสนักศึกษา"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = manual.trim();
                if (!value) return;
                void submit(value);
                setManual("");
              }}
              className="flex gap-2"
            >
              <label className="sr-only" htmlFor="student-id-input">
                รหัสนักศึกษา 11 หลัก
              </label>
              <input
                id="student-id-input"
                ref={(el) => el?.focus()}
                value={manual}
                onChange={(e) => setManual(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="พิมพ์รหัสนักศึกษา 11 หลัก แล้วกด Enter"
                maxLength={11}
                className="tnum min-h-16 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-5 text-2xl font-semibold tracking-[0.25em] text-slate-900 outline-none transition-colors focus:border-sky-600 focus:bg-white"
              />
              <button
                type="submit"
                disabled={manual.trim() === ""}
                className="h-16 cursor-pointer rounded-xl bg-emerald-700 px-8 text-lg font-bold text-white transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                เช็คอิน
              </button>
            </form>
          </section>
        </div>
      </div>

      {/* popup ผลลัพธ์กลางจอ */}
      {result && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={closeResult}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modal.title}
            onClick={(e) => e.stopPropagation()}
            className={`modal-card relative w-full max-w-lg rounded-3xl border-2 px-8 py-12 text-center shadow-2xl ${modal.cls}`}
          >
            <button
              onClick={closeResult}
              aria-label="ปิดหน้าต่างผลลัพธ์"
              className="absolute right-4 top-4 cursor-pointer rounded-lg p-2 text-current opacity-50 transition-opacity hover:opacity-100"
            >
              <IconX className="h-6 w-6" />
            </button>
            <div className="flex justify-center">{modal.icon}</div>
            <div className="mt-4 text-4xl font-bold">{modal.title}</div>
            <div className="tnum mt-2 text-lg">{modal.detail}</div>
            {seatLine && (
              <div className="mt-4">
                <span className="tnum inline-flex items-center rounded-3xl bg-white/80 px-10 py-4 text-5xl font-extrabold tracking-wide text-slate-900 shadow-sm ring-2 ring-current/20">
                  {seatLine}
                </span>
              </div>
            )}

            <button
              onClick={closeResult}
              aria-label={`ตกลง ปิดเองในอีก ${countdown} วินาที`}
              className="mt-8 inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-900 px-10 py-3.5 text-lg font-semibold text-white transition-all hover:bg-slate-700 active:scale-95"
            >
              ตกลง
              <span
                aria-hidden="true"
                className="tnum flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/40 text-base font-bold"
              >
                {Math.max(countdown, 0)}
              </span>
            </button>

            <div
              className="mx-auto mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-current/15"
              role="presentation"
            >
              <div
                className="h-full rounded-full bg-current/50 transition-[width] duration-1000 ease-linear"
                style={{ width: `${(Math.max(countdown, 0) / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
