import "./style.css";
import { createGame } from "./game.js";
import { unlockAudio } from "./audio.js";

const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const panel = overlay.querySelector(".panel");
const startBtn = document.querySelector("#start");
const hud = document.querySelector("#hud");

const ui = {
  hp: document.querySelector("#hp"),
  floor: document.querySelector("#floor"),
  kills: document.querySelector("#kills"),
  seed: document.querySelector("#seed"),
  best: document.querySelector("#best"),
  toast: document.querySelector("#toast"),
  weapon: document.querySelector("#weapon"),
  ammo: document.querySelector("#ammo"),
  coins: document.querySelector("#coins"),
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
  showOver(kills, floor, best, isBest) {
    panel.classList.add("over");
    panel.querySelector(".eyebrow").textContent = isBest ? "NEW BEST DEPTH" : "SIGNAL LOST";
    panel.querySelector("h1").innerHTML = "DEPTH<br />" + floor;
    panel.querySelector(".blurb").textContent =
      kills + " kills · best " + best + ". The crypt reshuffles. Push further.";
    startBtn.textContent = "GO DEEPER";
    overlay.classList.remove("hidden");
  },
};

const game = createGame(canvas, ui);

startBtn.addEventListener("click", () => {
  unlockAudio();
  panel.classList.remove("over");
  panel.querySelector(".eyebrow").textContent = "32-BIT DUNGEON PROTOCOL";
  panel.querySelector("h1").innerHTML = "PHOSPHOR<br />RAID";
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  panel.querySelector(".blurb").textContent =
    "Every raid is a depth run. Early floors are tiny and fast. Then the crypt grows.";
  game.start();
});
