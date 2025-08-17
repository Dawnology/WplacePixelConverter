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
function findClosestColorInPalette(pixel, palette) {
  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const color of palette) {
    const distance =
      Math.pow(color[0] - pixel[0], 2) +
      Math.pow(color[1] - pixel[1], 2) +
      Math.pow(color[2] - pixel[2], 2);

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return [...closestColor];
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
