export const C = {
  void: "#05040a",
  floorA: "#161222",
  floorB: "#1c1730",
  floorC: "#221c38",
  wall: "#3a2d55",
  wallHi: "#6a548c",
  wallLo: "#1d1530",
  crate: "#8a5a32",
  crateHi: "#c4894a",
  crateLo: "#4a2e18",
  goo: "#1f5a3a",
  gooHi: "#3dff8a",
  portal: "#5ce1ff",
  portal2: "#ff4d9a",
  player: "#7dff9a",
  player2: "#c8ffe0",
  visor: "#5ce1ff",
  outline: "#09070f",
  hp: "#ff4d9a",
  amber: "#ffc857",
  bullet: "#e8ffe9",
  flameLo: "#5a1208",
  flame: "#ff4d1a",
  flameHi: "#ffc857",
  flameCore: "#fff3e0",
  steel: "#d8dde8",
  steelHi: "#f4f7ff",
};

export const GENE_PALETTES = [
  ["#7dff9a", "#1f6a44", "#c8ffe0", "#ff4d9a"],
  ["#ff4d9a", "#7a2048", "#ffb3d4", "#5ce1ff"],
  ["#5ce1ff", "#1a4a6a", "#d4f6ff", "#ffc857"],
  ["#ffc857", "#8a5a12", "#ffe7a8", "#ff4d9a"],
  ["#c77dff", "#4a2870", "#ecd4ff", "#7dff9a"],
  ["#ff7d4d", "#7a3018", "#ffd0be", "#5ce1ff"],
  ["#4dffd0", "#186a58", "#c8fff2", "#ff4d9a"],
  ["#d0ff4d", "#4a6a18", "#f2ffc8", "#c77dff"],
];

const BIOME_GENES = {
  grass: [
    ["#7dff9a", "#2a6a28", "#c8ffe0", "#ffc857"],
    ["#d0ff4d", "#4a6a18", "#f2ffc8", "#ff7d4d"],
    ["#8adb4a", "#3a5a18", "#e0ffb0", "#5ce1ff"],
  ],
  cave: [
    ["#a09888", "#4a4438", "#ddd4c4", "#5ce1ff"],
    ["#8a8274", "#3a3830", "#c8c0b0", "#ffc857"],
    ["#6e7a6a", "#2a3228", "#c0d0c0", "#7dff9a"],
  ],
  lava: [
    ["#ff4d1a", "#7a1808", "#ffc857", "#fff3e0"],
    ["#ff7d4d", "#5a1208", "#ffd0be", "#5ce1ff"],
    ["#ffc857", "#8a2a10", "#fff3e0", "#ff4d9a"],
  ],
  gem: [
    ["#c77dff", "#4a2870", "#ecd4ff", "#5ce1ff"],
    ["#ff4dff", "#6a1060", "#ffb3f4", "#c77dff"],
    ["#5ce1ff", "#281860", "#d4f6ff", "#ff4d9a"],
  ],
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export function biomeOf(floor) {
  if (floor <= 1) return "grass";
  if (floor <= 4) return "cave";
  if (floor <= 9) return "lava";
  return "gem";
}

export function biomeName(floor) {
  const b = biomeOf(floor);
  if (b === "grass") return "SURFACE";
  if (b === "cave") return floor === 2 ? "CAVE MOUTH" : "STONE CRYPT";
  if (b === "lava") return "MAGMA";
  return "GEM HELL";
}

export function themeOf(floor) {
  const biome = biomeOf(floor);
  if (biome === "grass") {
    return {
      biome,
      void: "#1a1814",
      floorA: "#4a8c3a",
      floorB: "#3d7a30",
      floorC: "#5a9a44",
      pebble: "#8a6a40",
      wall: "#6a5e4e",
      wallHi: "#8a7a64",
      wallLo: "#3a3228",
      goo: "#2a5a48",
      gooHi: "#3a7a58",
      portal: "#5ce1ff",
      portal2: "#7dff9a",
      crate: "#b08a4a",
      crateHi: "#d4b06a",
      crateLo: "#6a4a24",
      minimap: "#4a8c3a",
    };
  }
  if (biome === "cave") {
    const t = Math.min(1, (floor - 2) / 2);
    return {
      biome,
      void: mix("#1c1c1e", "#161618", t),
      floorA: mix("#8c8c84", "#7a7a72", t),
      floorB: mix("#7a7a72", "#6a6a64", t),
      floorC: mix("#9a9a92", "#8a8a82", t),
      pebble: mix("#5a5a54", "#4a4a44", t),
      wall: mix("#6e6e68", "#5e5e58", t),
      wallHi: mix("#8a8a82", "#7a7a74", t),
      wallLo: mix("#3c3c38", "#2e2e2c", t),
      goo: mix("#4a6a48", "#3a5a3c", t),
      gooHi: mix("#6a9a58", "#5a8a48", t),
      portal: "#5ce1ff",
      portal2: "#ffc857",
      crate: "#b08a4a",
      crateHi: "#d4b06a",
      crateLo: "#6a4a24",
      minimap: "#8c8c84",
    };
  }
  if (biome === "lava") {
    const t = Math.min(1, (floor - 5) / 4);
    return {
      biome,
      void: mix("#1a0808", "#080204", t),
      floorA: mix("#9a5848", "#7a4038", t),
      floorB: mix("#7a4034", "#5a3028", t),
      floorC: mix("#b06850", "#8a4838", t),
      pebble: mix("#e07038", "#c45020", t),
      wall: mix("#5a3a34", "#4a2e28", t),
      wallHi: mix("#c45a28", "#a44818", t),
      wallLo: mix("#2a1814", "#1e100e", t),
      goo: mix("#ff4d1a", "#8a1008", t),
      gooHi: mix("#ffc857", "#ff7d4d", t),
      portal: "#ff7d4d",
      portal2: "#ffc857",
      crate: "#5a2a18",
      crateHi: "#8a4a28",
      crateLo: "#2a1008",
      minimap: "#ff4d1a",
    };
  }
  const t = Math.min(1, (floor - 10) / 8);
  return {
    biome,
    void: mix("#141820", "#101418", t),
    floorA: mix("#4a5870", "#3e4c64", t),
    floorB: mix("#3a4860", "#323e54", t),
    floorC: mix("#5a6890", "#4e5c80", t),
    pebble: mix("#c090ff", "#a070e0", t),
    wall: mix("#2a3448", "#222a3c", t),
    wallHi: mix("#b080e0", "#9868c8", t),
    wallLo: mix("#1a2030", "#141824", t),
    goo: mix("#6a20a0", "#3a1060", t),
    gooHi: mix("#ff4dff", "#5ce1ff", t),
    portal: "#c77dff",
    portal2: "#ff4d9a",
    crate: "#4a2870",
    crateHi: "#c77dff",
    crateLo: "#1a0c28",
    minimap: "#c77dff",
  };
}

export function pickPalette(rng, biome = "cave") {
  const pool = BIOME_GENES[biome] || GENE_PALETTES;
  const base = rng.pick(pool).slice();
  if (rng.chance(0.35)) {
    const i = rng.int(0, 2);
    const j = rng.int(0, 2);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base;
}
