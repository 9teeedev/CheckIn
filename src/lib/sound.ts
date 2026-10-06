let ctx: AudioContext | null = null;

/** ปิดเสียงแยกกลุ่ม (เก็บค้างใน localStorage รีเฟรชไม่หาย)
 *  voice = เสียงพูด/เฉลยรางวัล (รวมเสียงปี๊บสำรอง), tick = เสียงติ๊กวงล้อ/จัดที่นั่ง */
export type MuteKind = "voice" | "tick";
const MUTE_KEY: Record<MuteKind, string> = {
  voice: "checkin-muted-voice",
  tick: "checkin-muted-tick",
};
const muted: Record<MuteKind, boolean> = { voice: false, tick: false };
if (typeof window !== "undefined") {
  for (const kind of ["voice", "tick"] as const) {
    try {
      muted[kind] = window.localStorage.getItem(MUTE_KEY[kind]) === "1";
    } catch {
      /* localStorage ถูกห้ามก็ถือว่าเปิดเสียง */
    }
  }
}

export function setMuted(kind: MuteKind, v: boolean) {
  muted[kind] = v;
  try {
    window.localStorage.setItem(MUTE_KEY[kind], v ? "1" : "0");
  } catch {
    /* เขียนไม่ได้ก็จำในหน่วยความจำอย่างเดียว */
  }
}

export function isMuted(kind: MuteKind) {
  return muted[kind];
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  getCtx();
}

function tone(
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = "sine",
  gainValue = 0.25
) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, audio.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + startAt + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + startAt);
  osc.stop(audio.currentTime + startAt + duration);
}

export function playSuccess() {
  if (muted.voice) return;
  tone(880, 0, 0.12);
  tone(1318, 0.12, 0.25);
}

/** ติ๊กสั้น ๆ ตอนล็อคกลุ่มตัวเลขในหน้าสุ่มรางวัล */
export function playTick() {
  if (muted.tick) return;
  tone(1150, 0, 0.05, "square", 0.1);
}

/** แต๊ะเบา ๆ ตอนตัวเลขกำลังหมุน (เสียงรอกสล็อต สังเคราะห์สด ไม่ใช้ไฟล์) */
export function playSpinTick() {
  if (muted.tick) return;
  tone(1800, 0, 0.03, "square", 0.06);
}

export function playDuplicate() {
  if (muted.voice) return;
  tone(660, 0, 0.15, "triangle");
  tone(660, 0.22, 0.15, "triangle");
}

export function playFail() {
  if (muted.voice) return;
  tone(196, 0, 0.35, "sawtooth", 0.2);
}

export type VoiceKind = "success" | "duplicate" | "error";

/** เสียงฉลองตอนเฉลยรางวัลจากการสุ่ม เร่งความเร็ว 1.25 เท่า */
export function playCongrats() {
  if (typeof window === "undefined" || muted.voice) return;
  const audio = new Audio("/sounds/congrats.mp3");
  audio.playbackRate = 1.25;
  audio.play().catch(() => playSuccess());
}

/**
 * เล่นไฟล์เสียงพูดจาก /public/sounds/{kind}.mp3
 * ถ้ายังไม่มีไฟล์ (หรือเล่นไม่ได้) ใช้เสียงปี๊บสำรองแทน
 */
export function playVoice(kind: VoiceKind) {
  if (typeof window === "undefined" || muted.voice) return;
  const audio = new Audio(`/sounds/${kind}.mp3`);
  audio.play().catch(() => {
    if (kind === "success") playSuccess();
    else if (kind === "duplicate") playDuplicate();
    else playFail();
  });
}
