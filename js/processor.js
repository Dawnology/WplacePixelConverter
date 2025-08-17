/**
 * Main image processor that combines all functionality
 */

import { clamp } from "./utils.js";

/**
 * Convert ImageData to 3D RGB array and 2D alpha array
 * @param {ImageData} imageData - Canvas ImageData
 * @returns {Object} {rgbChannels, alphaChannel}
 */
function imageDataToArrays(imageData) {
  const { width, height, data } = imageData;
  const rgbChannels = [];
  const alphaChannel = [];

  for (let y = 0; y < height; y++) {
    rgbChannels[y] = [];
    alphaChannel[y] = [];

    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      rgbChannels[y][x] = [data[index], data[index + 1], data[index + 2]];
      alphaChannel[y][x] = data[index + 3];
    }
  }

  return { rgbChannels, alphaChannel };
}

/**
 * Convert 3D RGB array and 2D alpha array back to ImageData
 * @param {number[][][]} rgbChannels - 3D RGB array
 * @param {number[][]} alphaChannel - 2D alpha array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {ImageData} Canvas ImageData
 */
function arraysToImageData(rgbChannels, alphaChannel, width, height) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      data[index] = clamp(rgbChannels[y][x][0], 0, 255); // R
      data[index + 1] = clamp(rgbChannels[y][x][1], 0, 255); // G
      data[index + 2] = clamp(rgbChannels[y][x][2], 0, 255); // B
      data[index + 3] = clamp(alphaChannel[y][x], 0, 255); // A
    }
  }

  return new ImageData(data, width, height);
}

/**
 * Count unique colors in processed image
 * @param {ImageData} imageData - Processed image data
 * @param {number} alphaThreshold - Alpha threshold for counting
 * @returns {Map} Map of RGB strings to pixel counts
 */
function countImageColors(imageData, alphaThreshold = 128) {
  const { width, height, data } = imageData;
  const colorCounts = new Map();

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];

    if (alpha >= alphaThreshold) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const colorKey = `${r},${g},${b}`;

      colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
    }
  }

  return colorCounts;
}

/**
 * Get color statistics for UI display
 * @param {ImageData} imageData - Processed image data
 * @param {Object} colorNameMap - Map of hex colors to names
 * @param {number} alphaThreshold - Alpha threshold
 * @returns {Array} Array of color statistics {name, hex, count}
 */
function getColorStatistics(imageData, colorNameMap, alphaThreshold = 128) {
  const colorCounts = countImageColors(imageData, alphaThreshold);
  const stats = [];

  for (const [rgbString, count] of colorCounts) {
    const [r, g, b] = rgbString.split(",").map(Number);
    const hex = `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    const name = colorNameMap?.[hex] || "Unknown";

    stats.push({ name, hex, count });
  }

  // Sort by count (descending)
  stats.sort((a, b) => b.count - a.count);

  return stats;
}

export {
  imageDataToArrays,
  arraysToImageData,
  countImageColors,
  getColorStatistics,
};
