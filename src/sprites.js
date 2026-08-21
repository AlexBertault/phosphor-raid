import { C } from "./palette.js";

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, 1, 1);
}

function stamp(grid, w, h, cx, cy, r, val) {
  const r2 = r * r;
  const minX = Math.max(1, (cx - r) | 0);
  const maxX = Math.min(w - 2, (cx + r) | 0);
  const minY = Math.max(1, (cy - r) | 0);
  const maxY = Math.min(h - 2, (cy + r) | 0);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) grid[y * w + x] = val;
    }
  }
}

export function creatureSprite(rng, genome, frame = 0) {
  const size = genome.sizePx;
  const { c, ctx } = makeCanvas(size, size);
  const grid = new Uint8Array(size * size);
  const cx = size / 2;
  const cy = size / 2 + 0.5;
  const bob = frame ? 1 : 0;

  if (genome.body === "skitter") {
    stamp(grid, size, size, cx, cy - 1 + bob, genome.coreR, 1);
    const legs = genome.limbs;
    for (let i = 0; i < legs; i++) {
      const a = (i / legs) * Math.PI * 2 + (frame ? 0.2 : -0.2);
      const lx = cx + Math.cos(a) * (genome.coreR + 2);
      const ly = cy + Math.sin(a) * (genome.coreR + 1) + bob;
      stamp(grid, size, size, lx, ly, 0.9, 1);
    }
  } else if (genome.body === "grub") {
    stamp(grid, size, size, cx - 2, cy + bob, genome.coreR, 1);
    stamp(grid, size, size, cx + 1, cy + bob, genome.coreR * 0.85, 1);
    stamp(grid, size, size, cx + 3, cy + bob, genome.coreR * 0.55, 1);
  } else if (genome.body === "tank") {
    stamp(grid, size, size, cx, cy + bob, genome.coreR + 0.4, 1);
    stamp(grid, size, size, cx, cy - 1 + bob, genome.coreR * 0.7, 1);
  } else if (genome.body === "brute") {
    stamp(grid, size, size, cx, cy + 1 + bob, genome.coreR, 1);
    stamp(grid, size, size, cx, cy - genome.coreR * 0.45 + bob, genome.coreR * 0.72, 1);
    stamp(grid, size, size, cx - genome.coreR * 0.75, cy - genome.coreR * 0.95 + bob, 2.1, 1);
    stamp(grid, size, size, cx + genome.coreR * 0.75, cy - genome.coreR * 0.95 + bob, 2.1, 1);
    stamp(grid, size, size, cx, cy + genome.coreR * 0.55 + bob, genome.coreR * 0.55, 1);
  } else if (genome.body === "drone") {
    stamp(grid, size, size, cx, cy + bob, genome.coreR * 0.8, 1);
    stamp(grid, size, size, cx - genome.coreR - 1, cy + bob, 1.4, 1);
    stamp(grid, size, size, cx + genome.coreR + 1, cy + bob, 1.4, 1);
  } else {
    stamp(grid, size, size, cx, cy + bob, genome.coreR, 1);
    const bumps = genome.limbs;
    for (let i = 0; i < bumps; i++) {
      const a = rng.float(0, Math.PI * 2);
      const d = rng.float(1, genome.coreR);
      stamp(
        grid,
        size,
        size,
        cx + Math.cos(a) * d,
        cy + Math.sin(a) * d + bob,
        rng.float(0.8, 1.6),
        1,
      );
    }
  }

  if (genome.spikes) {
    for (let i = 0; i < genome.spikes; i++) {
      const a = (i / genome.spikes) * Math.PI * 2;
      const x = (cx + Math.cos(a) * (genome.coreR + 1.2)) | 0;
      const y = (cy + Math.sin(a) * (genome.coreR + 0.6) + bob) | 0;
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) grid[y * size + x] = 1;
    }
  }

  const eyes = [];
  const eyeCount = genome.eyes;
  for (let i = 0; i < eyeCount; i++) {
    const ex = (cx + (i - (eyeCount - 1) / 2) * 2) | 0;
    const ey = (cy - genome.coreR * 0.35 + bob) | 0;
    eyes.push([ex, ey]);
  }

  const [primary, shadow, highlight, accent] = genome.palette;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (!grid[i]) continue;
      const up = grid[(y - 1) * size + x];
      const down = grid[(y + 1) * size + x];
      const left = grid[y * size + x - 1];
      const right = grid[y * size + x + 1];
      if (!up || !down || !left || !right) {
        px(ctx, x, y, C.outline);
        continue;
      }
      let color = primary;
      if (!grid[(y - 2) * size + x]) color = highlight;
      else if (!grid[(y + 2) * size + x]) color = shadow;
      if ((x + y) % 5 === 0) color = shadow;
      px(ctx, x, y, color);
    }
  }

  for (const [ex, ey] of eyes) {
    px(ctx, ex, ey, accent);
    px(ctx, ex + 1, ey, C.outline);
  }

  if (genome.snout) {
    const sx = (cx + genome.coreR) | 0;
    const sy = (cy + bob) | 0;
    px(ctx, sx, sy, primary);
    px(ctx, sx + 1, sy, accent);
  }

  return c;
}

export function playerSprite(frame = 0) {
  const { c, ctx } = makeCanvas(16, 16);
  const bob = frame ? 1 : 0;
  const rows = [
    "................",
    "...######.......",
    "..#oooooo#......",
    "..#o@@@@o#......",
    "...######.......",
    "...##..##.......",
    "..########......",
    ".##.####.##.....",
    ".#..####..#.....",
    "..###..###g.....",
    "..##....#ggg....",
    ".##......#g.....",
    ".#........#.....",
    "##........##....",
    "#.#......#.#....",
    "................",
  ];
  const map = {
    "#": C.player,
    o: "#2a6a48",
    "@": C.visor,
    g: C.amber,
    ".": null,
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = rows[y][x];
      const color = map[ch];
      if (!color) continue;
      const yy = Math.min(15, y + (y > 5 ? bob : 0));
      px(ctx, x, yy, color);
      if (ch === "#" && y < 5) px(ctx, x, yy, C.player2);
    }
  }
  const ink = ctx.getImageData(0, 0, 16, 16);
  const d = ink.data;
  const alpha = (x, y) => d[(y * 16 + x) * 4 + 3];
  for (let y = 1; y < 15; y++) {
    for (let x = 1; x < 15; x++) {
      if (!alpha(x, y)) continue;
      if (!alpha(x, y - 1) || !alpha(x, y + 1) || !alpha(x - 1, y) || !alpha(x + 1, y)) {
        px(ctx, x, y, C.outline);
      }
    }
  }
  return c;
}

export function tileSheet(rng, theme = C) {
  const biome = theme.biome || "cave";
  const wild = makeCanvas(16, 16);
  const floor = makeCanvas(16, 16);
  const wall = makeCanvas(16, 16);
  const crate = makeCanvas(16, 16);
  const goo = [makeCanvas(16, 16), makeCanvas(16, 16)];
  const portal = [makeCanvas(16, 16), makeCanvas(16, 16)];
  const fa = theme.floorA || C.floorA;
  const fb = theme.floorB || C.floorB;
  const fc = theme.floorC || C.floorC;
  const pebble = theme.pebble || fc;
  const wallC = theme.wall || C.wall;
  const wallHi = theme.wallHi || C.wallHi;
  const wallLo = theme.wallLo || C.wallLo;
  const gooC = theme.goo || C.goo;
  const gooHi = theme.gooHi || C.gooHi;
  const crateC = theme.crate || C.crate;
  const crateHi = theme.crateHi || C.crateHi;
  const crateLo = theme.crateLo || C.crateLo;
  const portalA = theme.portal || C.portal;
  const portalB = theme.portal2 || C.portal2;
  const voidC = theme.void || C.void;

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = rng.next();
      const gx = x % 4;
      const gy = y % 4;
      const grout = gx === 0 || gy === 0;
      const cobble = ((x / 4) | 0) + ((y / 4) | 0);

      if (biome === "grass") {
        let grass = n > 0.5 ? fa : fb;
        if (n > 0.86 && n < 0.93) grass = pebble;
        else if (n > 0.96) grass = fc;
        px(floor.ctx, x, y, grass);
        px(wall.ctx, x, y, grout ? wallLo : cobble % 2 ? wallC : wallHi);
        px(wild.ctx, x, y, n > 0.55 ? "#2a2418" : "#1e1a12");
        if (n > 0.9) px(wild.ctx, x, y, "#3a3224");
      } else if (biome === "lava") {
        px(floor.ctx, x, y, n > 0.62 ? fa : fb);
        if (n > 0.9) px(floor.ctx, x, y, pebble);
        if ((x + y * 2) % 9 === 0) px(floor.ctx, x, y, wallLo);
        px(wall.ctx, x, y, grout ? wallLo : cobble % 2 ? wallC : wallHi);
        if (gy === 2 && n > 0.55) px(wall.ctx, x, y, wallHi);
        px(wild.ctx, x, y, n > 0.5 ? wallLo : voidC);
      } else if (biome === "gem") {
        px(floor.ctx, x, y, n > 0.5 ? fa : fb);
        if (n > 0.93) px(floor.ctx, x, y, pebble);
        px(wall.ctx, x, y, grout ? wallLo : cobble % 2 ? wallC : fa);
        if (n > 0.9) px(wall.ctx, x, y, wallHi);
        px(wild.ctx, x, y, n > 0.5 ? wallLo : voidC);
      } else {
        const speck = (x * 7 + y * 13) % 6 === 0;
        px(floor.ctx, x, y, speck ? pebble : n > 0.5 ? fa : fc);
        px(wall.ctx, x, y, grout ? wallLo : cobble % 2 ? wallC : wallHi);
        if (n > 0.92) px(wall.ctx, x, y, fa);
        px(wild.ctx, x, y, n > 0.5 ? wallLo : voidC);
      }

      px(crate.ctx, x, y, y % 4 === 0 ? crateLo : crateC);
      if (x === 0 || x === 15) px(crate.ctx, x, y, crateLo);
      if (y % 4 === 1) px(crate.ctx, x, y, crateHi);
    }
  }

  for (let f = 0; f < 2; f++) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        px(goo[f].ctx, x, y, d < 6.5 ? gooC : fb);
        if (d < 4 && (f || rng.chance(0.45))) px(goo[f].ctx, x, y, gooHi);
        if (biome === "grass" && d < 5 && rng.chance(0.2)) px(goo[f].ctx, x, y, pebble);

        px(portal[f].ctx, x, y, fb);
        if (d < 7) px(portal[f].ctx, x, y, f ? portalB : portalA);
        if (d < 4) px(portal[f].ctx, x, y, voidC);
        if (d < 2) px(portal[f].ctx, x, y, f ? portalA : portalB);
      }
    }
  }

  return {
    floor: floor.c,
    wall: wall.c,
    crate: crate.c,
    goo: goo.map((g) => g.c),
    portal: portal.map((p) => p.c),
    wild: wild.c,
  };
}
