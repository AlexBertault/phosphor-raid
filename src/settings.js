import { setMuted } from "./audio.js";

const KEY = "phosphor-settings";

let current = { mute: false, scanlines: true, shake: true };

export function getSettings() {
  return current;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...current, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  applySettings();
  return current;
}

export function setSetting(key, value) {
  current = { ...current, [key]: !!value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  applySettings();
  return current;
}

export function applySettings() {
  const scan = document.querySelector("#scanlines");
  if (scan) scan.classList.toggle("off", !current.scanlines);
  const vig = document.querySelector("#vignette");
  if (vig) vig.classList.toggle("off", !current.scanlines);
  setMuted(current.mute);
}
