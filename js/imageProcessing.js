/**
 * Image processing utilities for brightness, contrast, saturation, and sharpening
 */

import { clamp } from "./utils.js";

/**
 * Apply brightness adjustment to image data
 * @param {ImageData} imageData - Canvas ImageData object
 * @param {number} brightness - Brightness factor (1.0 = no change)
 * @returns {ImageData} Modified image data
 */
function adjustBrightness(imageData, brightness) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * brightness, 0, 255); // Red
    data[i + 1] = clamp(data[i + 1] * brightness, 0, 255); // Green
    data[i + 2] = clamp(data[i + 2] * brightness, 0, 255); // Blue
    // Alpha channel (i + 3) remains unchanged
  }

  return imageData;
}

/**
 * Apply contrast adjustment to image data
 * @param {ImageData} imageData - Canvas ImageData object
 * @param {number} contrast - Contrast factor (1.0 = no change). Values > 1 increase contrast, < 1 decrease.
 * @returns {ImageData} Modified image data
 */
function adjustContrast(imageData, contrast) {
  const data = imageData.data;
  // Linear contrast around mid-grey (128). This is much less aggressive than the classic
  // -255..255 formula and matches the slider where 1.0 means no change.
  const factor = contrast; // e.g. 1.2 = +20% contrast, 0.8 = -20%

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp((data[i] - 128) * factor + 128, 0, 255); // Red
    data[i + 1] = clamp((data[i + 1] - 128) * factor + 128, 0, 255); // Green
    data[i + 2] = clamp((data[i + 2] - 128) * factor + 128, 0, 255); // Blue
    // Alpha channel (i + 3) remains unchanged
  }

  return imageData;
}

/**
 * Apply saturation adjustment to image data
 * @param {ImageData} imageData - Canvas ImageData object
 * @param {number} saturation - Saturation factor (1.0 = no change, 0.0 = grayscale)
 * @returns {ImageData} Modified image data
 */
function adjustSaturation(imageData, saturation) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Calculate luminance (grayscale value)
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Interpolate between grayscale and original color
    data[i] = clamp(gray + saturation * (r - gray), 0, 255); // Red
    data[i + 1] = clamp(gray + saturation * (g - gray), 0, 255); // Green
    data[i + 2] = clamp(gray + saturation * (b - gray), 0, 255); // Blue
    // Alpha channel (i + 3) remains unchanged
  }

  return imageData;
}

/**
 * Apply sharpening filter to image data
 * @param {ImageData} imageData - Canvas ImageData object
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {ImageData} Sharpened image data
 */
function applySharpen(imageData, width, height) {
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  // Sharpening kernel
  const kernel = [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      let r = 0,
        g = 0,
        b = 0;

      // Apply kernel
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[ky + 1][kx + 1];

          r += data[pixelIdx] * weight;
          g += data[pixelIdx + 1] * weight;
          b += data[pixelIdx + 2] * weight;
        }
      }

      output[idx] = clamp(r, 0, 255);
      output[idx + 1] = clamp(g, 0, 255);
      output[idx + 2] = clamp(b, 0, 255);
      // Alpha remains the same
      output[idx + 3] = data[idx + 3];
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Process image with all adjustments
 * @param {ImageData} imageData - Canvas ImageData object
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} config - Processing configuration
 * @param {number} config.brightness - Brightness factor
 * @param {number} config.contrast - Contrast factor
 * @param {number} config.saturation - Saturation factor
 * @param {boolean} config.useSharpening - Whether to apply sharpening
 * @returns {ImageData} Processed image data
 */
function processImage(imageData, width, height, config) {
  let processedData = imageData;

  // Apply brightness
  if (config.brightness !== 1.0) {
    processedData = adjustBrightness(processedData, config.brightness);
  }

  // Apply contrast
  if (config.contrast !== 1.0) {
    processedData = adjustContrast(processedData, config.contrast);
  }

  // Apply saturation
  if (config.saturation !== 1.0) {
    processedData = adjustSaturation(processedData, config.saturation);
  }

  // Apply sharpening
  if (config.useSharpening) {
    processedData = applySharpen(processedData, width, height);
  }

  return processedData;
}

export {
  adjustBrightness,
  adjustContrast,
  adjustSaturation,
  applySharpen,
  processImage,
};
