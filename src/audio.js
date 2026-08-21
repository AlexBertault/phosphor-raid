let ctx;
let muted = false;
let master;
let musicGain;
let sfxGain;
let musicEl;
let musicNode;
let musicStarted = false;
let stepT = 0;

function ac() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.32;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);
  }
  return ctx;
}

function out() {
  ac();
  return sfxGain;
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
  o.connect(g).connect(out());
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, gain = 0.04, cutoff = 1200, delay = 0) {
  if (muted) return;
  const audio = ac();
  const t0 = audio.currentTime + delay;
  const n = Math.max(1, (audio.sampleRate * dur) | 0);
  const buf = audio.createBuffer(1, n, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buf;
  const f = audio.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(cutoff, t0);
  f.Q.value = 0.7;
  const g = audio.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out());
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export function sfxShoot(machine = false) {
  if (machine) {
    noise(0.03, 0.045, 1800);
    tone(280, 0.04, "square", 0.04, -180);
    tone(90, 0.05, "sawtooth", 0.02, -40);
  } else {
    noise(0.035, 0.05, 2400);
    tone(980, 0.045, "square", 0.05, -560);
    tone(210, 0.09, "triangle", 0.032, -100);
    tone(130, 0.06, "square", 0.02, -50);
  }
}

export function sfxHit() {
  noise(0.05, 0.04, 900);
  tone(210, 0.05, "square", 0.04, -90);
  tone(90, 0.09, "sawtooth", 0.03, -40);
}

export function sfxDie() {
  noise(0.12, 0.05, 400);
  tone(180, 0.08, "square", 0.06, -100);
  tone(92, 0.16, "triangle", 0.055, -55);
  tone(48, 0.24, "sine", 0.05, -18);
  tone(36, 0.12, "square", 0.03, 0, 0.08);
}

export function sfxDash() {
  noise(0.08, 0.035, 600);
  tone(240, 0.1, "square", 0.03, 220);
}

export function sfxHurt() {
  noise(0.16, 0.07, 350);
  tone(78, 0.2, "sawtooth", 0.06, -50);
  tone(42, 0.14, "square", 0.04, -20);
  tone(160, 0.06, "square", 0.03, -80);
}

export function sfxStep() {
  noise(0.04, 0.028, 420);
  tone(70 + Math.random() * 18, 0.045, "triangle", 0.018, -25);
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
  noise(0.07, 0.04, 280);
  tone(110, 0.07, "square", 0.04, -40);
}

export function sfxReload() {
  noise(0.05, 0.03, 800);
  tone(150, 0.07, "square", 0.045, 30);
  tone(90, 0.09, "triangle", 0.03, 0, 0.05);
}

export function sfxReloadDone() {
  noise(0.04, 0.025, 1400);
  tone(180, 0.05, "square", 0.04, 80);
  tone(320, 0.07, "square", 0.035, 40, 0.07);
  tone(520, 0.05, "square", 0.025, 0, 0.14);
}

export function sfxEmpty() {
  noise(0.04, 0.02, 200);
  tone(70, 0.06, "square", 0.03);
}

export function sfxMelee() {
  noise(0.1, 0.05, 700);
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

export function tickSteps(moving, dt, rushing) {
  if (!moving) {
    stepT = 0.04;
    return;
  }
  stepT -= dt;
  if (stepT > 0) return;
  stepT = rushing ? 0.13 : 0.21;
  sfxStep();
}

export function startMusic() {
  if (muted) return;
  const audio = ac();
  if (musicStarted && musicEl) {
    musicEl.play().catch(() => {});
    return;
  }
  musicStarted = true;
  musicEl = new Audio("/music/raid.ogg");
  musicEl.loop = true;
  musicEl.preload = "auto";
  try {
    musicNode = audio.createMediaElementSource(musicEl);
    musicNode.connect(musicGain);
  } catch {
    musicEl.volume = 0.32;
  }
  musicEl.play().catch(() => {});
}

export function stopBeeps() {}

export function tickMusic() {
  startMusic();
}

export function unlockAudio() {
  ac();
  startMusic();
}
