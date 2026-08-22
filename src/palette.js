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

export const WORLDS = ["grass", "cave", "lava", "slime", "ocean", "dark", "gem"];

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
    ["#6a5440", "#241810", "#e0d0b8", "#5ce1ff"],
    ["#c45a38", "#3a140c", "#ffd0be", "#ffc857"],
    ["#3a6a52", "#102418", "#c8f0d8", "#7dff9a"],
  ],
  lava: [
    ["#ff4d1a", "#7a1808", "#ffc857", "#fff3e0"],
    ["#ff7d4d", "#5a1208", "#ffd0be", "#5ce1ff"],
    ["#ffc857", "#8a2a10", "#fff3e0", "#ff4d9a"],
  ],
  slime: [
    ["#7dff4d", "#2a6a18", "#d4ffb0", "#ff4d9a"],
    ["#4dff8a", "#186a38", "#c8ffe0", "#ffc857"],
    ["#c8ff4d", "#4a6a10", "#f2ffc8", "#5ce1ff"],
  ],
  ocean: [
    ["#5ce1ff", "#184868", "#d4f6ff", "#ffc857"],
    ["#4d8aff", "#102848", "#b0d4ff", "#ff4d9a"],
    ["#4dffd0", "#186058", "#c8fff2", "#ff7d4d"],
  ],
  gem: [
    ["#c77dff", "#4a2870", "#ecd4ff", "#5ce1ff"],
    ["#ff4dff", "#6a1060", "#ffb3f4", "#c77dff"],
    ["#5ce1ff", "#281860", "#d4f6ff", "#ff4d9a"],
  ],
  dark: [
    ["#6a6880", "#181820", "#c8c8d8", "#5ce1ff"],
    ["#ff4d9a", "#2a1020", "#ffb3d4", "#c77dff"],
    ["#3a3a48", "#0c0c12", "#8a8a98", "#ffc857"],
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
  const i = Math.min(WORLDS.length - 1, Math.max(0, Math.floor((floor - 1) / 3)));
  return WORLDS[i];
}

export function worldSlot(floor) {
  return ((Math.max(1, floor) - 1) % 3) + 1;
}

export function isBossFloor(floor) {
  return floor > 0 && floor % 3 === 0;
}

export function bossTier(floor) {
  if (!isBossFloor(floor)) return 0;
  return floor / 3;
}

export function bossTitle(floor) {
  const b = biomeOf(floor);
  if (b === "grass") return "ROOT";
  if (b === "cave") return "BRUTE";
  if (b === "lava") return "CORE";
  if (b === "slime") return "KING SLIME";
  if (b === "ocean") return "LEVIATHAN";
  if (b === "gem") return "PRISM";
  return "WARDEN";
}

export function biomeName(floor) {
  const b = biomeOf(floor);
  const slot = worldSlot(floor);
  if (b === "grass") return slot === 1 ? "SURFACE" : slot === 2 ? "MEADOW" : "GROVE";
  if (b === "cave") return slot === 1 ? "CAVE MOUTH" : slot === 2 ? "STONE CRYPT" : "BOSS CRYPT";
  if (b === "lava") return "MAGMA";
  if (b === "slime") return "SLIME HELL";
  if (b === "ocean") return slot === 3 ? "TRENCH" : "ABYSS";
  if (b === "gem") return "GEM HELL";
  return "DEEP DARK";
}

export function worldStart(biome) {
  const i = WORLDS.indexOf(biome);
  return i < 0 ? 1 : i * 3 + 1;
}

export function themeOf(floor) {
  const biome = biomeOf(floor);
  const t = (worldSlot(floor) - 1) / 2;
  if (biome === "grass") {
    return {
      biome,
      void: "#141210",
      floorA: "#2f5c28",
      floorB: "#244820",
      floorC: "#3a6a32",
      pebble: "#5a3e24",
      wall: "#4a3a28",
      wallHi: "#5c4a32",
      wallLo: "#2a1e14",
      goo: "#1e4a32",
      gooHi: "#2e6a40",
      portal: "#5ce1ff",
      portal2: "#7dff9a",
      crate: "#8a6230",
      crateHi: "#a87a40",
      crateLo: "#4a3018",
      minimap: "#2f5c28",
    };
  }
  if (biome === "cave") {
    return {
      biome,
      void: mix("#18181a", "#141416", t),
      floorA: mix("#8e8a82", "#848078", t),
      floorB: mix("#7a766e", "#706c64", t),
      floorC: mix("#9a968c", "#908c84", t),
      pebble: mix("#5a564e", "#504c46", t),
      wall: mix("#3e3c3a", "#363432", t),
      wallHi: mix("#54504c", "#4a4642", t),
      wallLo: mix("#2a2826", "#242220", t),
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
    return {
      biome,
      void: mix("#140808", "#0e0404", t),
      floorA: mix("#7a3830", "#6e322c", t),
      floorB: mix("#5c2824", "#522420", t),
      floorC: mix("#8a4840", "#7e4038", t),
      pebble: mix("#c45a28", "#b44e20", t),
      wall: mix("#241210", "#1e0e0c", t),
      wallHi: mix("#3a2018", "#341c16", t),
      wallLo: mix("#160a08", "#120806", t),
      goo: mix("#c45a38", "#8a2818", t),
      gooHi: mix("#e09050", "#c45830", t),
      portal: "#ff7d4d",
      portal2: "#ffc857",
      crate: "#5a2a18",
      crateHi: "#8a4a28",
      crateLo: "#2a1008",
      minimap: "#ff4d1a",
    };
  }
  if (biome === "slime") {
    return {
      biome,
      void: mix("#0c1808", "#081208", t),
      floorA: mix("#3a6a28", "#326022", t),
      floorB: mix("#2a521c", "#244818", t),
      floorC: mix("#4a7a32", "#42702c", t),
      pebble: mix("#7dff4d", "#6ae040", t),
      wall: mix("#1a3014", "#162810", t),
      wallHi: mix("#2a4820", "#24401c", t),
      wallLo: mix("#0e1c0a", "#0a1608", t),
      goo: mix("#5dff4d", "#3ad030", t),
      gooHi: mix("#c8ff80", "#8aff50", t),
      portal: "#7dff9a",
      portal2: "#d0ff4d",
      crate: "#4a6a18",
      crateHi: "#8adb4a",
      crateLo: "#243010",
      minimap: "#7dff4d",
    };
  }
  if (biome === "ocean") {
    return {
      biome,
      void: mix("#061018", "#040c14", t),
      floorA: mix("#1a3a58", "#16324e", t),
      floorB: mix("#142c48", "#102440", t),
      floorC: mix("#245070", "#1c4868", t),
      pebble: mix("#5ce1ff", "#4ac8e8", t),
      wall: mix("#0c1828", "#0a1422", t),
      wallHi: mix("#183048", "#14283e", t),
      wallLo: mix("#08101a", "#060c14", t),
      goo: mix("#2a80c8", "#1a68b0", t),
      gooHi: mix("#7ad4ff", "#5ce1ff", t),
      portal: "#5ce1ff",
      portal2: "#4dffd0",
      crate: "#2a4860",
      crateHi: "#5a88a8",
      crateLo: "#102030",
      minimap: "#5ce1ff",
    };
  }
  if (biome === "gem") {
    return {
      biome,
      void: mix("#101018", "#0c0c14", t),
      floorA: mix("#3a3a58", "#323250", t),
      floorB: mix("#2e2e4a", "#282844", t),
      floorC: mix("#484868", "#404060", t),
      pebble: mix("#c090ff", "#a070e0", t),
      wall: mix("#1a1a30", "#16162a", t),
      wallHi: mix("#2a2a48", "#242440", t),
      wallLo: mix("#10101c", "#0c0c16", t),
      goo: mix("#6a20a0", "#3a1060", t),
      gooHi: mix("#ff4dff", "#c77dff", t),
      portal: "#c77dff",
      portal2: "#ff4d9a",
      crate: "#4a2870",
      crateHi: "#c77dff",
      crateLo: "#1a0c28",
      minimap: "#c77dff",
    };
  }
  return {
    biome,
    void: mix("#08080c", "#040408", t),
    floorA: mix("#1c1c24", "#16161e", t),
    floorB: mix("#14141c", "#101018", t),
    floorC: mix("#262630", "#20202a", t),
    pebble: mix("#5ce1ff", "#3a3a48", t),
    wall: mix("#0c0c12", "#08080e", t),
    wallHi: mix("#1a1a22", "#14141c", t),
    wallLo: mix("#06060a", "#040408", t),
    goo: mix("#2a1020", "#1a0a14", t),
    gooHi: mix("#ff4d9a", "#c77dff", t),
    portal: "#5ce1ff",
    portal2: "#ff4d9a",
    crate: "#2a2a38",
    crateHi: "#5a5a70",
    crateLo: "#101018",
    minimap: "#3a3a48",
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
