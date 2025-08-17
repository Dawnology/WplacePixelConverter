/**
 * Color palette definitions and utilities
 */

import { hexToRgb } from "./utils.js";

// Free palette colors (31 colors)
const FREE_PALETTE_COLORS = [
  "#000000",
  "#3c3c3c",
  "#787878",
  "#d2d2d2",
  "#ffffff",
  "#600018",
  "#ed1c24",
  "#ff7f27",
  "#f6aa09",
  "#f9dd3b",
  "#fffabc",
  "#0eb968",
  "#13e67b",
  "#87ff5e",
  "#0c816e",
  "#10aea6",
  "#13e1be",
  "#28509e",
  "#4093e4",
  "#60f7f2",
  "#6b50f6",
  "#99b1fb",
  "#780c99",
  "#aa38b9",
  "#e09ff9",
  "#cb007a",
  "#ec1f80",
  "#f38da9",
  "#684634",
  "#95682a",
  "#f8b277",
];

// Color names for free palette
const FREE_COLOR_NAMES = {
  "#000000": "Black",
  "#3c3c3c": "Dark Gray",
  "#787878": "Gray",
  "#d2d2d2": "Light Gray",
  "#ffffff": "White",
  "#600018": "Deep Red",
  "#ed1c24": "Red",
  "#ff7f27": "Orange",
  "#f6aa09": "Yellow",
  "#f9dd3b": "Light Yellow",
  "#fffabc": "Pale Yellow",
  "#0eb968": "Dark Green",
  "#13e67b": "Green",
  "#87ff5e": "Light Green",
  "#0c816e": "Dark Teal",
  "#10aea6": "Teal",
  "#13e1be": "Light Teal",
  "#28509e": "Dark Blue",
  "#4093e4": "Blue",
  "#60f7f2": "Cyan",
  "#6b50f6": "Indigo",
  "#99b1fb": "Light Indigo",
  "#780c99": "Dark Purple",
  "#aa38b9": "Purple",
  "#e09ff9": "Light Purple",
  "#cb007a": "Dark Pink",
  "#ec1f80": "Pink",
  "#f38da9": "Light Pink",
  "#684634": "Dark Brown",
  "#95682a": "Brown",
  "#f8b277": "Beige",
};

// Additional colors for full palette
const EXTRA_PALETTE_COLORS = [
  "#aaaaaa",
  "#a50e1e",
  "#fa8072",
  "#e45c1a",
  "#9c8431",
  "#c5ad31",
  "#e8d45f",
  "#4a6b3a",
  "#5a944a",
  "#84c573",
  "#0f799f",
  "#bbfaf2",
  "#7dc7ff",
  "#4d31b8",
  "#4a4284",
  "#7a71c4",
  "#b5aef1",
  "#9b5249",
  "#d18078",
  "#fab6a4",
  "#dba463",
  "#7b6352",
  "#9c846b",
  "#d6b594",
  "#d18051",
  "#ffc5a5",
  "#6d643f",
  "#948c6b",
  "#cdc59e",
  "#333941",
  "#6d758d",
  "#b3b9d1",
];

// Color names for extra palette
const EXTRA_COLOR_NAMES = {
  "#aaaaaa": "Medium Gray",
  "#a50e1e": "Dark Red",
  "#fa8072": "Light Red",
  "#e45c1a": "Dark Orange",
  "#9c8431": "Dark Goldenrod",
  "#c5ad31": "Goldenrod",
  "#e8d45f": "Light Goldenrod",
  "#4a6b3a": "Dark Olive",
  "#5a944a": "Olive",
  "#84c573": "Light Olive",
  "#0f799f": "Dark Cyan",
  "#bbfaf2": "Light Cyan",
  "#7dc7ff": "Light Blue",
  "#4d31b8": "Dark Indigo",
  "#4a4284": "Dark Slate Blue",
  "#7a71c4": "Slate Blue",
  "#b5aef1": "Light Slate Blue",
  "#9b5249": "Dark Peach",
  "#d18078": "Peach",
  "#fab6a4": "Light Peach",
  "#dba463": "Light Brown",
  "#7b6352": "Dark Tan",
  "#9c846b": "Tan",
  "#d6b594": "Light Tan",
  "#d18051": "Dark Beige",
  "#ffc5a5": "Light Beige",
  "#6d643f": "Dark Stone",
  "#948c6b": "Stone",
  "#cdc59e": "Light Stone",
  "#333941": "Dark Slate",
  "#6d758d": "Slate",
  "#b3b9d1": "Light Slate",
};

// Full palette (free + extra)
const FULL_PALETTE_COLORS = [...FREE_PALETTE_COLORS, ...EXTRA_PALETTE_COLORS];
const ALL_COLOR_NAMES = { ...FREE_COLOR_NAMES, ...EXTRA_COLOR_NAMES };

/**
 * Get palette as RGB arrays
 * @param {string[]} hexColors - Array of hex color strings
 * @returns {number[][]} Array of RGB arrays
 */
function getPaletteAsRgb(hexColors) {
  return hexColors.map((hex) => hexToRgb(hex));
}

/**
 * Get color name from hex
 * @param {string} hex - Hex color string
 * @returns {string} Color name or "Unknown"
 */
function getColorName(hex) {
  return ALL_COLOR_NAMES[hex] || "Unknown";
}

/**
 * Create a custom palette from selected colors
 * @param {string[]} selectedColors - Array of selected hex colors
 * @returns {string[]} Custom palette
 */
function createCustomPalette(selectedColors) {
  return selectedColors.length > 0 ? selectedColors : ["#000000", "#ffffff"];
}

export {
  FREE_PALETTE_COLORS,
  FULL_PALETTE_COLORS,
  FREE_COLOR_NAMES,
  ALL_COLOR_NAMES,
  getPaletteAsRgb,
  getColorName,
  createCustomPalette,
};
