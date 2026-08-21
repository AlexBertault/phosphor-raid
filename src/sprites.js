import { C, GENE_PALETTES } from "./palette.js";

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

export function tileSheet(rng) {
  const floor = makeCanvas(16, 16);
  const wall = makeCanvas(16, 16);
  const crate = makeCanvas(16, 16);
  const goo = makeCanvas(16, 16);
  const portal = [makeCanvas(16, 16), makeCanvas(16, 16)];

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = rng.next();
      const floorC = n > 0.92 ? C.floorC : n > 0.45 ? C.floorB : C.floorA;
      px(floor.ctx, x, y, floorC);
      if (n > 0.97) px(floor.ctx, x, y, "#2a2444");

      const brick = ((x / 4) | 0) + ((y / 5) | 0);
      px(wall.ctx, x, y, brick % 2 ? C.wall : "#32264a");
      if (y % 5 === 0 || (x + (y > 5 ? 2 : 0)) % 4 === 0) px(wall.ctx, x, y, C.wallLo);
      if (y % 5 === 1) px(wall.ctx, x, y, C.wallHi);

      px(crate.ctx, x, y, C.crate);
      if (x === 0 || y === 0) px(crate.ctx, x, y, C.crateHi);
      if (x === 15 || y === 15) px(crate.ctx, x, y, C.crateLo);
      if (x === 8 || y === 8) px(crate.ctx, x, y, C.crateLo);

      const d = Math.hypot(x - 7.5, y - 7.5);
      px(goo.ctx, x, y, d < 6.5 ? C.goo : C.floorB);
      if (d < 4 && rng.chance(0.4)) px(goo.ctx, x, y, C.gooHi);
    }
  }

  for (let f = 0; f < 2; f++) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        px(portal[f].ctx, x, y, C.floorB);
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d < 7) px(portal[f].ctx, x, y, f ? C.portal2 : C.portal);
        if (d < 4) px(portal[f].ctx, x, y, C.void);
        if (d < 2) px(portal[f].ctx, x, y, f ? C.portal : C.portal2);
      }
    }
  }

  return { floor: floor.c, wall: wall.c, crate: crate.c, goo: goo.c, portal: portal.map((p) => p.c) };
}

export function pickPalette(rng) {
  const base = rng.pick(GENE_PALETTES).slice();
  if (rng.chance(0.35)) {
    const i = rng.int(0, 2);
    const j = rng.int(0, 2);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base;
}
