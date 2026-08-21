let ctx;
let muted = false;

function ac() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, dur, type = "square", gain = 0.04, slide = 0, delay = 0) {
  if (muted) return;
  const audio = ac();
  const t0 = audio.currentTime + delay;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audio.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function sfxShoot(machine = false) {
  if (machine) {
    tone(240, 0.035, "square", 0.038, -140);
    tone(110, 0.045, "sawtooth", 0.018, -50);
  } else {
    tone(920, 0.04, "square", 0.045, -520);
    tone(190, 0.08, "triangle", 0.035, -90);
    tone(140, 0.05, "square", 0.02, -40);
  }
}

export function sfxHit() {
  tone(210, 0.05, "square", 0.04, -90);
  tone(90, 0.09, "sawtooth", 0.03, -40);
}

export function sfxDie() {
  tone(180, 0.07, "square", 0.06, -100);
  tone(92, 0.14, "triangle", 0.055, -55);
  tone(48, 0.22, "sine", 0.05, -18);
  tone(36, 0.12, "square", 0.03, 0, 0.08);
}

export function sfxDash() {
  tone(240, 0.1, "square", 0.03, 220);
}

export function sfxHurt() {
  tone(70, 0.18, "sawtooth", 0.055, -45);
  tone(40, 0.12, "square", 0.03);
}

export function sfxPickup() {
  tone(620, 0.06, "square", 0.03);
  tone(880, 0.09, "square", 0.025, 0, 0.04);
}

export function sfxCoin() {
  tone(980, 0.05, "square", 0.035);
  tone(1480, 0.08, "square", 0.03, 0, 0.04);
}

export function sfxPortal() {
  tone(220, 0.25, "triangle", 0.05, 260);
  tone(330, 0.3, "square", 0.03, 180);
}

export function sfxCrate() {
  tone(110, 0.07, "square", 0.04, -40);
}

export function sfxReload() {
  tone(150, 0.07, "square", 0.045, 30);
  tone(90, 0.09, "triangle", 0.03, 0, 0.05);
}

export function sfxReloadDone() {
  tone(180, 0.05, "square", 0.04, 80);
  tone(320, 0.07, "square", 0.035, 40, 0.07);
  tone(520, 0.05, "square", 0.025, 0, 0.14);
}

export function sfxEmpty() {
  tone(70, 0.06, "square", 0.03);
}

export function sfxMelee() {
  tone(160, 0.1, "sawtooth", 0.05, -90);
  tone(70, 0.14, "square", 0.035, -30);
}

export function sfxSwap() {
  tone(300, 0.06, "square", 0.03, 120);
}

export function sfxBuy() {
  tone(400, 0.06, "square", 0.04);
  tone(600, 0.08, "square", 0.035, 0, 0.06);
  tone(900, 0.1, "square", 0.03, 0, 0.12);
}

let musicTimer = 0;
const NOTES = [196, 220, 247, 262, 294, 330, 392];

export function tickMusic(t, step = 0.18) {
  if (muted) return;
  if (t < musicTimer) return;
  musicTimer = t + step;
  const i = Math.floor(t * (2.2 + (0.18 - step) * 12)) % NOTES.length;
  const bass = Math.floor(t * 0.55) % 4 === 0;
  tone(NOTES[i] / (bass ? 2 : 1), bass ? 0.16 : 0.09, bass ? "triangle" : "square", bass ? 0.022 : 0.01);
}

export function unlockAudio() {
  ac();
}
