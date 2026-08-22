import "./style.css";
import { createGame } from "./game.js";
import { unlockAudio } from "./audio.js";
import { loadSettings, getSettings, setSetting } from "./settings.js";

const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const titleView = document.querySelector("#title-view");
const settingsView = document.querySelector("#settings-view");
const overView = document.querySelector("#over-view");
const brief = document.querySelector("#brief");
const startBtn = document.querySelector("#start");
const hud = document.querySelector("#hud");

loadSettings();

function showOverlay(which) {
  overlay.classList.remove("hidden");
  titleView.classList.toggle("hidden", which !== "title");
  settingsView.classList.toggle("hidden", which !== "settings");
  overView.classList.toggle("hidden", which !== "over");
}

function syncSettingChecks() {
  const s = getSettings();
  const mute = document.querySelector("#set-mute");
  const scan = document.querySelector("#set-scan");
  const shake = document.querySelector("#set-shake");
  if (mute) mute.checked = s.mute;
  if (scan) scan.checked = s.scanlines;
  if (shake) shake.checked = s.shake;
}

const ui = {
  hp: document.querySelector("#hp"),
  air: document.querySelector("#air"),
  floor: document.querySelector("#floor"),
  kills: document.querySelector("#kills"),
  seed: document.querySelector("#seed"),
  best: document.querySelector("#best"),
  toast: document.querySelector("#toast"),
  weapon: document.querySelector("#weapon"),
  ammo: document.querySelector("#ammo"),
  coins: document.querySelector("#coins"),
  devBadge: document.querySelector("#dev-badge"),
  shop: document.querySelector("#shop"),
  shopList: document.querySelector("#shop-list"),
  shopCoins: document.querySelector("#shop-coins"),
  shopEyebrow: document.querySelector("#shop-eyebrow"),
  shopBlurb: document.querySelector("#shop-blurb"),
  descend: document.querySelector("#descend"),
  blood: document.querySelector("#blood"),
  emptyCue: document.querySelector("#empty-cue"),
  loadout: document.querySelector("#loadout"),
  hideOverlay() {
    overlay.classList.add("hidden");
    hud.classList.remove("hidden");
  },
  showTitle() {
    hud.classList.add("hidden");
    if (brief) brief.classList.add("hidden");
    showOverlay("title");
  },
  showBrief(world, name, blurb) {
    if (!brief) return;
    const w = document.querySelector("#brief-world");
    const n = document.querySelector("#brief-name");
    const b = document.querySelector("#brief-blurb");
    if (w) w.textContent = "WORLD " + world;
    if (n) n.textContent = name;
    if (b) b.textContent = blurb;
    brief.classList.remove("hidden");
  },
  hideBrief() {
    if (brief) brief.classList.add("hidden");
  },
  showOver(kills, floor, best, isBest) {
    const eye = document.querySelector("#over-eyebrow");
    const title = document.querySelector("#over-title");
    const blurb = document.querySelector("#over-blurb");
    if (eye) eye.textContent = isBest ? "NEW BEST DEPTH" : "SIGNAL LOST";
    if (title) title.innerHTML = "DEPTH<br />" + floor;
    if (blurb) blurb.textContent = kills + " kills · best " + best + ". The crypt reshuffles.";
    hud.classList.add("hidden");
    showOverlay("over");
  },
};

const game = createGame(canvas, ui);
const params = new URLSearchParams(location.search);

document.querySelector("#settings-btn")?.addEventListener("click", () => {
  syncSettingChecks();
  showOverlay("settings");
});
document.querySelector("#settings-back")?.addEventListener("click", () => showOverlay("title"));
document.querySelector("#set-mute")?.addEventListener("change", (e) => setSetting("mute", e.target.checked));
document.querySelector("#set-scan")?.addEventListener("change", (e) => setSetting("scanlines", e.target.checked));
document.querySelector("#set-shake")?.addEventListener("change", (e) => setSetting("shake", e.target.checked));

startBtn.addEventListener("click", () => {
  unlockAudio();
  ui.hideOverlay();
  game.start();
});

document.querySelector("#again")?.addEventListener("click", () => {
  unlockAudio();
  ui.hideOverlay();
  game.start();
});

document.querySelector("#to-title")?.addEventListener("click", () => {
  ui.showTitle();
});

document.querySelector("#brief-go")?.addEventListener("click", () => game.closeBrief());

if (params.has("dev") || params.has("depth")) {
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  game.start();
}
