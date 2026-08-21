import { createRng, hashSeed } from "./rng.js";
import { C } from "./palette.js";
import { creatureSprite, playerSprite, tileSheet, pickPalette } from "./sprites.js";
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
const MELEE_REACH = 30;
const BEST_KEY = "phosphor-best";

const BODIES = ["orb", "skitter", "grub", "tank", "drone"];
const AIS = ["chase", "strafe", "orbit", "ambush"];
const WEAPONS = ["bite", "spit", "spread"];

function tune(floor) {
  const t = Math.max(0, floor - 1);
  return {
    cols: Math.min(64, 22 + t * 4),
    rows: Math.min(48, 16 + t * 3),
    splits: Math.min(26, 3 + t * 3),
    loops: Math.min(7, 1 + (t >> 1)),
    crateMax: Math.min(4, t < 2 ? 0 : 1 + ((t / 3) | 0)),
    gooChance: Math.min(0.5, t < 2 ? 0.04 : 0.14 + t * 0.04),
    skipChance: Math.max(0, 0.4 - t * 0.07),
    maxPerRoom: Math.min(5, 1 + ((t / 2) | 0)),
    bodies: t < 2 ? ["orb", "grub", "drone"] : t < 4 ? ["orb", "grub", "skitter", "drone"] : BODIES,
    ais: t < 3 ? ["orbit", "strafe"] : AIS,
    shootChance: Math.min(0.95, 0.65 + t * 0.06),
    aggro: Math.min(160, 80 + t * 8),
    shootRange: Math.min(170, 110 + t * 6),
    bulletSpeed: Math.min(52, 28 + t * 2.2),
    playerSpeed: 124,
    dashSpeed: 210,
    fireRate: 0.1,
    meleeCd: 0.38,
    reload: 2,
    mag: 3,
    musicStep: Math.max(0.085, 0.2 - t * 0.012),
  };
}

function genome(rng, p) {
  const body = rng.pick(p.bodies);
  const t = Math.max(0, (p.floor ?? 1) - 1);
  const sizePx = body === "tank" ? rng.int(18, 24) : body === "drone" ? rng.int(12, 16) : rng.int(14, 18);
  const shooty = rng.chance(p.shootChance);
  return {
    body,
    palette: pickPalette(rng),
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

function makeEnemy(rng, x, y, p) {
  const g = genome(rng, p);
  return {
    x,
    y,
    r: g.sizePx * 0.32,
    hp: g.hp,
    maxHp: g.hp,
    gene: g,
    frames: [creatureSprite(rng, g, 0), creatureSprite(rng, g, 1)],
    t: rng.float(0, 10),
    shootT: rng.float(0.6, 1.8),
    alive: true,
    flash: 0,
    aggro: false,
  };
}

function spawnFloor(seed, floor) {
  const p = tune(floor);
  p.floor = floor;
  const rng = createRng(hashSeed(seed + floor * 997));
  const map = generateDungeon(rng.int(1, 1e9), p);
  const tiles = tileSheet(createRng(seed + 17));
  const enemies = [];
  for (const room of map.rooms) {
    if (room === map.rooms[0]) continue;
    if (rng.chance(p.skipChance)) continue;
    const n = rng.int(1, p.maxPerRoom);
    for (let i = 0; i < n; i++) {
      const x = (rng.float(room.x + 1.2, room.x + room.w - 1.2) + 0.5) * TILE;
      const y = (rng.float(room.y + 1.2, room.y + room.h - 1.2) + 0.5) * TILE;
      if (circleHitsSolid(map, x, y, 6)) continue;
      enemies.push(makeEnemy(rng, x, y, p));
    }
  }
  return { rng, map, tiles, enemies, p };
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
  let toastT = 0;
  let fireT = 0;
  let dashT = 0;
  let dashCd = 0;
  let invuln = 0;
  let weapon = "gun";
  let mag = 3;
  let reloadT = 0;
  let meleeT = 0;
  let emptyT = 0;
  let slash = null;
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
        ang: 0,
        moveAng: 0,
      };
      weapon = "gun";
    } else {
      player.x = world.map.start.x;
      player.y = world.map.start.y;
      player.hp = Math.min(player.maxHp, player.hp + 1);
    }
    bullets = [];
    eBullets = [];
    particles = [];
    cam.x = player.x - VIEW_W / 2;
    cam.y = player.y - VIEW_H / 2;
    over = false;
    wonFloor = false;
    fireT = 0;
    dashT = 0;
    dashCd = 0;
    invuln = 0;
    mag = world.p.mag;
    reloadT = 0;
    meleeT = 0;
    emptyT = 0;
    slash = null;
    toast(newRun ? "DEPTH 1 · GO DEEP" : "DEPTH " + floor + " · HEAT UP");
    if (ui.seed) ui.seed.textContent = "SEED " + seed.toString(16).toUpperCase();
    renderDepth();
    renderHp();
    renderKills();
    renderLoadout();
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

  function renderKills() {
    ui.kills.textContent = kills + " KILLS";
  }

  function renderLoadout() {
    if (!ui.weapon || !ui.ammo) return;
    ui.weapon.textContent = weapon === "melee" ? "BLADE" : reloadT > 0 ? "RELOAD" : "GUN";
    ui.weapon.classList.toggle("melee", weapon === "melee");
    ui.ammo.innerHTML = "";
    for (let i = 0; i < world.p.mag; i++) {
      const shell = document.createElement("div");
      const filled = weapon === "melee" ? true : i < mag;
      shell.className = "shell" + (filled ? "" : " empty") + (reloadT > 0 && weapon === "gun" ? " reload" : "");
      ui.ammo.appendChild(shell);
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
      if (Math.random() < 0.14) spawnPickup(e.x, e.y);
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
    if (invuln > 0 || over) return;
    player.hp -= dmg;
    invuln = 0.72;
    shake = 5;
    sfx.sfxHurt();
    burst(player.x, player.y, C.hp, 12);
    renderHp();
    if (player.hp <= 0) {
      player.hp = 0;
      over = true;
      sfx.sfxDie();
      const prev = readBest();
      const best = writeBest(floor);
      ui.showOver(kills, floor, best, floor >= prev);
    }
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

  function shoot(from, ang, speed, hostile, spread = 0, dmg = 1) {
    const a = ang + spread;
    const list = hostile ? eBullets : bullets;
    list.push({
      x: from.x + Math.cos(a) * (from.r + 3),
      y: from.y + Math.sin(a) * (from.r + 3),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: hostile ? 5.2 : 0.55,
      hostile,
      dmg,
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
    dctx.imageSmoothingEnabled = false;
  }

  function nearestEnemy() {
    if (!player || !world?.enemies) return null;
    let best = null;
    let bestDist = 190;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  function swingMelee() {
    meleeT = world.p.meleeCd;
    slash = { ang: player.ang, life: 0.18, spin: 0 };
    sfx.sfxMelee();
    burst(player.x, player.y, C.amber, 14);
    for (const e of world.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d > MELEE_REACH + e.r) continue;
      hitEnemy(e, 2);
    }
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      if (Math.hypot(b.x - player.x, b.y - player.y) <= MELEE_REACH + 4) {
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
        if (Math.random() < 0.38) spawnPickup((crate.c + 0.5) * TILE, (crate.r + 0.5) * TILE);
      }
    }
  }

  function update(dt) {
    time += dt;
    sfx.tickMusic(time, world.p.musicStep);
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) ui.toast.textContent = "";
    }
    if (over || !player) return;

    const move = axis();
    if (move.x !== 0 || move.y !== 0) player.moveAng = Math.atan2(move.y, move.x);
    const lock = nearestEnemy();
    player.ang = lock ? Math.atan2(lock.y - player.y, lock.x - player.x) : player.moveAng;

    if ((keys.has("ShiftLeft") || keys.has("ShiftRight")) && dashCd <= 0) {
      dashT = 0.14;
      dashCd = 0.38;
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
    if (slash) {
      slash.life -= dt;
      if (slash.life <= 0) slash = null;
    }
    if (reloadT > 0) {
      reloadT -= dt;
      if (reloadT <= 0) {
        reloadT = 0;
        mag = world.p.mag;
        sfx.sfxReload();
        renderLoadout();
      }
    }

    const speed = dashT > 0 ? world.p.dashSpeed : world.p.playerSpeed;
    moveCircle(world.map, player, move.x * speed * dt, move.y * speed * dt);
    if (tileAt(world.map, player.x, player.y) === T.GOO && dashT <= 0) {
      moveCircle(world.map, player, move.x * -speed * 0.25 * dt, move.y * -speed * 0.25 * dt);
    }

    if (keys.has("KeyF")) {
      keys.delete("KeyF");
      weapon = weapon === "gun" ? "melee" : "gun";
      sfx.sfxSwap();
      toast(weapon === "melee" ? "BLADE · 360 SWIPE" : "GUN · 3 SHOTS");
      renderLoadout();
    }

    if (keys.has("KeyR")) {
      keys.delete("KeyR");
      if (reloadT <= 0 && mag < world.p.mag) {
        reloadT = world.p.reload;
        sfx.sfxReload();
        renderLoadout();
        toast("RELOADING");
      } else {
        sfx.sfxEmpty();
      }
    }

    if (keys.has("Space")) {
      if (weapon === "melee") {
        if (meleeT <= 0) swingMelee();
      } else if (reloadT > 0) {
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
          fireT = world.p.fireRate;
          mag -= 1;
          shoot(player, player.ang, 280, false);
          sfx.sfxShoot();
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
      if (dist < world.p.aggro) e.aggro = true;
      if (!e.aggro) {
        alive.push(e);
        continue;
      }
      const g = e.gene;
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
      moveCircle(world.map, e, mx * sp * dt, my * sp * dt);

      e.shootT -= dt;
      if (g.weapon !== "bite" && e.shootT <= 0 && dist < world.p.shootRange) {
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

    if (world.enemies.length === 0 && !wonFloor) {
      wonFloor = true;
      toast("GATE OPEN · DEPTH " + (floor + 1) + " WAITING");
    }

    if (
      wonFloor &&
      Math.hypot(player.x - world.map.portal.x, player.y - world.map.portal.y) < 12
    ) {
      nextFloor();
      return;
    }

    const tx = player.x - VIEW_W / 2;
    const ty = player.y - VIEW_H / 2;
    cam.x += (tx - cam.x) * Math.min(1, dt * 12);
    cam.y += (ty - cam.y) * Math.min(1, dt * 12);
    shake = Math.max(0, shake - dt * 18);
  }

  function stepBullets(list, dt, hostile) {
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const hit = circleHitsSolid(world.map, b.x, b.y, 1.5);
      if (hit) {
        if (hit.kind === T.CRATE && breakCrate(world.map, hit.c, hit.r)) {
          sfx.sfxCrate();
          burst(b.x, b.y, C.crateHi, 8);
          if (Math.random() < 0.38) spawnPickup((hit.c + 0.5) * TILE, (hit.r + 0.5) * TILE);
        }
        list.splice(i, 1);
        continue;
      }
      if (b.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      if (hostile) {
        if (Math.hypot(b.x - player.x, b.y - player.y) < player.r + 3) {
          hurtPlayer(b.dmg);
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
    sfx.sfxPortal();
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

  function draw() {
    if (!player || !world) return;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    const ox = cam.x + sx;
    const oy = cam.y + sy;
    bctx.fillStyle = C.void;
    bctx.fillRect(0, 0, VIEW_W, VIEW_H);

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
        let img = world.tiles.floor;
        if (kind === T.WALL || kind === T.VOID) img = world.tiles.wall;
        else if (kind === T.CRATE) img = world.tiles.crate;
        else if (kind === T.GOO) img = world.tiles.goo;
        else if (kind === T.PORTAL) img = world.tiles.portal[tick % 2];
        bctx.drawImage(img, x, y);
      }
    }

    for (const p of particles) {
      bctx.fillStyle = p.color;
      bctx.fillRect((p.x - ox) | 0, (p.y - oy) | 0, p.s, p.s);
    }

    for (const e of world.enemies) {
      if (!e.alive) continue;
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
    }

    const lock = nearestEnemy();
    if (lock) {
      const img = lock.frames[0];
      const x = (lock.x - ox - img.width / 2) | 0;
      const y = (lock.y - oy - img.height / 2) | 0;
      const w = img.width;
      const h = img.height;
      bctx.fillStyle = weapon === "melee" ? C.amber : C.portal;
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
      bctx.fillStyle = C.hp;
      bctx.fillRect((b.x - ox - 2) | 0, (b.y - oy - 2) | 0, 5, 5);
      bctx.fillStyle = C.amber;
      bctx.fillRect((b.x - ox) | 0, (b.y - oy) | 0, 2, 2);
    }

    if (!over && (invuln <= 0 || ((time * 20) | 0) % 2 === 0)) {
      const pf = playerFrames[((time * 8) | 0) & 1];
      bctx.save();
      bctx.translate((player.x - ox) | 0, (player.y - oy) | 0);
      bctx.rotate(player.ang);
      bctx.drawImage(pf, -8, -8);
      bctx.restore();
      if (slash) {
        bctx.fillStyle = C.amber;
        const rings = 16;
        const spin = (1 - slash.life / 0.18) * Math.PI;
        for (let i = 0; i < rings; i++) {
          const a = (i / rings) * Math.PI * 2 + spin;
          const d = 10 + (i % 2);
          bctx.fillRect(
            (player.x - ox + Math.cos(a) * d) | 0,
            (player.y - oy + Math.sin(a) * d) | 0,
            2,
            2,
          );
        }
      }
    }

    drawMinimap();

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
    bctx.fillRect(x0 - 1, y0 - 1, mw + 2, mh + 2);
    const sx = mw / world.map.cols;
    const sy = mh / world.map.rows;
    for (let r = 0; r < world.map.rows; r++) {
      for (let c = 0; c < world.map.cols; c++) {
        const k = world.map.tiles[r * world.map.cols + c];
        if (k === T.WALL || k === T.VOID) continue;
        bctx.fillStyle = k === T.PORTAL ? C.portal : "#3a3355";
        bctx.fillRect(x0 + c * sx, y0 + r * sy, Math.max(1, sx), Math.max(1, sy));
      }
    }
    bctx.fillStyle = C.hp;
    for (const e of world.enemies) {
      bctx.fillRect(x0 + (e.x / TILE) * sx, y0 + (e.y / TILE) * sy, 1, 1);
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

  function start() {
    layout();
    restart();
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", layout);
  layout();

  return { start, restart };
}
