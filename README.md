# PHOSPHOR RAID

A fast 32-bit dungeon shooter in the browser. Every floor is a new map. Every enemy is a new genome. The whole run is: **how deep can you go?**

Early floors are tiny and over in seconds. Each gate makes the crypt bigger, the packs denser, and the music meaner. Your HP carries forward (+1 when you drop). Beat your best depth.

## Play

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually [http://localhost:5173](http://localhost:5173)). Click **INSERT COIN**.

```bash
npm run build
npm run preview
```

## Controls

| Key | Action |
| --- | --- |
| **WASD** / arrows | Move. Auto-aim locks the nearest enemy. |
| **Space** | Shoot |
| **Q** | 360° sword swipe (bats bullets) |
| **R** | Manual reload |
| **Shift** | Dash |

The fight is dodging fat, slow enemy shots. Far-away spitters are sloppy. The swipe hits everything around you and can bat bullets away. Die, and you restart from the death screen.

## How a raid works

1. Clear the floor.
2. Walk into the gate.
3. The next crypt is larger and hotter.
4. Repeat until you drop. Depth is the score. Best depth is saved in the browser.

## What's generated

- **Maps** — BSP rooms, corridors, crates, goo, a far-side gate. Size and room count scale with depth.
- **Enemies** — body type, palette, eyes, spikes, AI, and weapons rolled from the floor seed.
- **Tiles / sprites** — dithered pixel textures and creature sprites painted at runtime. No sprite sheets.

## Stack

Vanilla JS + HTML5 canvas + [Vite](https://vite.dev). No engine. Pixel buffer is 320×180, nearest-neighbor scaled.
