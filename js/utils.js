/**
 * Utility functions for color conversion and basic operations
 */

/**
 * Convert hex color to RGB array
 * @param {string} hex - Hex color string (e.g., "#FF0000")
 * @returns {number[]} RGB array [r, g, b]
 */
function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  return [
    parseInt(cleanHex.substr(0, 2), 16),
    parseInt(cleanHex.substr(2, 2), 16),
    parseInt(cleanHex.substr(4, 2), 16),
  ];
}

/**
 * Convert RGB array to hex string
 * @param {number[]} rgb - RGB array [r, g, b]
 * @returns {string} Hex color string
 */
function rgbToHex(rgb) {
  return (
    "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")
  );
}

/**
 * Find the closest color in a palette to the given pixel
 * @param {number[]} pixel - RGB array [r, g, b]
 * @param {number[][]} palette - Array of RGB arrays
 * @returns {number[]} Closest RGB color from palette
 */
// --- Color space helpers (sRGB -> Lab) for perceptual matching ---
// Clamp helper reused internally
function _clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function srgbToLinear(c) {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r, g, b) {
  // Convert sRGB (D65) to XYZ
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  // sRGB to XYZ matrix (D65)
  const x = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  return [x, y, z];
}

function xyzToLab(x, y, z) {
  // D65 reference white
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;
  let xr = x / Xn;
  let yr = y / Yn;
  let zr = z / Zn;

  const eps = 216 / 24389; // 0.008856
  const k = 24389 / 27; // 903.3

  const fx = xr > eps ? Math.cbrt(xr) : (k * xr + 16) / 116;
  const fy = yr > eps ? Math.cbrt(yr) : (k * yr + 16) / 116;
  const fz = zr > eps ? Math.cbrt(zr) : (k * zr + 16) / 116;

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  return [L, a, b];
}

function rgbToLab(rgb) {
  const [r, g, b] = rgb;
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

function deltaE76(lab1, lab2) {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return dL * dL + da * da + db * db; // squared distance is enough for compare
}

// Cache palette conversions to Lab for speed (keyed by reference)
const _paletteLabCache = new WeakMap();

/**
 * Find the closest color in a palette to the given pixel
 * @param {number[]} pixel - RGB array [r, g, b]
 * @param {number[][]} palette - Array of RGB arrays
 * @param {"rgb"|"lab"|"compuphase"} [mode="lab"] - Distance mode
 * @returns {number[]} Closest RGB color from palette
 */
function findClosestColorInPalette(pixel, palette, mode = "lab") {
  if (!palette || palette.length === 0) return [0, 0, 0];

  if (mode === "rgb") {
    let minDistance = Infinity;
    let closestColor = palette[0];
    const pr = pixel[0];
    const pg = pixel[1];
    const pb = pixel[2];
    for (const color of palette) {
      const dr = color[0] - pr;
      const dg = color[1] - pg;
      const db = color[2] - pb;
      const d = dr * dr + dg * dg + db * db;
      if (d < minDistance) {
        minDistance = d;
        closestColor = color;
      }
    }
    return [...closestColor];
  }

  if (mode === "compuphase") {
    let minDistance = Infinity;
    let closestColor = palette[0];
    const pr = pixel[0] | 0;
    const pg = pixel[1] | 0;
    const pb = pixel[2] | 0;
    for (const color of palette) {
      const r = color[0] | 0;
      const g = color[1] | 0;
      const b = color[2] | 0;
      const rmean = (r + pr) >> 1; // integer approx
      const rdiff = r - pr;
      const gdiff = g - pg;
      const bdiff = b - pb;
      // (512 + rmean) * rdiff^2 / 256 + 4 * gdiff^2 + (767 - rmean) * bdiff^2 / 256
      const x = ((512 + rmean) * rdiff * rdiff) >> 8;
      const y = 4 * gdiff * gdiff;
      const z = ((767 - rmean) * bdiff * bdiff) >> 8;
      const d = x + y + z; // no sqrt needed for compare
      if (d < minDistance) {
        minDistance = d;
        closestColor = color;
      }
    }
    return [...closestColor];
  }

  // Default: perceptual Lab
  let labs = _paletteLabCache.get(palette);
  if (!labs) {
    labs = palette.map((c) => rgbToLab(c));
    _paletteLabCache.set(palette, labs);
  }
  const plab = rgbToLab(pixel);
  let minD = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < labs.length; i++) {
    const d = deltaE76(plab, labs[i]);
    if (d < minD) {
      minD = d;
      bestIdx = i;
    }
  }
  return [...palette[bestIdx]];
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Create a 2D array with given dimensions
 * @param {number} width - Width of array
 * @param {number} height - Height of array
 * @param {any} defaultValue - Default value for each element
 * @returns {any[][]} 2D array
 */
function create2DArray(width, height, defaultValue = 0) {
  return Array(height)
    .fill()
    .map(() => Array(width).fill(defaultValue));
}

/**
 * Deep copy a 2D array
 * @param {any[][]} array - 2D array to copy
 * @returns {any[][]} Deep copy of the array
 */
function copy2DArray(array) {
  return array.map((row) => [...row]);
}

export {
  hexToRgb,
  rgbToHex,
  findClosestColorInPalette,
  clamp,
  create2DArray,
  copy2DArray,
};
