"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import DrawTab from "./draw-tab";
import SeatingTab from "./seating-tab";

type TodayRow = { id: number; student_id: string; name: string; time: string };
type Student = { student_id: string; name: string; created_at: string };
type MissingRow = { student_id: string; name: string };
type Tab = "today" | "roster" | "missing" | "export" | "draw" | "seating";

const todayStr = () => new Date().toLocaleDateString("en-CA");

const TABS: Tab[] = ["today", "roster", "missing", "export", "draw", "seating"];

/** อ่าน ?tab= ตอนโหลดหน้า — รีเฟรชแล้วอยู่แท็บเดิม (ใช้หลัง mount กัน hydration mismatch) */
function tabFromUrl(): Tab | null {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("tab");
  return TABS.includes(t as Tab) ? (t as Tab) : null;
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
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

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function IconUsers({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconUpload({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

function IconUserPlus({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function IconClipboard({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function IconCalendar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconClock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="text-slate-300 [&>svg]:h-12 [&>svg]:w-12">{icon}</div>
      <p className="font-medium text-slate-600">{title}</p>
      <p className="text-sm text-slate-400">{hint}</p>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("today");

  useEffect(() => {
    const t = tabFromUrl();
    if (t) setTab(t);
  }, []);

  function selectTab(t: Tab) {
    setTab(t);
    // เก็บแท็บปัจจุบันไว้ใน URL (replace ไม่อุดประวัติย้อนกลับ)
    window.history.replaceState(
      null,
      "",
      t === "today" ? "/admin" : `/admin?tab=${t}`
    );
  }

  const [todayDate, setTodayDate] = useState("");
  const [todayRows, setTodayRows] = useState<TodayRow[]>([]);

  const [students, setStudents] = useState<Student[]>([]);
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [csvOk, setCsvOk] = useState<boolean | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [missingRows, setMissingRows] = useState<MissingRow[]>([]);

  const [expFrom, setExpFrom] = useState("");
  const [expTo, setExpTo] = useState("");
  const [expFromTime, setExpFromTime] = useState("");
  const [expToTime, setExpToTime] = useState("");
  const [expNames, setExpNames] = useState<string[] | null>(null);
  const [expMsg, setExpMsg] = useState<string | null>(null);

  const loadExport = useCallback(
    async (from: string, to: string, fromTime: string, toTime: string) => {
      setExpMsg(null);
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (fromTime) qs.set("fromTime", fromTime);
      if (toTime) qs.set("toTime", toTime);
      const res = await fetch(`/api/export?${qs.toString()}`);
      const data = await res.json();
      if (res.ok) {
        const people: Array<{ student_id: string; name: string }> =
          data.people ?? [];
        setExpNames(people.map((p) => `${p.student_id}, ${p.name}`));
      } else {
        setExpNames([]);
        setExpMsg(data.error ?? "ดึงรายชื่อไม่สำเร็จ");
      }
    },
    []
  );

  async function copyNames() {
    if (!expNames || expNames.length === 0) return;
    try {
      await navigator.clipboard.writeText(expNames.join("\n"));
      setExpMsg(`คัดลอก ${expNames.length} รายชื่อแล้ว`);
    } catch {
      setExpMsg("คัดลอกไม่ได้ — เลือกข้อความในกล่องแล้วกด Cmd+C เอง");
    }
  }

  const loadToday = useCallback(async () => {
    const res = await fetch("/api/today");
    const data = await res.json();
    setTodayDate(data.date ?? "");
    setTodayRows(data.checkins ?? []);
  }, []);

  const loadStudents = useCallback(async () => {
    const res = await fetch("/api/students");
    const data = await res.json();
    setStudents(data.students ?? []);
  }, []);

  const loadMissing = useCallback(async () => {
    const res = await fetch("/api/missing");
    const data = await res.json();
    setMissingRows(data.missing ?? []);
  }, []);

  useEffect(() => {
    if (tab === "today") void loadToday();
    if (tab === "roster") void loadStudents();
    if (tab === "missing") void loadMissing();
    if (tab === "export")
      void loadExport(expFrom, expTo, expFromTime, expToTime);
  }, [
    tab,
    loadToday,
    loadStudents,
    loadMissing,
    loadExport,
    expFrom,
    expTo,
    expFromTime,
    expToTime,
  ]);

  async function deleteCheckin(id: number) {
    if (!confirm("ลบรายการเช็คอินนี้?")) return;
    const res = await fetch(`/api/checkins/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadToday();
    } else {
      alert("ลบไม่สำเร็จ");
    }
  }

  async function deleteStudent(studentId: string) {
    if (
      !confirm(
        `ลบ ${studentId} ออกจากทะเบียน?\nประวัติเช็คอินของคนนี้จะถูกลบด้วย`
      )
    )
      return;
    const res = await fetch(`/api/students/${studentId}`, { method: "DELETE" });
    if (res.ok) {
      await loadStudents();
    } else {
      alert("ลบไม่สำเร็จ");
    }
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: formId.trim(), name: formName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setFormId("");
      setFormName("");
      setFormMsg("เพิ่มแล้ว");
      await loadStudents();
    } else {
      setFormMsg(data.error ?? "เพิ่มไม่สำเร็จ");
    }
  }

  async function uploadCsvFile(file: File) {
    setCsvMsg(null);
    setCsvOk(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/students/import", { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) {
      setCsvOk(true);
      setCsvMsg(`อ่านได้ ${data.parsed} แถว เพิ่มใหม่ ${data.added} ข้ามซ้ำ ${data.skipped}`);
      await loadStudents();
    } else {
      setCsvOk(false);
      setCsvMsg(data.error ?? "นำเข้าไม่สำเร็จ");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => selectTab(t)}
      aria-current={tab === t ? "page" : undefined}
      className={`cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
        tab === t
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
      }`}
    >
      {label}
    </button>
  );

  const delBtn =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50";

  const th = "py-2.5 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400";
  const td = "py-3 pr-4 border-t border-slate-100";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">
          หน้าแอดมิน
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          กลับหน้าเช็คอิน
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="แท็บหน้าแอดมิน">
        {tabBtn("today", `วันนี้ (${todayRows.length})`)}
        {tabBtn("roster", `ทะเบียน (${students.length})`)}
        {tabBtn("missing", `ยังไม่เช็ค (${missingRows.length})`)}
        {tabBtn("export", "ส่งออก")}
        {tabBtn("draw", "สุ่มรางวัล")}
        {tabBtn("seating", "ที่นั่ง")}
      </nav>

      {tab === "today" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <IconCalendar className="h-5 w-5 text-sky-700" />
              รายชื่อวันที่{" "}
              <span className="tnum">{todayDate || "…"}</span>
            </h2>
            <button
              onClick={() => void loadToday()}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              รีเฟรช
            </button>
          </div>
          {todayRows.length === 0 ? (
            <EmptyState
              icon={<IconCheck />}
              title="ยังไม่มีใครเช็คอินวันนี้"
              hint="รายชื่อจะขึ้นอัตโนมัติเมื่อมีการสแกนที่หน้าห้อง"
            />
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={th}>เวลา</th>
                  <th className={th}>รหัสนักศึกษา</th>
                  <th className={th}>ชื่อ</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {todayRows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50">
                    <td className={`${td} tnum font-mono text-slate-900`}>{r.time}</td>
                    <td className={`${td} tnum font-mono text-slate-600`}>{r.student_id}</td>
                    <td className={`${td} font-medium text-slate-900`}>{r.name}</td>
                    <td className={`${td} text-right`}>
                      <button onClick={() => void deleteCheckin(r.id)} className={delBtn}>
                        <IconTrash className="h-4 w-4" />
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "roster" && (
        <section className="flex flex-col gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <IconUserPlus className="h-5 w-5 text-sky-700" />
              เพิ่มนักศึกษารายคน
            </h2>
            <form onSubmit={addStudent} className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="form-id">รหัสนักศึกษา</label>
              <input
                id="form-id"
                value={formId}
                onChange={(e) => setFormId(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="รหัสนักศึกษา 11 หลัก"
                inputMode="numeric"
                maxLength={11}
                className="tnum w-56 rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition-colors focus:border-sky-600"
              />
              <label className="sr-only" htmlFor="form-name">ชื่อ-นามสกุล</label>
              <input
                id="form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition-colors focus:border-sky-600"
              />
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white transition-all hover:bg-slate-700 active:scale-95"
              >
                <IconPlus className="h-4 w-4" />
                เพิ่ม
              </button>
            </form>
            {formMsg && (
              <p className="mt-3 text-sm font-medium text-slate-600">{formMsg}</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <IconUpload className="h-5 w-5 text-sky-700" />
              นำเข้าจากไฟล์ CSV
            </h2>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadCsvFile(file);
              }}
              className="hidden"
            />
            <div
              role="button"
              tabIndex={0}
              aria-label="เลือกหรือลากไฟล์ CSV มาวางเพื่อนำเข้าทะเบียน"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void uploadCsvFile(file);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragOver
                  ? "border-sky-600 bg-sky-50"
                  : "border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/50"
              }`}
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                  dragOver ? "bg-sky-600 text-white" : "bg-sky-100 text-sky-700"
                }`}
              >
                <IconUpload className="h-7 w-7" />
              </span>
              <p className="font-medium text-slate-700">
                กดเพื่อเลือกไฟล์ CSV หรือลากไฟล์มาวางที่นี่
              </p>
              <p className="text-sm text-slate-400">
                รูปแบบ:{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-600 ring-1 ring-slate-200">
                  รหัส11หลัก,ชื่อ-นามสกุล
                </code>{" "}
                — แถวหัวตารางถูกข้ามอัตโนมัติ
              </p>
            </div>
            {csvMsg && (
              <p
                role="status"
                className={`mt-3 flex items-center gap-1.5 text-sm font-medium ${
                  csvOk ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {csvOk && <IconCheck className="h-4 w-4" />}
                {csvMsg}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <IconUsers className="h-5 w-5 text-sky-700" />
              ทะเบียนทั้งหมด ({students.length} คน)
            </h2>
            {students.length === 0 ? (
              <EmptyState
                icon={<IconUsers />}
                title="ยังไม่มีรายชื่อในทะเบียน"
                hint="เพิ่มทีละคนด้านบน หรืออัปโหลด CSV ทั้งห้อง"
              />
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={th}>รหัสนักศึกษา</th>
                    <th className={th}>ชื่อ</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.student_id} className="transition-colors hover:bg-slate-50">
                      <td className={`${td} tnum font-mono text-slate-600`}>{s.student_id}</td>
                      <td className={`${td} font-medium text-slate-900`}>{s.name}</td>
                      <td className={`${td} text-right`}>
                        <button onClick={() => void deleteStudent(s.student_id)} className={delBtn}>
                          <IconTrash className="h-4 w-4" />
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {tab === "missing" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <IconClock className="h-5 w-5 text-sky-700" />
            ยังไม่เช็คอินวันนี้ ({missingRows.length} คน)
          </h2>
          {missingRows.length === 0 ? (
            students.length === 0 ? (
              <EmptyState
                icon={<IconUsers />}
                title="ยังไม่มีรายชื่อในทะเบียน"
                hint="เพิ่มทะเบียนก่อน ระบบจะเทียบรายชื่อคนที่ยังไม่เช็คได้"
              />
            ) : (
              <EmptyState
                icon={<IconCheck />}
                title="ครบทุกคนแล้ว"
                hint="นักศึกษาในทะเบียนเช็คอินครบทั้งหมดวันนี้"
              />
            )
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={th}>รหัสนักศึกษา</th>
                  <th className={th}>ชื่อ</th>
                </tr>
              </thead>
              <tbody>
                {missingRows.map((m) => (
                  <tr key={m.student_id} className="transition-colors hover:bg-slate-50">
                    <td className={`${td} tnum font-mono text-slate-600`}>{m.student_id}</td>
                    <td className={`${td} font-medium text-slate-900`}>{m.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {tab === "export" && (
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <IconClipboard className="h-5 w-5 text-sky-700" />
            ส่งออกรายชื่อตามช่วงเวลา
          </h2>
          <p className="text-sm text-slate-500">
            รายชื่อ+รหัสนักศึกษาของคนที่เช็คอินในช่วงวันที่ที่เลือก (คนละบรรทัด
            ไม่ซ้ำ) พร้อมวางใส่ wheel
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              จากวันที่
              <input
                type="date"
                value={expFrom}
                onChange={(e) => setExpFrom(e.target.value)}
                className="tnum rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition-colors focus:border-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              ถึงวันที่
              <input
                type="date"
                value={expTo}
                onChange={(e) => setExpTo(e.target.value)}
                className="tnum rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition-colors focus:border-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              เวลาเริ่ม
              <input
                type="time"
                value={expFromTime}
                onChange={(e) => setExpFromTime(e.target.value)}
                className="tnum rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition-colors focus:border-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              เวลาจบ
              <input
                type="time"
                value={expToTime}
                onChange={(e) => setExpToTime(e.target.value)}
                className="tnum rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition-colors focus:border-sky-600"
              />
            </label>
            <button
              onClick={() => {
                const t = todayStr();
                setExpFrom(t);
                setExpTo(t);
              }}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              วันนี้
            </button>
            <button
              onClick={() => {
                const t = todayStr();
                const weekAgo = new Date(Date.now() - 6 * 86400000)
                  .toLocaleDateString("en-CA");
                setExpFrom(weekAgo);
                setExpTo(t);
              }}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              7 วัน
            </button>
            <button
              onClick={() => {
                setExpFrom("");
                setExpTo("");
              }}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              ทั้งหมด
            </button>
          </div>

          {expNames !== null && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="tnum rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800">
                  {expNames.length} รายชื่อ
                </span>
                <button
                  onClick={() => void copyNames()}
                  disabled={expNames.length === 0}
                  className="cursor-pointer rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  คัดลอกไปยังคลิปบอร์ด
                </button>
                {expMsg && (
                  <span className="text-sm font-medium text-slate-600">
                    {expMsg}
                  </span>
                )}
              </div>
              <textarea
                readOnly
                value={expNames.join("\n")}
                aria-label="รายชื่อสำหรับคัดลอก"
                className="tnum h-72 w-full resize-y rounded-xl border-2 border-slate-200 bg-slate-50 p-4 font-mono text-base leading-7 text-slate-900 outline-none"
              />
            </>
          )}
        </section>
      )}
      {tab === "draw" && <DrawTab />}
      {tab === "seating" && <SeatingTab />}
    </main>
  );
}
