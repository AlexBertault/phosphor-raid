let ctx;
let muted = false;

function ac() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, dur, type = "square", gain = 0.04, slide = 0) {
  if (muted) return;
  const audio = ac();
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audio.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), audio.currentTime + dur);
  g.gain.setValueAtTime(gain, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + dur + 0.02);
}

export function sfxShoot() {
  tone(520, 0.06, "square", 0.03, -280);
}

export function sfxHit() {
  tone(180, 0.08, "sawtooth", 0.04, -80);
}

export function sfxDie() {
  tone(140, 0.18, "square", 0.05, -100);
  tone(90, 0.22, "triangle", 0.04, -40);
}

export function sfxDash() {
  tone(240, 0.1, "square", 0.03, 220);
}

export function sfxHurt() {
  tone(90, 0.16, "sawtooth", 0.05, -60);
}

export function sfxPickup() {
  tone(520, 0.08, "square", 0.035, 0);
  tone(780, 0.1, "square", 0.03, 0);
}

export function sfxPortal() {
  tone(220, 0.25, "triangle", 0.05, 260);
  tone(330, 0.3, "square", 0.03, 180);
}

export function sfxReload() {
  tone(180, 0.05, "square", 0.03, 80);
  tone(260, 0.08, "square", 0.025, 40);
}

export function sfxEmpty() {
  tone(90, 0.05, "square", 0.025);
}

export function sfxMelee() {
  tone(160, 0.1, "sawtooth", 0.045, -90);
  tone(70, 0.12, "square", 0.03, -30);
}

export function sfxSwap() {
  tone(300, 0.06, "square", 0.03, 120);
}

let musicTimer = 0;
const NOTES = [196, 220, 247, 262, 294, 330, 392];

export function tickMusic(t, step = 0.18) {
  if (muted) return;
  if (t < musicTimer) return;
  musicTimer = t + step;
  const i = Math.floor(t * (2.2 + (0.18 - step) * 12)) % NOTES.length;
  const bass = Math.floor(t * 0.55) % 4 === 0;
  tone(NOTES[i] / (bass ? 2 : 1), bass ? 0.16 : 0.09, bass ? "triangle" : "square", bass ? 0.025 : 0.012);
}

export function unlockAudio() {
  ac();
}
