import { createRng, hashSeed } from "./rng.js";
import { C, biomeOf, biomeName, themeOf, pickPalette, bossTier, bossTitle } from "./palette.js";
import { creatureSprite, playerSprite, tileSheet } from "./sprites.js";
import {
  T,
  TILE,
  generateDungeon,
  tileAt,
  moveCircle,
  circleHitsSolid,
  breakCrate,
} from "./map.js";
import { bindInput, axis, keys } from "./input.js";
import * as sfx from "./audio.js";

const VIEW_W = 320;
const VIEW_H = 180;
const MELEE_REACH = 32;
const SPIN_LIFE = 0.4;
const BEST_KEY = "phosphor-best";
const MAX_AIR = 7;
const FOG_R = 56;
const FOG_R2 = FOG_R * FOG_R;
const DEV_JUMPS = [
  ["Digit1", "1", 1],
  ["Digit2", "2", 4],
  ["Digit3", "3", 7],
  ["Digit4", "4", 10],
  ["Digit5", "5", 13],
  ["Digit6", "6", 16],
  ["Digit7", "7", 19],
];
const SHOP = [
  { id: "dual", name: "DUAL WIELD", desc: "two barrels", cost: 22, once: true },
  { id: "mg", name: "MACHINE GUN", desc: "18 rnd spray", cost: 40, once: true },
  { id: "reload", name: "SPEEDLOADER", desc: "faster reload", cost: 16, once: true },
  { id: "heart", name: "HEART", desc: "+1 max HP", cost: 14, once: false, max: 4 },
  { id: "boots", name: "DASH BOOTS", desc: "faster move + dash", cost: 18, once: true },
  { id: "swipe", name: "WIDE SWIPE", desc: "longer harder Q", cost: 20, once: true },
  { id: "vest", name: "PLATE VEST", desc: "-1 hit damage", cost: 26, once: true },
  { id: "lucky", name: "LUCK CHARM", desc: "+50% coins", cost: 16, once: true },
];

const BODIES = ["orb", "skitter", "grub", "tank", "drone"];
const AIS = ["chase", "strafe", "orbit", "ambush"];

function rayHit(px, py, ox, oy, ang) {
  const cx = Math.cos(ang);
  const cy = Math.sin(ang);
  const along = (px - ox) * cx + (py - oy) * cy;
  const qx = ox + cx * along;
  const qy = oy + cy * along;
  return { along, dist: Math.hypot(px - qx, py - qy) };
}

function beamReach(map, x, y, ang, maxLen = 240) {
  const cx = Math.cos(ang);
  const cy = Math.sin(ang);
  for (let d = 8; d < maxLen; d += 2) {
    const kind = tileAt(map, x + cx * d, y + cy * d);
    if (kind === T.WALL || kind === T.VOID || kind === T.CRATE) return d;
  }
  return maxLen;
}

function tune(floor) {
  const t = Math.max(0, floor - 1);
  const biome = biomeOf(floor);
  const tiny = floor === 1;
  return {
    biome,
    cols: tiny ? 20 : Math.min(64, 22 + t * 4),
    rows: tiny ? 14 : Math.min(48, 16 + t * 3),
    splits: tiny ? 2 : Math.min(26, 3 + t * 3),
    loops: tiny ? 1 : Math.min(7, 1 + (t >> 1)),
    crateMax: tiny ? 1 : Math.min(4, t < 2 ? 0 : 1 + ((t / 3) | 0)),
    gooChance: biome === "slime" ? 0.55 : biome === "lava" ? 0.08 : biome === "grass" ? 0.18 : Math.min(0.45, t < 2 ? 0.04 : 0.12 + t * 0.03),
    lavaChance: biome === "lava" ? 0.85 : 0,
    skipChance: biome === "grass" ? 0.15 : Math.max(0, 0.4 - t * 0.07),
    maxPerRoom: biome === "grass" ? 1 : Math.min(5, 1 + ((t / 2) | 0)),
    bodies: t < 2 ? ["orb", "grub", "drone"] : t < 4 ? ["orb", "grub", "skitter", "drone"] : BODIES,
    ais: t < 3 ? ["orbit", "strafe"] : AIS,
    shootChance: biome === "grass" ? 0.45 : Math.min(0.95, 0.65 + t * 0.06),
    aggro: Math.min(160, 80 + t * 8),
    shootRange: Math.min(170, 110 + t * 6),
    bulletSpeed: Math.min(52, 28 + t * 2.2),
    playerSpeed: 124,
    dashSpeed: 210,
    fireRate: 0.1,
    meleeCd: 0.42,
    reload: 2,
    mag: 3,
    musicStep: Math.max(0.085, 0.2 - t * 0.012),
  };
}

function genome(rng, p) {
  const t = Math.max(0, (p.floor ?? 1) - 1);
  if (p.biome === "lava" && rng.chance(0.42)) {
    const sizePx = rng.int(20, 26);
    return {
      body: "shock",
      palette: pickPalette(rng, "lava"),
      eyes: 1,
      spikes: 8,
      snout: false,
      limbs: 6,
      coreR: sizePx * 0.28,
      sizePx,
      ai: "orbit",
      weapon: "shock",
      hp: Math.max(2, 2 + ((t / 4) | 0)),
      speed: 14 + t * 0.45,
      damage: 1,
    };
  }
  if (p.biome === "slime" && rng.chance(0.4)) {
    const sizePx = rng.int(16, 22);
    return {
      body: "orb",
      palette: pickPalette(rng, "slime"),
      eyes: 1,
      spikes: 0,
      snout: false,
      limbs: 4,
      coreR: sizePx * 0.28,
      sizePx,
      ai: "orbit",
      weapon: "bite",
      hp: Math.max(2, 2 + ((t / 5) | 0)),
      speed: 12 + t * 0.3,
      damage: 1,
    };
  }
  if (p.biome === "gem" && rng.chance(0.4)) {
    const sizePx = rng.int(16, 20);
    return {
      body: "laser",
      palette: pickPalette(rng, "gem"),
      eyes: 1,
      spikes: 0,
      snout: true,
      limbs: 2,
      coreR: sizePx * 0.24,
      sizePx,
      ai: "ambush",
      weapon: "laser",
      hp: Math.max(2, 2 + ((t / 5) | 0)),
      speed: 8,
      damage: 3,
    };
  }
  if (p.biome === "ocean" && rng.chance(0.38)) {
    const sizePx = rng.int(16, 22);
    return {
      body: "grub",
      palette: pickPalette(rng, "ocean"),
      eyes: 1,
      spikes: 0,
      snout: true,
      limbs: 2,
      coreR: sizePx * 0.24,
      sizePx,
      ai: "strafe",
      weapon: "spread",
      hp: Math.max(2, 2 + ((t / 5) | 0)),
      speed: 16,
      damage: 1,
    };
  }
  if (p.biome === "dark" && rng.chance(0.35)) {
    const sizePx = rng.int(16, 20);
    return {
      body: "drone",
      palette: pickPalette(rng, "dark"),
      eyes: 1,
      spikes: 4,
      snout: false,
      limbs: 2,
      coreR: sizePx * 0.22,
      sizePx,
      ai: "ambush",
      weapon: "spit",
      hp: 3,
      speed: 20,
      damage: 2,
    };
  }
  const body = rng.pick(p.bodies);
  const sizePx = body === "tank" ? rng.int(18, 24) : body === "drone" ? rng.int(12, 16) : rng.int(14, 18);
  const shooty = rng.chance(p.shootChance);
  return {
    body,
    palette: pickPalette(rng, p.biome),
    eyes: rng.int(1, body === "orb" ? 3 : 2),
    spikes: rng.chance(0.2 + t * 0.05) ? rng.int(3, 8) : 0,
    snout: rng.chance(0.45),
    limbs: rng.int(2, 6),
    coreR: sizePx * (body === "tank" ? 0.28 : 0.22),
    sizePx,
    ai: rng.pick(p.ais),
    weapon: shooty ? rng.pick(["spit", "spit", "spread"]) : "bite",
    hp: Math.max(1, (body === "tank" ? 2 : 1) + ((t / 2) | 0)),
    speed: (body === "drone" ? 28 : body === "tank" ? 16 : 22) * (1 + t * 0.04),
    damage: t >= 5 && body === "tank" ? 2 : 1,
  };
}

function bossGenome(rng, p) {
  const tier = Math.max(1, bossTier(p.floor ?? 3));
  const sizePx = Math.min(56, 32 + tier * 4);
  const base = {
    boss: true,
    sizePx,
    coreR: sizePx * 0.36,
    eyes: Math.min(5, 2 + (tier >> 1)),
    snout: true,
    limbs: 6,
    hp: 6 + tier * 5,
    speed: 12 + tier * 1.1,
    damage: Math.min(3, 1 + (tier >= 3 ? 1 : 0)),
    spikes: 6,
  };
  const b = p.biome;
  if (b === "grass") {
    return { ...base, body: "tank", palette: pickPalette(rng, "grass"), weapon: "spread", ai: "chase", spikes: 10, hp: 7 };
  }
  if (b === "cave") {
    return { ...base, body: "brute", palette: pickPalette(rng, "cave"), weapon: "spit", ai: "chase", hp: 10 };
  }
  if (b === "lava") {
    return { ...base, body: "shock", palette: pickPalette(rng, "lava"), weapon: "shock", ai: "orbit", spikes: 10, hp: 13 };
  }
  if (b === "slime") {
    return { ...base, body: "orb", palette: pickPalette(rng, "slime"), weapon: "shock", ai: "orbit", split: 2, hp: 14, spikes: 0 };
  }
  if (b === "ocean") {
    return { ...base, body: "grub", palette: pickPalette(rng, "ocean"), weapon: "spread", ai: "ambush", hp: 16, speed: 18 };
  }
  if (b === "dark") {
    return { ...base, body: "brute", palette: pickPalette(rng, "dark"), weapon: "flame", ai: "chase", flameR: 7, flameN: 3, flameSpeed: 22, hp: 16, damage: 2 };
  }
  return { ...base, body: "laser", palette: pickPalette(rng, "gem"), weapon: "laser", ai: "ambush", hp: 18 + Math.max(0, tier - 7) * 4, damage: 3 };
}

function makeEnemy(rng, x, y, p, boss = false) {
  const g = boss ? bossGenome(rng, p) : genome(rng, p);
  return {
    x,
    y,
    r: g.sizePx * (g.boss ? 0.36 : 0.32),
    hp: g.hp,
    maxHp: g.hp,
    gene: g,
    frames: [creatureSprite(rng, g, 0), creatureSprite(rng, g, 1)],
    t: rng.float(0, 10),
    shootT: boss ? rng.float(0.8, 1.4) : rng.float(0.6, 1.8),
    alive: true,
    flash: 0,
    aggro: !!boss,
    shockPhase: "idle",
    windT: 0,
    boomT: 0,
    laserPhase: "idle",
    laserT: 0,
    beamAng: 0,
    laserHit: false,
  };
}

function spawnFloor(seed, floor) {
  const p = tune(floor);
  p.floor = floor;
  const theme = themeOf(floor);
  p.theme = theme;
  const rng = createRng(hashSeed(seed + floor * 997));
  const map = generateDungeon(rng.int(1, 1e9), p);
  const tiles = tileSheet(createRng(seed + 17 + floor * 13), theme);
  const enemies = [];
  const tier = bossTier(floor);
  let bossRoom = null;
  if (tier > 0) {
    let area = 0;
    for (const room of map.rooms) {
      if (room === map.rooms[0]) continue;
      const a = room.w * room.h;
      if (a > area) {
        area = a;
        bossRoom = room;
      }
    }
  }
  for (const room of map.rooms) {
    if (room === map.rooms[0]) continue;
    if (room === bossRoom) {
      const x = (room.cx + 0.5) * TILE;
      const y = (room.cy + 0.5) * TILE;
      if (!circleHitsSolid(map, x, y, 10)) enemies.push(makeEnemy(rng, x, y, p, true));
      const adds = Math.max(0, tier - 1);
      for (let i = 0; i < adds; i++) {
        const ax = (rng.float(room.x + 1.4, room.x + room.w - 1.4) + 0.5) * TILE;
        const ay = (rng.float(room.y + 1.4, room.y + room.h - 1.4) + 0.5) * TILE;
        if (circleHitsSolid(map, ax, ay, 6)) continue;
        if (tileAt(map, ax, ay) === T.LAVA) continue;
        enemies.push(makeEnemy(rng, ax, ay, p));
      }
      continue;
    }
    if (rng.chance(p.skipChance)) continue;
    const n = rng.int(1, p.maxPerRoom);
    for (let i = 0; i < n; i++) {
      const x = (rng.float(room.x + 1.2, room.x + room.w - 1.2) + 0.5) * TILE;
      const y = (rng.float(room.y + 1.2, room.y + room.h - 1.2) + 0.5) * TILE;
      if (circleHitsSolid(map, x, y, 6)) continue;
      if (tileAt(map, x, y) === T.LAVA) continue;
      enemies.push(makeEnemy(rng, x, y, p));
    }
  }
  return { rng, map, tiles, enemies, p, theme, biome: p.biome, seen: p.biome === "dark" ? new Uint8Array(map.cols * map.rows) : null };
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0);
  } catch {
    return 0;
  }
}

function writeBest(floor) {
  const best = Math.max(floor, readBest());
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    /* ignore */
  }
  return best;
}

export function createGame(canvas, ui) {
  bindInput();
  const buf = document.createElement("canvas");
  buf.width = VIEW_W;
  buf.height = VIEW_H;
  const bctx = buf.getContext("2d");
  const dctx = canvas.getContext("2d");
  bctx.imageSmoothingEnabled = false;
  dctx.imageSmoothingEnabled = false;

  const playerFrames = [playerSprite(0), playerSprite(1)];
  const boot = new URLSearchParams(location.search);
  let dev = boot.has("dev") || boot.has("depth");
  let scale = 1;
  let seed = (Math.random() * 1e9) | 0;
  let floor = 1;
  let kills = 0;
  let world = spawnFloor(seed, floor);
  let player;
  let bullets;
  let eBullets;
  let particles;
  let cam = { x: 0, y: 0 };
  let shake = 0;
  let over = false;
  let wonFloor = false;
  let shopping = false;
  let toastT = 0;
  let fireT = 0;
  let dashT = 0;
  let dashCd = 0;
  let invuln = 0;
  let mag = 3;
  let reloadT = 0;
  let meleeT = 0;
  let emptyT = 0;
  let lavaT = 0;
  let air = MAX_AIR;
  let drownT = 0;
  let slash = null;
  let coins = 0;
  let kit = { dual: false, mg: false, reload: false, hearts: 0 };
  let time = 0;
  let running = false;
  let last = 0;

  function landOnFloor({ newRun = false } = {}) {
    if (newRun || !player) {
      player = {
        x: world.map.start.x,
        y: world.map.start.y,
        r: 5,
        hp: 6,
        maxHp: 6,
        vx: 0,
        vy: 0,
        kx: 0,
        ky: 0,
        ang: 0,
        moveAng: 0,
      };
      kit = { dual: false, mg: false, reload: false, hearts: 0, boots: false, swipe: false, vest: false, lucky: false };
      coins = 0;
    } else {
      player.x = world.map.start.x;
      player.y = world.map.start.y;
      player.kx = 0;
      player.ky = 0;
      player.hp = Math.min(player.maxHp, player.hp + 1);
    }
    bullets = [];
    eBullets = [];
    particles = [];
    cam.x = player.x - VIEW_W / 2;
    cam.y = player.y - VIEW_H / 2;
    clampCam();
    over = false;
    wonFloor = false;
    shopping = false;
    fireT = 0;
    dashT = 0;
    dashCd = 0;
    invuln = 0;
    mag = gunStats().mag;
    reloadT = 0;
    meleeT = 0;
    emptyT = 0;
    lavaT = 0;
    air = MAX_AIR;
    drownT = 0;
    slash = null;
    hideShop();
    const place = biomeName(floor);
    toast(
      newRun
        ? "SURFACE · THE CAVE WAITS"
        : bossTier(floor)
          ? "BOSS · " + bossTitle(floor)
          : "DEPTH " + floor + " · " + place,
    );
    const frameEl = canvas.closest("#frame") || document.querySelector("#frame");
    if (frameEl) frameEl.dataset.biome = world.biome || biomeOf(floor);
    canvas.style.background = (world.theme && world.theme.void) || C.void;
    if (ui.seed) ui.seed.textContent = "SEED " + seed.toString(16).toUpperCase();
    renderDepth();
    renderHp();
    renderAir();
    renderKills();
    renderLoadout();
    renderCoins();
    markFog();
  }

  function gunStats() {
    return {
      mag: kit.mg ? 18 : 3,
      fireRate: kit.mg ? 0.055 : 0.1,
      reload: (kit.mg ? 1.15 : 2) * (kit.reload ? 0.62 : 1),
    };
  }

  function gunName() {
    if (reloadT > 0) return "RELOAD";
    if (mag <= 0) return "EMPTY";
    if (kit.mg && kit.dual) return "DUAL MG";
    if (kit.mg) return "MACHINE GUN";
    if (kit.dual) return "DUAL";
    return "GUN";
  }

  function renderCoins() {
    if (ui.coins) ui.coins.textContent = coins + "c";
    if (ui.shopCoins) ui.shopCoins.textContent = String(coins);
  }

  function renderDepth() {
    if (ui.floor) ui.floor.textContent = "DEPTH " + floor;
    if (ui.best) ui.best.textContent = "BEST " + Math.max(floor, readBest());
  }

  function toast(msg) {
    if (!ui.toast) return;
    ui.toast.textContent = msg;
    toastT = 2.4;
  }

  function renderHp() {
    if (!ui.hp) return;
    ui.hp.innerHTML = "";
    for (let i = 0; i < player.maxHp; i++) {
      const pip = document.createElement("div");
      pip.className = "pip" + (i < player.hp ? "" : " empty");
      ui.hp.appendChild(pip);
    }
  }

  function renderAir() {
    if (!ui.air) return;
    const under = world?.biome === "ocean" && !over && !shopping;
    ui.air.classList.toggle("hidden", !under);
    if (!under) return;
    ui.air.innerHTML = "";
    const filled = Math.ceil((air / MAX_AIR) * MAX_AIR);
    for (let i = 0; i < MAX_AIR; i++) {
      const pip = document.createElement("div");
      pip.className = "pip air" + (i < filled ? "" : " empty") + (air <= 2 ? " low" : "");
      ui.air.appendChild(pip);
    }
  }

  function renderKills() {
    ui.kills.textContent = kills + " KILLS";
  }

  function renderLoadout() {
    if (!ui.weapon || !ui.ammo) return;
    ui.weapon.textContent = gunName();
    ui.weapon.classList.remove("melee");
    const cap = gunStats().mag;
    ui.ammo.innerHTML = "";
    if (cap > 6) {
      ui.ammo.className = "count";
      ui.ammo.textContent = mag + "/" + cap;
      syncVitals();
      return;
    }
    ui.ammo.className = "";
    for (let i = 0; i < cap; i++) {
      const shell = document.createElement("div");
      shell.className = "shell" + (i < mag ? "" : " empty") + (reloadT > 0 ? " reload" : "");
      ui.ammo.appendChild(shell);
    }
    syncVitals();
  }

  function syncVitals() {
    if (!player) return;
    const empty = !over && !shopping && mag <= 0 && reloadT <= 0;
    const hp = player.hp;
    const low = !over && !shopping && hp > 0 && (hp <= 2 || hp / player.maxHp <= 0.34);
    if (ui.loadout) ui.loadout.classList.toggle("dry", empty);
    if (ui.emptyCue) ui.emptyCue.classList.toggle("hidden", !empty);
    if (ui.blood) {
      ui.blood.classList.toggle("low", low && hp > 1);
      ui.blood.classList.toggle("critical", hp === 1 && !over);
    }
  }

  function hideShop() {
    shopping = false;
    if (ui.shop) ui.shop.classList.add("hidden");
  }

  function shopReady() {
    return shopping && !over;
  }

  function owned(id) {
    if (id === "heart") return kit.hearts;
    return !!kit[id];
  }

  function canBuy(item) {
    if (coins < item.cost) return false;
    if (item.once && owned(item.id)) return false;
    if (item.max && owned(item.id) >= item.max) return false;
    return true;
  }

  function applyUpgrade(id) {
    if (id === "dual") kit.dual = true;
    if (id === "mg") kit.mg = true;
    if (id === "reload") kit.reload = true;
    if (id === "boots") kit.boots = true;
    if (id === "swipe") kit.swipe = true;
    if (id === "vest") kit.vest = true;
    if (id === "lucky") kit.lucky = true;
    if (id === "heart") {
      kit.hearts += 1;
      player.maxHp += 1;
      player.hp += 1;
      renderHp();
    }
    mag = gunStats().mag;
    reloadT = 0;
    renderLoadout();
  }

  function buy(id) {
    const item = SHOP.find((s) => s.id === id);
    if (!item || !shopReady() || !canBuy(item)) {
      sfx.sfxEmpty();
      return;
    }
    coins -= item.cost;
    applyUpgrade(id);
    sfx.sfxBuy();
    renderCoins();
    renderShop();
    toast(item.name + " EQUIPPED");
  }

  function renderShop() {
    if (!ui.shop || !ui.shopList) return;
    if (!shopReady() || over) {
      if (ui.shop) ui.shop.classList.add("hidden");
      return;
    }
    if (ui.shopEyebrow) {
      ui.shopEyebrow.textContent = wonFloor ? "DEPTH " + floor + " CLEAR" : "DEPTH " + floor + " SKIP";
    }
    if (ui.shopBlurb) {
      const nxt = biomeName(floor + 1);
      ui.shopBlurb.textContent = wonFloor
        ? bossTier(floor)
          ? bossTitle(floor) + " down. Next: " + nxt + "."
          : "Nice. HP carries. Next is " + nxt + "."
        : "Skipped leftover packs — their coins stay behind. Stock up or press on.";
    }
    ui.shop.classList.remove("hidden");
    renderCoins();
    ui.shopList.innerHTML = "";
    SHOP.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shop-btn";
      const got = item.once && owned(item.id);
      const maxed = item.max && owned(item.id) >= item.max;
      btn.disabled = got || maxed || coins < item.cost;
      btn.innerHTML =
        i + 1 + " " + item.name + "<br /><span class='price'>" +
        (got || maxed ? "OWNED" : item.cost + "c") +
        "</span> " + item.desc;
      btn.addEventListener("click", () => buy(item.id));
      ui.shopList.appendChild(btn);
    });
  }

  function openArmory() {
    if (shopping || over) return;
    shopping = true;
    keys.clear();
    sfx.sfxPortal();
    renderShop();
  }

  function leaveShop() {
    if (!shopping) return;
    shopping = false;
    if (ui.shop) ui.shop.classList.add("hidden");
    nextFloor();
  }

  function tickShop() {
    SHOP.forEach((item, i) => {
      const n = String(i + 1);
      if (keys.has("Digit" + n) || keys.has("Numpad" + n) || keys.has(n)) {
        keys.delete("Digit" + n);
        keys.delete("Numpad" + n);
        keys.delete(n);
        buy(item.id);
      }
    });
    if (keys.has("Enter") || keys.has("enter") || keys.has("NumpadEnter") || keys.has("Space")) {
      keys.delete("Enter");
      keys.delete("enter");
      keys.delete("NumpadEnter");
      keys.delete("Space");
      leaveShop();
    }
  }

  function hitEnemy(e, dmg) {
    if (!e || !e.alive) return;
    e.hp -= dmg;
    e.flash = 0.1;
    shake = Math.max(shake, 2);
    sfx.sfxHit();
    burst(e.x, e.y, e.gene.palette[0], 6);
    if (e.hp <= 0) {
      e.alive = false;
      kills += 1;
      renderKills();
      sfx.sfxDie();
      burst(e.x, e.y, e.gene.palette[3], 18);
      burst(e.x, e.y, C.amber, 5);
      addCoins((e.gene.boss ? floor * 3 : floor) + (Math.random() < 0.35 ? floor : 0));
      if (Math.random() < 0.1) spawnPickup(e.x, e.y);
      if (e.gene.split) spawnSlimeKids(e);
    }
  }

  function spawnSlimeKids(e) {
    const n = e.gene.split | 0;
    if (!world) return;
    for (let i = 0; i < n; i++) {
      const ox = i ? 10 : -10;
      const oy = i ? 8 : -8;
      const child = makeEnemy(world.rng, e.x + ox, e.y + oy, world.p, false);
      child.gene = {
        ...child.gene,
        body: "orb",
        palette: e.gene.palette,
        weapon: "bite",
        ai: "orbit",
        boss: false,
        split: 0,
        hp: 2,
        speed: 18,
        damage: 1,
        sizePx: 14,
        coreR: 4,
      };
      child.hp = 2;
      child.maxHp = 2;
      child.r = 5;
      child.aggro = true;
      child.frames = [creatureSprite(world.rng, child.gene, 0), creatureSprite(world.rng, child.gene, 1)];
      world.enemies.push(child);
    }
  }

  function burst(x, y, color, n = 10) {
    if (!particles) return;
    n = Math.min(n, 18);
    if (particles.length > 140) particles.splice(0, particles.length - 100);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 70;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.35,
        color,
        s: 1 + (Math.random() * 2) | 0,
      });
    }
  }

  function hurtPlayer(dmg) {
    if (dev || invuln > 0 || over) return;
    if (kit.vest) dmg = Math.max(1, dmg - 1);
    player.hp -= dmg;
    invuln = 0.72;
    shake = 5;
    sfx.sfxHurt();
    burst(player.x, player.y, C.hp, 12);
    renderHp();
    syncVitals();
    if (player.hp <= 0) {
      player.hp = 0;
      over = true;
      shopping = false;
      hideShop();
      sfx.sfxDie();
      const prev = readBest();
      const best = writeBest(floor);
      ui.showOver(kills, floor, best, floor >= prev);
      syncVitals();
    }
  }

  function addCoins(n) {
    let got = Math.max(1, n | 0);
    if (kit.lucky) got += Math.max(1, (got / 2) | 0);
    coins += got;
    sfx.sfxCoin();
    renderCoins();
  }

  function spawnPickup(x, y) {
    particles.push({
      x,
      y,
      vx: 0,
      vy: -8,
      life: 8,
      color: C.hp,
      s: 3,
      pickup: true,
    });
  }

  function shoot(from, ang, speed, hostile, spread = 0, dmg = 1, extra = {}) {
    const a = ang + spread;
    const list = hostile ? eBullets : bullets;
    const r = extra.r || 2;
    list.push({
      x: from.x + Math.cos(a) * (from.r + 3 + (extra.flame ? 6 : 0)),
      y: from.y + Math.sin(a) * (from.r + 3 + (extra.flame ? 6 : 0)),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: extra.flame ? 6.4 : hostile ? 5.2 : 0.55,
      hostile,
      dmg,
      r,
      flame: !!extra.flame,
    });
  }

  function layout() {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    scale = Math.max(1, Math.floor(Math.min(sw / VIEW_W, sh / VIEW_H)));
    canvas.width = VIEW_W * scale;
    canvas.height = VIEW_H * scale;
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";
    const stage = document.querySelector("#stage");
    if (stage) {
      stage.style.width = canvas.width + "px";
      stage.style.height = canvas.height + "px";
    }
    document.documentElement.style.setProperty("--px", scale + "px");
    dctx.imageSmoothingEnabled = false;
  }

  function nearestEnemy() {
    if (!player || !world?.enemies) return null;
    let best = null;
    let bestDist = 190;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (world.biome === "dark" && !inLamp(e.x, e.y)) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  function swingMelee() {
    meleeT = world.p.meleeCd * (kit.swipe ? 0.62 : 1);
    slash = { life: SPIN_LIFE, max: SPIN_LIFE };
    sfx.sfxMelee();
    burst(player.x, player.y, C.player, 10);
    burst(player.x, player.y, C.amber, 8);
    const reach = kit.swipe ? MELEE_REACH + 10 : MELEE_REACH;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d > reach + e.r) continue;
      hitEnemy(e, kit.swipe ? 3 : 2);
    }
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      if (Math.hypot(b.x - player.x, b.y - player.y) <= reach + (b.r || 4)) {
        burst(b.x, b.y, C.hp, 4);
        eBullets.splice(i, 1);
      }
    }
    const reachTiles = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [ox, oy] of reachTiles) {
      const crate = circleHitsSolid(world.map, player.x + ox * 12, player.y + oy * 12, 5);
      if (crate && crate.kind === T.CRATE && breakCrate(world.map, crate.c, crate.r)) {
        sfx.sfxCrate();
        burst((crate.c + 0.5) * TILE, (crate.r + 0.5) * TILE, C.crateHi, 8);
        if (Math.random() < 0.45) addCoins(Math.max(1, floor));
        if (Math.random() < 0.28) spawnPickup((crate.c + 0.5) * TILE, (crate.r + 0.5) * TILE);
      }
    }
  }

  function update(dt) {
    time += dt;
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) ui.toast.textContent = "";
    }
    tickDev();
    if (over || !player) {
      syncVitals();
      return;
    }
    if (shopping) {
      tickShop();
      syncVitals();
      return;
    }

    const move = axis();
    sfx.tickSteps((move.x !== 0 || move.y !== 0) && dashT <= 0, dt, false);
    if (move.x !== 0 || move.y !== 0) player.moveAng = Math.atan2(move.y, move.x);
    const lock = nearestEnemy();
    player.ang = lock ? Math.atan2(lock.y - player.y, lock.x - player.x) : player.moveAng;

    if ((keys.has("ShiftLeft") || keys.has("ShiftRight")) && dashCd <= 0) {
      dashT = kit.boots ? 0.18 : 0.14;
      dashCd = kit.boots ? 0.26 : 0.38;
      invuln = Math.max(invuln, 0.12);
      sfx.sfxDash();
      burst(player.x, player.y, C.player, 6);
    }
    dashT = Math.max(0, dashT - dt);
    dashCd = Math.max(0, dashCd - dt);
    invuln = Math.max(0, invuln - dt);
    fireT = Math.max(0, fireT - dt);
    meleeT = Math.max(0, meleeT - dt);
    emptyT = Math.max(0, emptyT - dt);
    syncVitals();
    if (slash) {
      slash.life -= dt;
      if (slash.life <= 0) slash = null;
    }
    if (reloadT > 0) {
      reloadT -= dt;
      if (reloadT <= 0) {
        reloadT = 0;
        mag = gunStats().mag;
        sfx.sfxReloadDone();
        renderLoadout();
      }
    }

    const spdMul = kit.boots ? 1.22 : 1;
    const speed = (dashT > 0 ? world.p.dashSpeed : world.p.playerSpeed) * spdMul;
    moveCircle(world.map, player, move.x * speed * dt, move.y * speed * dt);
    if (player.kx || player.ky) {
      moveCircle(world.map, player, player.kx * dt, player.ky * dt);
      player.kx *= Math.exp(-7 * dt);
      player.ky *= Math.exp(-7 * dt);
      if (Math.abs(player.kx) < 4) player.kx = 0;
      if (Math.abs(player.ky) < 4) player.ky = 0;
    }
    const onGoo = tileAt(world.map, player.x, player.y) === T.GOO;
    const onLava = tileAt(world.map, player.x, player.y) === T.LAVA;
    const onBubble = tileAt(world.map, player.x, player.y) === T.BUBBLE;
    if (onGoo && dashT <= 0) {
      const stick = world.biome === "slime" ? 0.62 : 0.25;
      moveCircle(world.map, player, move.x * -speed * stick * dt, move.y * -speed * stick * dt);
    }
    lavaT = Math.max(0, lavaT - dt);
    if (onLava && dashT <= 0) {
      moveCircle(world.map, player, move.x * -speed * 0.35 * dt, move.y * -speed * 0.35 * dt);
      if (lavaT <= 0) {
        lavaT = 0.52;
        hurtPlayer(1);
        sfx.sfxBurn();
        burst(player.x, player.y, C.flame, 10);
        burst(player.x, player.y, C.flameHi, 6);
      }
    }

    if (world.biome === "ocean") {
      if (onBubble) air = Math.min(MAX_AIR, air + dt * 2.6);
      else air = Math.max(0, air - dt);
      drownT = Math.max(0, drownT - dt);
      if (air <= 0 && drownT <= 0) {
        drownT = 0.7;
        hurtPlayer(1);
        burst(player.x, player.y, C.visor, 8);
      }
      if (((time * 8) | 0) !== (((time - dt) * 8) | 0)) renderAir();
    }

    if (keys.has("KeyQ") || keys.has("q") || keys.has("KeyF") || keys.has("f")) {
      keys.delete("KeyQ");
      keys.delete("q");
      keys.delete("KeyF");
      keys.delete("f");
      if (meleeT <= 0) swingMelee();
    }

    if (keys.has("KeyR")) {
      keys.delete("KeyR");
      if (reloadT <= 0 && mag < gunStats().mag) {
        reloadT = gunStats().reload;
        sfx.sfxReload();
        renderLoadout();
        toast("RELOADING");
      } else {
        sfx.sfxEmpty();
      }
    }

    if (keys.has("Space")) {
      if (reloadT > 0) {
        if (emptyT <= 0) {
          emptyT = 0.18;
          sfx.sfxEmpty();
        }
      } else if (fireT <= 0) {
        if (mag <= 0) {
          if (emptyT <= 0) {
            emptyT = 0.18;
            sfx.sfxEmpty();
            toast("RELOAD · R");
          }
        } else {
          const stats = gunStats();
          fireT = stats.fireRate;
          mag -= 1;
          if (kit.dual) {
            shoot(player, player.ang, 280, false, -0.12);
            shoot(player, player.ang, 280, false, 0.12);
          } else {
            shoot(player, player.ang, 280, false);
          }
          sfx.sfxShoot(kit.mg);
          renderLoadout();
        }
      }
    }

    const alive = [];
    for (const e of world.enemies) {
      if (!e.alive) continue;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const g = e.gene;
      if (dist < world.p.aggro && (world.biome !== "dark" || inLamp(e.x, e.y) || dist < 36)) e.aggro = true;
      if (g.weapon === "laser" && dist < 168) e.aggro = true;
      if (g.weapon === "shock" && dist < 96) e.aggro = true;
      if (!e.aggro) {
        alive.push(e);
        continue;
      }
      let mx = dx / dist;
      let my = dy / dist;
      if (g.ai === "strafe") {
        const s = Math.sin(e.t * 3);
        const ox = mx;
        const oy = my;
        mx = ox * 0.7 + -oy * s;
        my = oy * 0.7 + ox * s;
      } else if (g.ai === "orbit") {
        if (dist < 70) {
          mx = -my;
          my = dx / dist;
        }
      } else if (g.ai === "ambush") {
        if (dist > 80 && (e.t | 0) % 3 !== 0) {
          mx *= 0.15;
          my *= 0.15;
        } else {
          mx *= 1.6;
          my *= 1.6;
        }
      }
      const sp = g.speed * (g.body === "skitter" ? 1 + 0.2 * Math.sin(e.t * 8) : 1);
      if (g.weapon === "shock") {
        if (dist < 34) {
          mx = -dx / dist;
          my = -dy / dist;
        }
        if (e.shockPhase === "wind") mx *= 0.15, my *= 0.15;
      } else if (g.weapon === "laser") {
        mx *= 0.2;
        my *= 0.2;
        if (e.laserPhase === "charge" || e.laserPhase === "fire") {
          mx = 0;
          my = 0;
        }
      }
      moveCircle(world.map, e, mx * sp * dt, my * sp * dt);
      if (e.boomT > 0) e.boomT = Math.max(0, e.boomT - dt);

      if (g.weapon === "shock") {
        if (e.shockPhase === "idle") {
          e.shootT -= dt;
          if (e.shootT <= 0 && dist < 72) {
            e.shockPhase = "wind";
            e.windT = 0.58;
            sfx.sfxShockWind();
          }
        } else if (e.shockPhase === "wind") {
          e.windT -= dt;
          if (e.windT <= 0) {
            e.shockPhase = "idle";
            e.shootT = 1.65;
            e.boomT = 0.3;
            sfx.sfxShock();
            shake = Math.max(shake, 7);
            burst(e.x, e.y, C.flameHi, 14);
            if (dist < 54) {
              const k = 240 + (54 - dist) * 5;
              player.kx = (dx / dist) * k;
              player.ky = (dy / dist) * k;
              if (dist < 32) hurtPlayer(g.damage);
            }
          }
        }
      } else if (g.weapon === "laser") {
        if (e.laserPhase === "idle") {
          e.shootT -= dt;
          if (e.shootT <= 0 && dist < 168) {
            e.laserPhase = "charge";
            e.laserT = 0.95;
            e.beamAng = Math.atan2(dy, dx);
            e.laserHit = false;
            sfx.sfxLaserCharge();
          }
        } else if (e.laserPhase === "charge") {
          e.laserT -= dt;
          if (e.laserT <= 0) {
            e.laserPhase = "fire";
            e.laserT = 0.4;
            sfx.sfxLaserFire();
            shake = Math.max(shake, 4);
          }
        } else if (e.laserPhase === "fire") {
          e.laserT -= dt;
          const reach = beamReach(world.map, e.x, e.y, e.beamAng);
          const hit = rayHit(player.x, player.y, e.x, e.y, e.beamAng);
          if (!e.laserHit && hit.along > 8 && hit.along < reach && hit.dist < 7) {
            hurtPlayer(g.damage);
            e.laserHit = true;
            burst(player.x, player.y, "#ff4dff", 12);
          }
          if (e.laserT <= 0) {
            e.laserPhase = "reload";
            e.laserT = 2.2;
          }
        } else if (e.laserPhase === "reload") {
          e.laserT -= dt;
          if (e.laserT <= 0) {
            e.laserPhase = "idle";
            e.shootT = 0.4;
          }
        }
      } else {
        e.shootT -= dt;
        if (g.weapon === "flame" && e.shootT <= 0 && dist < world.p.shootRange + 50) {
          e.shootT = Math.max(1.05, 2.5 - (g.flameN || 1) * 0.12);
          sfx.sfxFlame();
          shake = Math.max(shake, 3);
          const ang = Math.atan2(dy, dx) + (Math.random() * 2 - 1) * 0.12;
          const n = g.flameN || 1;
          const fan = n <= 1 ? 0 : 0.32;
          for (let i = 0; i < n; i++) {
            const off = n <= 1 ? 0 : (i - (n - 1) / 2) * fan;
            shoot(e, ang, g.flameSpeed, true, off, g.damage, { flame: true, r: g.flameR });
          }
        } else if (g.weapon !== "bite" && g.weapon !== "flame" && e.shootT <= 0 && dist < world.p.shootRange) {
          e.shootT = g.weapon === "spread" ? Math.max(1.1, 2.1 - (floor - 1) * 0.08) : Math.max(0.9, 1.7 - (floor - 1) * 0.07);
          const miss = Math.min(1, Math.max(0, (dist - 28) / 120));
          const drift = (Math.random() * 2 - 1) * (0.08 + miss * 1.05);
          const ang = Math.atan2(dy, dx) + drift;
          const spd = world.p.bulletSpeed;
          if (g.weapon === "spread") {
            shoot(e, ang, spd, true, -0.22, g.damage);
            shoot(e, ang, spd, true, 0, g.damage);
            shoot(e, ang, spd, true, 0.22, g.damage);
          } else {
            shoot(e, ang, spd, true, 0, g.damage);
          }
        }
      }

      if (dist < player.r + e.r - 1) {
        hurtPlayer(g.damage);
        moveCircle(world.map, e, -mx * 40 * dt, -my * 40 * dt);
        moveCircle(world.map, player, -mx * 18 * dt, -my * 18 * dt);
      }
      alive.push(e);
    }
    world.enemies = alive;

    stepBullets(bullets, dt, false);
    stepBullets(eBullets, dt, true);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      if (p.pickup && Math.hypot(p.x - player.x, p.y - player.y) < 10) {
        if (player.hp < player.maxHp) {
          player.hp += 1;
          renderHp();
        }
        sfx.sfxPickup();
        particles.splice(i, 1);
        continue;
      }
      if (p.life <= 0) particles.splice(i, 1);
    }

    const gateDist = Math.hypot(player.x - world.map.portal.x, player.y - world.map.portal.y);

    if (world.enemies.length === 0 && !wonFloor) {
      wonFloor = true;
      toast("CLEARED · GATE OPEN");
    }

    if (gateDist < 12) {
      openArmory();
      return;
    }

    const tx = player.x - VIEW_W / 2;
    const ty = player.y - VIEW_H / 2;
    cam.x += (tx - cam.x) * Math.min(1, dt * 12);
    cam.y += (ty - cam.y) * Math.min(1, dt * 12);
    clampCam();
    shake = Math.max(0, shake - dt * 18);
  }

  function clampCam() {
    if (!world) return;
    const maxX = Math.max(0, world.map.cols * TILE - VIEW_W);
    const maxY = Math.max(0, world.map.rows * TILE - VIEW_H);
    cam.x = Math.max(0, Math.min(maxX, cam.x));
    cam.y = Math.max(0, Math.min(maxY, cam.y));
  }

  function stepBullets(list, dt, hostile) {
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const hit = circleHitsSolid(world.map, b.x, b.y, b.r || 1.5);
      if (hit) {
        if (hit.kind === T.CRATE && breakCrate(world.map, hit.c, hit.r)) {
          sfx.sfxCrate();
          burst(b.x, b.y, C.crateHi, 8);
          if (Math.random() < 0.45) addCoins(Math.max(1, floor));
          if (Math.random() < 0.28) spawnPickup((hit.c + 0.5) * TILE, (hit.r + 0.5) * TILE);
        }
        if (b.flame) burst(b.x, b.y, C.flame, 8);
        list.splice(i, 1);
        continue;
      }
      if (b.flame && particles.length < 140 && Math.random() < 0.45) {
        particles.push({
          x: b.x + (Math.random() - 0.5) * 6,
          y: b.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12,
          life: 0.18,
          color: Math.random() < 0.5 ? C.flame : C.flameHi,
          s: 2 + (Math.random() * 2) | 0,
        });
      }
      if (b.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      if (hostile) {
        if (Math.hypot(b.x - player.x, b.y - player.y) < player.r + (b.r || 3)) {
          hurtPlayer(b.dmg);
          if (b.flame) burst(b.x, b.y, C.flameHi, 10);
          list.splice(i, 1);
        }
      } else {
        for (const e of world.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 2) {
            hitEnemy(e, 1);
            list.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  function nextFloor() {
    writeBest(floor);
    floor += 1;
    world = spawnFloor(seed, floor);
    landOnFloor({ newRun: false });
  }

  function restart() {
    seed = (Math.random() * 1e9) | 0;
    floor = 1;
    kills = 0;
    world = spawnFloor(seed, floor);
    landOnFloor({ newRun: true });
    ui.hideOverlay();
    over = false;
  }

  function drawShockRing(e, ox, oy) {
    const cx = e.x - ox;
    const cy = e.y - oy;
    let rad = 0;
    let col = C.flameHi;
    if (e.shockPhase === "wind") {
      const t = 1 - e.windT / 0.58;
      rad = 8 + t * 36;
      col = t > 0.7 ? C.flame : C.amber;
    } else if (e.boomT > 0) {
      const t = 1 - e.boomT / 0.3;
      rad = 18 + t * 36;
      col = t < 0.4 ? "#fff3e0" : C.flame;
    } else {
      return;
    }
    const n = Math.max(16, (rad * 5) | 0);
    bctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      bctx.fillRect((cx + Math.cos(a) * rad) | 0, (cy + Math.sin(a) * rad) | 0, 2, 2);
    }
  }

  function drawLaserBeam(e, ox, oy) {
    const charging = e.laserPhase === "charge";
    const firing = e.laserPhase === "fire";
    if (!charging && !firing) return;
    const reach = beamReach(world.map, e.x, e.y, e.beamAng);
    const ca = Math.cos(e.beamAng);
    const sa = Math.sin(e.beamAng);
    const x0 = e.x - ox;
    const y0 = e.y - oy;
    const step = firing ? 1 : 2;
    for (let d = 6; d < reach; d += step) {
      const x = (x0 + ca * d) | 0;
      const y = (y0 + sa * d) | 0;
      if (firing) {
        bctx.fillStyle = "#6a1060";
        bctx.fillRect(x - 2, y - 2, 6, 6);
        bctx.fillStyle = "#ff4dff";
        bctx.fillRect(x - 1, y - 1, 4, 4);
        if (d % 3 === 0) {
          bctx.fillStyle = "#ffffff";
          bctx.fillRect(x, y, 2, 2);
        }
      } else {
        const pulse = ((time * 12) | 0) % 2 === 0;
        bctx.fillStyle = pulse ? "#ecd4ff" : "#c77dff";
        bctx.fillRect(x, y, 1, 1);
      }
    }
    if (charging) {
      const t = 1 - e.laserT / 0.95;
      bctx.fillStyle = "#ff4dff";
      bctx.fillRect((x0 - 2) | 0, (y0 - 2) | 0, 5, 5);
      bctx.fillStyle = t > 0.6 ? "#ffffff" : "#ecd4ff";
      bctx.fillRect((x0 - 1) | 0, (y0 - 1) | 0, 3, 3);
    }
  }

  function drawSpinjitzu(ox, oy) {
    const t = 1 - slash.life / (slash.max || SPIN_LIFE);
    const spin = t * Math.PI * 8;
    const px = (player.x - ox) | 0;
    const py = (player.y - oy) | 0;
    const cols = [C.player, C.player2, C.amber, "#ffffff", C.portal];
    for (let i = 0; i < 52; i++) {
      const u = i / 52;
      const a = spin + u * Math.PI * 5;
      const d = 3 + u * 18;
      bctx.fillStyle = cols[i % cols.length];
      bctx.fillRect((px + Math.cos(a) * d) | 0, (py + Math.sin(a) * d * 0.72) | 0, 2, 2);
    }
    for (let i = 0; i < 18; i++) {
      const a = spin * 1.15 + (i / 18) * Math.PI * 2;
      const d = 7 + (i % 3);
      bctx.fillStyle = i % 2 ? C.player : C.amber;
      bctx.fillRect((px + Math.cos(a) * d) | 0, (py + Math.sin(a) * d * 0.7) | 0, 2, 2);
    }
    const blade = spin * 1.35;
    const oxn = Math.cos(blade);
    const oyn = Math.sin(blade);
    const pxn = Math.cos(blade + Math.PI / 2);
    const pyn = Math.sin(blade + Math.PI / 2);
    for (let d = 5; d <= 22; d++) {
      const x = (px + oxn * d) | 0;
      const y = (py + oyn * d) | 0;
      bctx.fillStyle = d < 8 ? "#6a4a28" : C.steel;
      bctx.fillRect(x, y, 2, 2);
      bctx.fillStyle = d < 8 ? C.amber : C.steelHi;
      bctx.fillRect((px + oxn * d + pxn) | 0, (py + oyn * d + pyn) | 0, 1, 1);
    }
    bctx.fillStyle = C.amber;
    bctx.fillRect((px + oxn * 6) | 0, (py + oyn * 6) | 0, 3, 3);
    bctx.fillStyle = C.player2;
    bctx.fillRect(px - 1, py - 1, 3, 3);
  }

  function inLamp(x, y) {
    if (!player || world?.biome !== "dark") return true;
    const dx = x - player.x;
    const dy = y - player.y;
    return dx * dx + dy * dy <= FOG_R2;
  }

  function markFog() {
    if (!player || world?.biome !== "dark" || !world.seen) return;
    const cols = world.map.cols;
    const c0 = Math.max(0, Math.floor((player.x - FOG_R) / TILE));
    const r0 = Math.max(0, Math.floor((player.y - FOG_R) / TILE));
    const c1 = Math.min(world.map.cols - 1, Math.ceil((player.x + FOG_R) / TILE));
    const r1 = Math.min(world.map.rows - 1, Math.ceil((player.y + FOG_R) / TILE));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * TILE - player.x;
        const dy = (r + 0.5) * TILE - player.y;
        if (dx * dx + dy * dy <= FOG_R2) world.seen[r * cols + c] = 1;
      }
    }
  }

  function tileVar(set, c, r) {
    if (Array.isArray(set)) return set[(c * 3 + r * 7) & (set.length - 1)];
    return set;
  }

  function draw() {
    if (!player || !world) return;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    const ox = cam.x + sx;
    const oy = cam.y + sy;
    const theme = world.theme || C;
    bctx.fillStyle = theme.void || C.void;
    bctx.fillRect(0, 0, VIEW_W, VIEW_H);
    markFog();
    if (world.tiles.wild) {
      const gx0 = Math.floor(ox / TILE) - 1;
      const gy0 = Math.floor(oy / TILE) - 1;
      const gx1 = gx0 + ((VIEW_W / TILE) | 0) + 3;
      const gy1 = gy0 + ((VIEW_H / TILE) | 0) + 3;
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          if (gx >= 0 && gy >= 0 && gx < world.map.cols && gy < world.map.rows) continue;
          bctx.drawImage(tileVar(world.tiles.wild, gx, gy), (gx * TILE - ox) | 0, (gy * TILE - oy) | 0);
        }
      }
    }

    const c0 = Math.max(0, Math.floor(ox / TILE) - 1);
    const r0 = Math.max(0, Math.floor(oy / TILE) - 1);
    const c1 = Math.min(world.map.cols - 1, Math.floor((ox + VIEW_W) / TILE) + 1);
    const r1 = Math.min(world.map.rows - 1, Math.floor((oy + VIEW_H) / TILE) + 1);
    const tick = (time * 6) | 0;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const kind = world.map.tiles[r * world.map.cols + c];
        const x = (c * TILE - ox) | 0;
        const y = (r * TILE - oy) | 0;
        let img = tileVar(world.tiles.floor, c, r);
        if (kind === T.WALL || kind === T.VOID) img = tileVar(world.tiles.wall, c, r);
        else if (kind === T.CRATE) img = world.tiles.crate;
        else if (kind === T.GOO) img = world.tiles.goo[tick % 2];
        else if (kind === T.LAVA) img = (world.tiles.lava || world.tiles.goo)[tick % 2];
        else if (kind === T.BUBBLE) img = (world.tiles.bubble || world.tiles.goo)[tick % 2];
        else if (kind === T.PORTAL) img = world.tiles.portal[tick % 2];
        if (world.biome === "dark" && world.seen) {
          if (!world.seen[r * world.map.cols + c]) continue;
          bctx.drawImage(img, x, y);
          if (!inLamp((c + 0.5) * TILE, (r + 0.5) * TILE)) {
            bctx.fillStyle = "rgba(4,4,8,0.72)";
            bctx.fillRect(x, y, TILE, TILE);
          }
          continue;
        }
        bctx.drawImage(img, x, y);
      }
    }

    for (const p of particles) {
      bctx.fillStyle = p.color;
      bctx.fillRect((p.x - ox) | 0, (p.y - oy) | 0, p.s, p.s);
    }

    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (world.biome === "dark" && !inLamp(e.x, e.y)) continue;
      const img = e.frames[((e.t * 6) | 0) & 1];
      const x = (e.x - ox - img.width / 2) | 0;
      const y = (e.y - oy - img.height / 2) | 0;
      if (e.flash > 0) {
        bctx.globalCompositeOperation = "lighter";
      }
      bctx.drawImage(img, x, y);
      bctx.globalCompositeOperation = "source-over";
      if (e.hp < e.maxHp) {
        bctx.fillStyle = "#09070f";
        bctx.fillRect(x, y - 3, img.width, 2);
        bctx.fillStyle = C.hp;
        bctx.fillRect(x, y - 3, (img.width * e.hp) / e.maxHp, 2);
      }
      if (e.gene.weapon === "shock") drawShockRing(e, ox, oy);
      if (e.gene.weapon === "laser") drawLaserBeam(e, ox, oy);
    }

    const lock = nearestEnemy();
    if (lock) {
      const img = lock.frames[0];
      const x = (lock.x - ox - img.width / 2) | 0;
      const y = (lock.y - oy - img.height / 2) | 0;
      const w = img.width;
      const h = img.height;
      bctx.fillStyle = C.portal;
      bctx.fillRect(x - 1, y - 1, 3, 1);
      bctx.fillRect(x - 1, y - 1, 1, 3);
      bctx.fillRect(x + w - 2, y - 1, 3, 1);
      bctx.fillRect(x + w, y - 1, 1, 3);
      bctx.fillRect(x - 1, y + h, 3, 1);
      bctx.fillRect(x - 1, y + h - 2, 1, 3);
      bctx.fillRect(x + w - 2, y + h, 3, 1);
      bctx.fillRect(x + w, y + h - 2, 1, 3);
    }

    for (const b of bullets) {
      bctx.fillStyle = C.bullet;
      bctx.fillRect((b.x - ox) | 0, (b.y - oy) | 0, 2, 2);
    }
    for (const b of eBullets) {
      if (b.flame) {
        const s = Math.max(8, (b.r * 2) | 0);
        const x = (b.x - ox - s / 2) | 0;
        const y = (b.y - oy - s / 2) | 0;
        bctx.fillStyle = C.flameLo;
        bctx.fillRect(x, y, s, s);
        bctx.fillStyle = C.flame;
        bctx.fillRect(x + 2, y + 2, s - 4, s - 4);
        bctx.fillStyle = C.flameHi;
        bctx.fillRect(x + 4, y + 4, Math.max(2, s - 8), Math.max(2, s - 8));
        if (((time * 14) | 0) % 2 === 0) {
          bctx.fillStyle = C.flameCore;
          bctx.fillRect(x + (s >> 1) - 1, y + (s >> 1) - 1, 3, 3);
        }
      } else {
        bctx.fillStyle = C.hp;
        bctx.fillRect((b.x - ox - 2) | 0, (b.y - oy - 2) | 0, 5, 5);
        bctx.fillStyle = C.amber;
        bctx.fillRect((b.x - ox) | 0, (b.y - oy) | 0, 2, 2);
      }
    }

    if (!over && (invuln <= 0 || slash || ((time * 20) | 0) % 2 === 0)) {
      if (slash) drawSpinjitzu(ox, oy);
      else {
        const pf = playerFrames[((time * 8) | 0) & 1];
        bctx.save();
        bctx.translate((player.x - ox) | 0, (player.y - oy) | 0);
        bctx.rotate(player.ang);
        bctx.drawImage(pf, -8, -8);
        bctx.restore();
      }
    }

    drawMinimap();

    if (!over && player && !shopping) {
      if (mag <= 0 && reloadT <= 0) {
        const flash = ((time * 8) | 0) % 2 === 0;
        bctx.fillStyle = flash ? "rgba(255,45,106,0.16)" : "rgba(255,45,106,0.06)";
        bctx.fillRect(0, 0, VIEW_W, 3);
        bctx.fillRect(0, VIEW_H - 3, VIEW_W, 3);
        bctx.fillRect(0, 0, 3, VIEW_H);
        bctx.fillRect(VIEW_W - 3, 0, 3, VIEW_H);
      }
      if (player.hp > 0 && (player.hp <= 2 || player.hp / player.maxHp <= 0.34)) {
        const bpm = player.hp === 1 ? 11 : 7.5;
        const beat = Math.max(0, Math.sin(time * bpm));
        const a = player.hp === 1 ? 0.1 + beat * 0.16 : 0.05 + beat * 0.1;
        bctx.fillStyle = "rgba(110,0,18," + a + ")";
        bctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    }

    dctx.fillStyle = "#05040a";
    dctx.fillRect(0, 0, canvas.width, canvas.height);
    dctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
  }

  function drawMinimap() {
    const mw = 42;
    const mh = 32;
    const x0 = VIEW_W - mw - 4;
    const y0 = VIEW_H - mh - 4;
    bctx.fillStyle = "#09070fcc";
    bctx.fillRect(x0 - 2, y0 - 2, mw + 4, mh + 4);
    bctx.fillStyle = C.visor;
    bctx.fillRect(x0 - 2, y0 - 2, mw + 4, 1);
    bctx.fillRect(x0 - 2, y0 + mh + 1, mw + 4, 1);
    bctx.fillRect(x0 - 2, y0 - 2, 1, mh + 4);
    bctx.fillRect(x0 + mw + 1, y0 - 2, 1, mh + 4);
    bctx.fillStyle = "#09070fcc";
    bctx.fillRect(x0 - 1, y0 - 1, mw + 2, mh + 2);
    const sx = mw / world.map.cols;
    const sy = mh / world.map.rows;
    for (let r = 0; r < world.map.rows; r++) {
      for (let c = 0; c < world.map.cols; c++) {
        const k = world.map.tiles[r * world.map.cols + c];
        if (k === T.WALL || k === T.VOID) continue;
        if (world.biome === "dark" && world.seen && !world.seen[r * world.map.cols + c]) continue;
        bctx.fillStyle = k === T.PORTAL ? world.theme?.portal || C.portal : k === T.BUBBLE ? C.visor : world.theme?.minimap || "#3a3355";
        bctx.fillRect(x0 + c * sx, y0 + r * sy, Math.max(1, sx), Math.max(1, sy));
      }
    }
    bctx.fillStyle = C.hp;
    for (const e of world.enemies) {
      if (world.biome === "dark" && !inLamp(e.x, e.y)) continue;
      const s = e.gene.boss ? 3 : 1;
      bctx.fillStyle = e.gene.boss ? C.flame : C.hp;
      bctx.fillRect(x0 + (e.x / TILE) * sx, y0 + (e.y / TILE) * sy, s, s);
    }
    bctx.fillStyle = C.player;
    bctx.fillRect(x0 + (player.x / TILE) * sx, y0 + (player.y / TILE) * sy, 2, 2);
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    try {
      update(dt);
      draw();
    } catch (err) {
      console.error("raid hitch", err);
    }
    requestAnimationFrame(frame);
  }

  function setDev(on) {
    dev = !!on;
    if (ui.devBadge) ui.devBadge.classList.toggle("hidden", !dev);
    if (dev) {
      coins = Math.max(coins, 80);
      mag = gunStats().mag;
      reloadT = 0;
      renderCoins();
      renderLoadout();
    }
  }

  function jumpTo(n) {
    floor = Math.max(1, n | 0);
    world = spawnFloor(seed, floor);
    landOnFloor({ newRun: !player });
    over = false;
    hideShop();
    const overlayEl = document.querySelector("#overlay");
    if (overlayEl) overlayEl.classList.add("hidden");
    if (ui.hideOverlay) ui.hideOverlay();
    if (dev) {
      coins = Math.max(coins, 80);
      mag = gunStats().mag;
      reloadT = 0;
      renderCoins();
      renderLoadout();
    }
    toast((dev ? "DEV · " : "") + "DEPTH " + floor + " · " + biomeName(floor));
  }

  function eatKey(...codes) {
    let hit = false;
    for (const c of codes) {
      if (keys.has(c)) {
        keys.delete(c);
        hit = true;
      }
    }
    return hit;
  }

  function tickDev() {
    if (eatKey("Backquote", "`")) {
      setDev(!dev);
      toast(dev ? "DEV ON · [ ] FLOORS · 1-7 WORLDS" : "DEV OFF");
    }
    if (!dev || shopping) return;
    if (eatKey("BracketLeft", "[")) jumpTo(floor - 1);
    if (eatKey("BracketRight", "]")) jumpTo(floor + 1);
    for (const [code, ch, depth] of DEV_JUMPS) {
      if (eatKey(code, ch)) jumpTo(depth);
    }
  }

  function start() {
    layout();
    setDev(dev);
    restart();
    const depth = Number(boot.get("depth") || 0);
    if (depth > 1) jumpTo(depth);
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", layout);
  layout();
  if (ui.descend) ui.descend.addEventListener("click", leaveShop);

  return { start, restart };
}
