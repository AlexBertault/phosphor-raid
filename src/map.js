import { createRng } from "./rng.js";

export const T = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  CRATE: 3,
  PORTAL: 4,
  GOO: 5,
  LAVA: 6,
};

export const TILE = 16;

function idx(cols, x, y) {
  return y * cols + x;
}

function carveRect(tiles, cols, rows, x, y, w, h, kind) {
  const x0 = Math.max(1, x | 0);
  const y0 = Math.max(1, y | 0);
  const x1 = Math.min(cols - 2, (x + w) | 0);
  const y1 = Math.min(rows - 2, (y + h) | 0);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) tiles[idx(cols, xx, yy)] = kind;
  }
}

function carveLine(tiles, cols, rows, x0, y0, x1, y1) {
  let x = x0 | 0;
  let y = y0 | 0;
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  while (x !== (x1 | 0)) {
    carveRect(tiles, cols, rows, x - 1, y - 1, 3, 3, T.FLOOR);
    x += dx;
  }
  while (y !== (y1 | 0)) {
    carveRect(tiles, cols, rows, x - 1, y - 1, 3, 3, T.FLOOR);
    y += dy;
  }
  carveRect(tiles, cols, rows, x - 1, y - 1, 3, 3, T.FLOOR);
}

export function generateDungeon(seed, opts = {}) {
  const cols = opts.cols ?? 48;
  const rows = opts.rows ?? 36;
  const splits = opts.splits ?? 18;
  const extraLoops = opts.loops ?? 3;
  const crateMax = opts.crateMax ?? 3;
  const gooChance = opts.gooChance ?? 0.4;
  const rng = createRng(seed);
  const tiles = new Uint8Array(cols * rows);
  tiles.fill(T.WALL);

  const rooms = [];
  const min = cols < 32 ? 4 : 6;
  const leaves = [{ x: 2, y: 2, w: cols - 4, h: rows - 4 }];

  for (let i = 0; i < splits && leaves.length; i++) {
    leaves.sort((a, b) => b.w * b.h - a.w * a.h);
    const node = leaves.shift();
    if (node.w < min * 2 && node.h < min * 2) {
      rooms.push(node);
      continue;
    }
    const splitH = node.w > node.h + 4 ? false : node.h > node.w + 4 ? true : rng.chance(0.5);
    if (!splitH && node.w >= min * 2) {
      const cut = rng.int(min, node.w - min);
      leaves.push({ x: node.x, y: node.y, w: cut, h: node.h });
      leaves.push({ x: node.x + cut, y: node.y, w: node.w - cut, h: node.h });
    } else if (splitH && node.h >= min * 2) {
      const cut = rng.int(min, node.h - min);
      leaves.push({ x: node.x, y: node.y, w: node.w, h: cut });
      leaves.push({ x: node.x, y: node.y + cut, w: node.w, h: node.h - cut });
    } else {
      rooms.push(node);
    }
  }
  rooms.push(...leaves);

  const placed = [];
  for (const leaf of rooms) {
    const w = rng.int(Math.min(4, leaf.w), Math.max(4, leaf.w - 1));
    const h = rng.int(Math.min(4, leaf.h), Math.max(4, leaf.h - 1));
    const x = leaf.x + rng.int(0, Math.max(0, leaf.w - w));
    const y = leaf.y + rng.int(0, Math.max(0, leaf.h - h));
    const room = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), cleared: false };
    carveRect(tiles, cols, rows, x, y, w, h, T.FLOOR);
    placed.push(room);
  }

  placed.sort((a, b) => a.cx - b.cx + (a.cy - b.cy) * 0.01);
  for (let i = 1; i < placed.length; i++) {
    const a = placed[i - 1];
    const b = placed[i];
    if (rng.chance(0.5)) {
      carveLine(tiles, cols, rows, a.cx, a.cy, b.cx, a.cy);
      carveLine(tiles, cols, rows, b.cx, a.cy, b.cx, b.cy);
    } else {
      carveLine(tiles, cols, rows, a.cx, a.cy, a.cx, b.cy);
      carveLine(tiles, cols, rows, a.cx, b.cy, b.cx, b.cy);
    }
  }

  for (let i = 0; i < extraLoops && placed.length > 1; i++) {
    const a = rng.pick(placed);
    const b = rng.pick(placed);
    carveLine(tiles, cols, rows, a.cx, a.cy, b.cx, b.cy);
  }

  for (const room of placed) {
    const n = rng.int(0, crateMax);
    for (let i = 0; i < n; i++) {
      const x = rng.int(room.x + 1, Math.max(room.x + 1, room.x + room.w - 2));
      const y = rng.int(room.y + 1, Math.max(room.y + 1, room.y + room.h - 2));
      if (tiles[idx(cols, x, y)] === T.FLOOR) tiles[idx(cols, x, y)] = T.CRATE;
    }
    if (rng.chance(gooChance)) {
      const x = rng.int(room.x + 1, Math.max(room.x + 1, room.x + room.w - 2));
      const y = rng.int(room.y + 1, Math.max(room.y + 1, room.y + room.h - 2));
      if (tiles[idx(cols, x, y)] === T.FLOOR) tiles[idx(cols, x, y)] = T.GOO;
    }
  }

  const start = placed[0];
  let portalRoom = placed[placed.length - 1];
  let best = 0;
  for (const room of placed) {
    const d = Math.hypot(room.cx - start.cx, room.cy - start.cy);
    if (d > best) {
      best = d;
      portalRoom = room;
    }
  }

  const startX = start.x + 1;
  const startY = start.cy;
  const portalX = portalRoom.x + portalRoom.w - 1;
  const portalY = portalRoom.cy;
  tiles[idx(cols, startX, startY)] = T.FLOOR;
  tiles[idx(cols, portalX, portalY)] = T.PORTAL;

  if (opts.biome === "lava") {
    const lavaChance = opts.lavaChance ?? 0.8;
    for (const room of placed) {
      if (room === start) continue;
      if (room.w < 6 || room.h < 6) continue;
      if (!rng.chance(lavaChance)) continue;
      const pw = rng.chance(0.4) ? 3 : 2;
      const ph = rng.chance(0.4) ? 3 : 2;
      const x = rng.int(room.x + 1, Math.max(room.x + 1, room.x + room.w - pw - 1));
      const y = rng.int(room.y + 1, Math.max(room.y + 1, room.y + room.h - ph - 1));
      let blocked = false;
      for (let yy = y; yy < y + ph && !blocked; yy++) {
        for (let xx = x; xx < x + pw; xx++) {
          if ((xx === startX && yy === startY) || (xx === portalX && yy === portalY)) blocked = true;
        }
      }
      if (blocked) continue;
      carveRect(tiles, cols, rows, x, y, pw, ph, T.LAVA);
    }
    tiles[idx(cols, startX, startY)] = T.FLOOR;
    tiles[idx(cols, portalX, portalY)] = T.PORTAL;
  }

  return {
    tiles,
    cols,
    rows,
    rooms: placed,
    start: { x: (startX + 0.5) * TILE, y: (startY + 0.5) * TILE },
    portal: { x: (portalX + 0.5) * TILE, y: (portalY + 0.5) * TILE },
    portalRoom,
  };
}

export function tileAt(map, x, y) {
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return T.VOID;
  return map.tiles[r * map.cols + c];
}

export function isSolid(kind) {
  return kind === T.WALL || kind === T.CRATE || kind === T.VOID;
}

export function circleHitsSolid(map, x, y, radius) {
  const minC = Math.floor((x - radius) / TILE);
  const maxC = Math.floor((x + radius) / TILE);
  const minR = Math.floor((y - radius) / TILE);
  const maxR = Math.floor((y + radius) / TILE);
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return true;
      const kind = map.tiles[r * map.cols + c];
      if (!isSolid(kind)) continue;
      const rx = c * TILE;
      const ry = r * TILE;
      const nx = Math.max(rx, Math.min(x, rx + TILE));
      const ny = Math.max(ry, Math.min(y, ry + TILE));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < radius * radius) return { c, r, kind };
    }
  }
  return null;
}

export function moveCircle(map, ent, dx, dy) {
  ent.x += dx;
  if (circleHitsSolid(map, ent.x, ent.y, ent.r)) ent.x -= dx;
  ent.y += dy;
  if (circleHitsSolid(map, ent.x, ent.y, ent.r)) ent.y -= dy;
}

export function breakCrate(map, c, r) {
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return false;
  const i = r * map.cols + c;
  if (map.tiles[i] !== T.CRATE) return false;
  map.tiles[i] = T.FLOOR;
  return true;
}
