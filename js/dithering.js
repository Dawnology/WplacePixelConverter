// Dithering algorithms implementation

import { findClosestColorInPalette, clamp } from "./utils.js";

/**
 * Apply Floyd–Steinberg dithering with optional serpentine scanning
 * @param {number[][][]} rgbChannels - [y][x][3]
 * @param {number[][]} alphaChannel - [y][x]
 * @param {number[][]} palette - Array of [r,g,b]
 * @param {number} strength - 0.1..1.0
 * @param {number} alphaThreshold - 0..255
 * @param {(p:number)=>void} progressCallback
 * @param {boolean} serpentine
 * @returns {number[][][]} dithered [y][x][3]
 */
function applyFloydSteinbergDithering(
  rgbChannels,
  alphaChannel,
  palette,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const h = rgbChannels.length;
  const w = rgbChannels[0].length;
  const out = rgbChannels.map((row) => row.map((p) => [...p]));
  const reportEvery = Math.max(1, Math.floor(h / 50));

  for (let y = 0; y < h; y++) {
    const leftToRight = serpentine ? y % 2 === 0 : true;
    const xStart = leftToRight ? 0 : w - 1;
    const xEnd = leftToRight ? w : -1;
    const xStep = leftToRight ? 1 : -1;

    for (let x = xStart; x !== xEnd; x += xStep) {
      if (alphaChannel[y][x] < alphaThreshold) continue;
      const oldP = out[y][x];
      const newP = findClosestColorInPalette(oldP, palette);
      const err = [
        (oldP[0] - newP[0]) * strength,
        (oldP[1] - newP[1]) * strength,
        (oldP[2] - newP[2]) * strength,
      ];
      out[y][x] = [...newP];

      const neigh = leftToRight
        ? [
            { dx: 1, dy: 0, w: 7 / 16 },
            { dx: -1, dy: 1, w: 3 / 16 },
            { dx: 0, dy: 1, w: 5 / 16 },
            { dx: 1, dy: 1, w: 1 / 16 },
          ]
        : [
            { dx: -1, dy: 0, w: 7 / 16 },
            { dx: 1, dy: 1, w: 3 / 16 },
            { dx: 0, dy: 1, w: 5 / 16 },
            { dx: -1, dy: 1, w: 1 / 16 },
          ];

      for (const n of neigh) {
        const nx = x + n.dx;
        const ny = y + n.dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (alphaChannel[ny][nx] < alphaThreshold) continue;
        const p = out[ny][nx];
        out[ny][nx] = [
          clamp(p[0] + err[0] * n.w, 0, 255),
          clamp(p[1] + err[1] * n.w, 0, 255),
          clamp(p[2] + err[2] * n.w, 0, 255),
        ];
      }
    }

    if (progressCallback && y % reportEvery === 0) {
      progressCallback((y + 1) / h);
    }
  }

  if (progressCallback) progressCallback(1);
  return out;
}

/** Simple ordered Bayer 4x4 dithering */
function applyBayerDithering(
  rgbChannels,
  alphaChannel,
  palette,
  intensity = 32,
  alphaThreshold = 128,
  progressCallback = null
) {
  const mat = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const norm = mat.map((r) => r.map((v) => v / 16 - 0.5));
  const h = rgbChannels.length;
  const w = rgbChannels[0].length;
  const out = rgbChannels.map((row) => row.map((p) => [...p]));
  const scale = intensity / 255;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaChannel[y][x] < alphaThreshold) continue;
      const t = norm[y % 4][x % 4] * scale * 255;
      const p = out[y][x];
      const adjusted = [p[0] + t, p[1] + t, p[2] + t];
      out[y][x] = findClosestColorInPalette(adjusted, palette);
    }
    if (progressCallback && y % 25 === 0) progressCallback((y + 1) / h);
  }
  if (progressCallback) progressCallback(1);
  return out;
}

/** Random noise dithering */
function applyRandomDithering(
  rgbChannels,
  alphaChannel,
  palette,
  intensity = 32,
  alphaThreshold = 128,
  progressCallback = null
) {
  const h = rgbChannels.length;
  const w = rgbChannels[0].length;
  const out = rgbChannels.map((row) => row.map((p) => [...p]));
  const range = intensity;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaChannel[y][x] < alphaThreshold) continue;
      const p = out[y][x];
      const noise = () => (Math.random() * 2 - 1) * range;
      const perturbed = [p[0] + noise(), p[1] + noise(), p[2] + noise()];
      out[y][x] = findClosestColorInPalette(perturbed, palette);
    }
  }
  if (progressCallback) progressCallback(1);
  return out;
}

/** Quantize without dithering */
function applyNoDithering(
  rgbChannels,
  alphaChannel,
  palette,
  alphaThreshold = 128,
  progressCallback = null
) {
  const h = rgbChannels.length;
  const w = rgbChannels[0].length;
  const out = rgbChannels.map((row) => row.map((p) => [...p]));
  const reportEvery = Math.max(1, Math.floor(h / 50));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaChannel[y][x] < alphaThreshold) continue;
      out[y][x] = findClosestColorInPalette(out[y][x], palette);
    }
    if (progressCallback && y % reportEvery === 0)
      progressCallback((y + 1) / h);
  }
  if (progressCallback) progressCallback(1);
  return out;
}

// Error-diffusion helpers
function errorDiffuse(
  rgbChannels,
  alphaChannel,
  palette,
  weightsRight,
  weightsLeft,
  denom,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const h = rgbChannels.length;
  const w = rgbChannels[0].length;
  const out = rgbChannels.map((row) => row.map((p) => [...p]));
  const reportEvery = Math.max(1, Math.floor(h / 50));

  for (let y = 0; y < h; y++) {
    const leftToRight = serpentine ? y % 2 === 0 : true;
    const xStart = leftToRight ? 0 : w - 1;
    const xEnd = leftToRight ? w : -1;
    const xStep = leftToRight ? 1 : -1;
    const neigh = leftToRight ? weightsRight : weightsLeft;

    for (let x = xStart; x !== xEnd; x += xStep) {
      if (alphaChannel[y][x] < alphaThreshold) continue;
      const oldP = out[y][x];
      const newP = findClosestColorInPalette(oldP, palette);
      const err = [
        ((oldP[0] - newP[0]) * strength) / denom,
        ((oldP[1] - newP[1]) * strength) / denom,
        ((oldP[2] - newP[2]) * strength) / denom,
      ];
      out[y][x] = [...newP];

      for (const n of neigh) {
        const nx = x + n.dx;
        const ny = y + n.dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (alphaChannel[ny][nx] < alphaThreshold) continue;
        const p = out[ny][nx];
        out[ny][nx] = [
          clamp(p[0] + err[0] * n.w, 0, 255),
          clamp(p[1] + err[1] * n.w, 0, 255),
          clamp(p[2] + err[2] * n.w, 0, 255),
        ];
      }
    }

    if (progressCallback && y % reportEvery === 0) {
      progressCallback((y + 1) / h);
    }
  }
  if (progressCallback) progressCallback(1);
  return out;
}

function applyJarvisDithering(
  rgbChannels,
  alphaChannel,
  palette,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const right = [
    { dx: 1, dy: 0, w: 7 },
    { dx: 2, dy: 0, w: 5 },
    { dx: -2, dy: 1, w: 3 },
    { dx: -1, dy: 1, w: 5 },
    { dx: 0, dy: 1, w: 7 },
    { dx: 1, dy: 1, w: 5 },
    { dx: 2, dy: 1, w: 3 },
    { dx: -2, dy: 2, w: 1 },
    { dx: -1, dy: 2, w: 3 },
    { dx: 0, dy: 2, w: 5 },
    { dx: 1, dy: 2, w: 3 },
    { dx: 2, dy: 2, w: 1 },
  ];
  const left = right.map((n) => ({ dx: -n.dx, dy: n.dy, w: n.w }));
  return errorDiffuse(
    rgbChannels,
    alphaChannel,
    palette,
    right,
    left,
    48,
    strength,
    alphaThreshold,
    progressCallback,
    serpentine
  );
}

function applyStuckiDithering(
  rgbChannels,
  alphaChannel,
  palette,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const right = [
    { dx: 1, dy: 0, w: 8 },
    { dx: 2, dy: 0, w: 4 },
    { dx: -2, dy: 1, w: 2 },
    { dx: -1, dy: 1, w: 4 },
    { dx: 0, dy: 1, w: 8 },
    { dx: 1, dy: 1, w: 4 },
    { dx: 2, dy: 1, w: 2 },
    { dx: -2, dy: 2, w: 1 },
    { dx: -1, dy: 2, w: 2 },
    { dx: 0, dy: 2, w: 4 },
    { dx: 1, dy: 2, w: 2 },
    { dx: 2, dy: 2, w: 1 },
  ];
  const left = right.map((n) => ({ dx: -n.dx, dy: n.dy, w: n.w }));
  return errorDiffuse(
    rgbChannels,
    alphaChannel,
    palette,
    right,
    left,
    42,
    strength,
    alphaThreshold,
    progressCallback,
    serpentine
  );
}

function applyBurkesDithering(
  rgbChannels,
  alphaChannel,
  palette,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const right = [
    { dx: 1, dy: 0, w: 8 },
    { dx: 2, dy: 0, w: 4 },
    { dx: -2, dy: 1, w: 2 },
    { dx: -1, dy: 1, w: 4 },
    { dx: 0, dy: 1, w: 8 },
    { dx: 1, dy: 1, w: 4 },
    { dx: 2, dy: 1, w: 2 },
  ];
  const left = right.map((n) => ({ dx: -n.dx, dy: n.dy, w: n.w }));
  return errorDiffuse(
    rgbChannels,
    alphaChannel,
    palette,
    right,
    left,
    32,
    strength,
    alphaThreshold,
    progressCallback,
    serpentine
  );
}

function applyAtkinsonDithering(
  rgbChannels,
  alphaChannel,
  palette,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const right = [
    { dx: 1, dy: 0, w: 1 },
    { dx: 2, dy: 0, w: 1 },
    { dx: -1, dy: 1, w: 1 },
    { dx: 0, dy: 1, w: 1 },
    { dx: 1, dy: 1, w: 1 },
    { dx: 0, dy: 2, w: 1 },
  ];
  const left = right.map((n) => ({ dx: -n.dx, dy: n.dy, w: n.w }));
  return errorDiffuse(
    rgbChannels,
    alphaChannel,
    palette,
    right,
    left,
    8,
    strength,
    alphaThreshold,
    progressCallback,
    serpentine
  );
}

function applySierraLiteDithering(
  rgbChannels,
  alphaChannel,
  palette,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const right = [
    { dx: 1, dy: 0, w: 2 },
    { dx: -1, dy: 1, w: 1 },
    { dx: 0, dy: 1, w: 1 },
  ];
  const left = right.map((n) => ({ dx: -n.dx, dy: n.dy, w: n.w }));
  return errorDiffuse(
    rgbChannels,
    alphaChannel,
    palette,
    right,
    left,
    4,
    strength,
    alphaThreshold,
    progressCallback,
    serpentine
  );
}

function applySierra2Dithering(
  rgbChannels,
  alphaChannel,
  palette,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const right = [
    { dx: 1, dy: 0, w: 4 },
    { dx: 2, dy: 0, w: 3 },
    { dx: -2, dy: 1, w: 1 },
    { dx: -1, dy: 1, w: 2 },
    { dx: 0, dy: 1, w: 3 },
    { dx: 1, dy: 1, w: 2 },
    { dx: 2, dy: 1, w: 1 },
  ];
  const left = right.map((n) => ({ dx: -n.dx, dy: n.dy, w: n.w }));
  return errorDiffuse(
    rgbChannels,
    alphaChannel,
    palette,
    right,
    left,
    16,
    strength,
    alphaThreshold,
    progressCallback,
    serpentine
  );
}

function applySierra3Dithering(
  rgbChannels,
  alphaChannel,
  palette,
  strength = 1.0,
  alphaThreshold = 128,
  progressCallback = null,
  serpentine = false
) {
  const right = [
    { dx: 1, dy: 0, w: 5 },
    { dx: 2, dy: 0, w: 3 },
    { dx: -2, dy: 1, w: 2 },
    { dx: -1, dy: 1, w: 4 },
    { dx: 0, dy: 1, w: 5 },
    { dx: 1, dy: 1, w: 4 },
    { dx: 2, dy: 1, w: 2 },
    { dx: -1, dy: 2, w: 2 },
    { dx: 0, dy: 2, w: 3 },
    { dx: 1, dy: 2, w: 2 },
  ];
  const left = right.map((n) => ({ dx: -n.dx, dy: n.dy, w: n.w }));
  return errorDiffuse(
    rgbChannels,
    alphaChannel,
    palette,
    right,
    left,
    32,
    strength,
    alphaThreshold,
    progressCallback,
    serpentine
  );
}

// Halftone (8x8 ordered) dithering
function applyHalftoneDithering(
  rgbChannels,
  alphaChannel,
  palette,
  intensity = 64,
  alphaThreshold = 128,
  progressCallback = null
) {
  const mat = [
    [24, 3, 19, 8, 25, 4, 20, 9],
    [12, 43, 52, 35, 11, 44, 53, 36],
    [18, 51, 60, 42, 17, 50, 59, 41],
    [7, 34, 40, 58, 6, 33, 39, 57],
    [26, 5, 21, 10, 27, 2, 22, 1],
    [13, 45, 54, 37, 14, 46, 55, 38],
    [16, 49, 58, 40, 15, 48, 57, 39],
    [1, 32, 38, 56, 0, 31, 37, 55],
  ];
  const norm = mat.map((r) => r.map((v) => v / 64 - 0.5));
  const h = rgbChannels.length;
  const w = rgbChannels[0].length;
  const out = rgbChannels.map((row) => row.map((p) => [...p]));
  const scale = intensity / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaChannel[y][x] < alphaThreshold) continue;
      const t = norm[y % 8][x % 8] * scale * 255;
      const p = out[y][x];
      const adjusted = [p[0] + t, p[1] + t, p[2] + t];
      out[y][x] = findClosestColorInPalette(adjusted, palette);
    }
    if (progressCallback && y % 25 === 0) progressCallback((y + 1) / h);
  }
  if (progressCallback) progressCallback(1);
  return out;
}

export {
  applyFloydSteinbergDithering,
  applyJarvisDithering,
  applyStuckiDithering,
  applyAtkinsonDithering,
  applyBurkesDithering,
  applySierraLiteDithering,
  applySierra2Dithering,
  applySierra3Dithering,
  applyBayerDithering,
  applyHalftoneDithering,
  applyRandomDithering,
  applyNoDithering,
};
