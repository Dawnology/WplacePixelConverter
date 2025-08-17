/**
 * Preview and display utilities for canvas rendering
 */

/**
 * Create a canvas with grid overlay
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {ImageData} imageData - Image data to display
 * @param {Object} options - Display options
 * @param {boolean} options.showGrid - Whether to show grid
 * @param {number} options.gridSize - Grid size in pixels
 * @param {number} options.zoom - Zoom factor
 * @param {number} options.offsetX - X offset for panning
 * @param {number} options.offsetY - Y offset for panning
 */
function displayImageWithGrid(canvas, imageData, options = {}) {
  const ctx = canvas.getContext("2d");
  const {
    showGrid = false,
    gridSize = 128,
    zoom = 1,
    offsetX = 0,
    offsetY = 0,
  } = options;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Save context state
  ctx.save();

  // Apply zoom and pan
  ctx.scale(zoom, zoom);
  ctx.translate(-offsetX / zoom, -offsetY / zoom);

  // Draw image
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0);

  // Draw grid if enabled
  if (showGrid && gridSize > 0 && zoom * gridSize > 4) {
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 1 / zoom;

    // Vertical lines
    for (let x = 0; x <= imageData.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, imageData.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= imageData.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(imageData.width, y);
      ctx.stroke();
    }
  }

  // Restore context state
  ctx.restore();
}

/**
 * Fit image to canvas while maintaining aspect ratio
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @returns {Object} Scaling and positioning information
 */
function fitImageToCanvas(imageWidth, imageHeight, canvasWidth, canvasHeight) {
  const imageAspect = imageWidth / imageHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let scale, x, y, width, height;

  if (imageAspect > canvasAspect) {
    // Image is wider than canvas
    scale = canvasWidth / imageWidth;
    width = canvasWidth;
    height = imageHeight * scale;
    x = 0;
    y = (canvasHeight - height) / 2;
  } else {
    // Image is taller than canvas
    scale = canvasHeight / imageHeight;
    width = imageWidth * scale;
    height = canvasHeight;
    x = (canvasWidth - width) / 2;
    y = 0;
  }

  return { scale, x, y, width, height };
}

/**
 * Convert canvas to downloadable blob
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {string} format - Image format ('image/png', 'image/jpeg', etc.)
 * @param {number} quality - Image quality (0-1, for JPEG)
 * @returns {Promise<Blob>} Promise resolving to image blob
 */
function canvasToBlob(canvas, format = "image/png", quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, format, quality);
  });
}

/**
 * Download canvas as image file
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {string} filename - Filename for download
 * @param {string} format - Image format
 */
async function downloadCanvas(canvas, filename, format = "image/png") {
  const blob = await canvasToBlob(canvas, format);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Create image segments for large images
 * @param {ImageData} imageData - Source image data
 * @param {number} segmentSize - Size of each segment (e.g., 128x128)
 * @returns {Array} Array of segment data {imageData, x, y, filename}
 */
function createImageSegments(imageData, segmentSize = 128) {
  const segments = [];
  const { width, height, data } = imageData;

  for (let y = 0; y < height; y += segmentSize) {
    for (let x = 0; x < width; x += segmentSize) {
      const segmentWidth = Math.min(segmentSize, width - x);
      const segmentHeight = Math.min(segmentSize, height - y);

      const segmentData = new Uint8ClampedArray(
        segmentWidth * segmentHeight * 4
      );

      for (let sy = 0; sy < segmentHeight; sy++) {
        for (let sx = 0; sx < segmentWidth; sx++) {
          const sourceIndex = ((y + sy) * width + (x + sx)) * 4;
          const targetIndex = (sy * segmentWidth + sx) * 4;

          segmentData[targetIndex] = data[sourceIndex]; // R
          segmentData[targetIndex + 1] = data[sourceIndex + 1]; // G
          segmentData[targetIndex + 2] = data[sourceIndex + 2]; // B
          segmentData[targetIndex + 3] = data[sourceIndex + 3]; // A
        }
      }

      const segmentImageData = new ImageData(
        segmentData,
        segmentWidth,
        segmentHeight
      );
      const filename = `segment_${Math.floor(y / segmentSize)}_${Math.floor(
        x / segmentSize
      )}.png`;

      segments.push({
        imageData: segmentImageData,
        x,
        y,
        filename,
      });
    }
  }

  return segments;
}

/**
 * Handle mouse wheel zoom on canvas
 * @param {WheelEvent} event - Mouse wheel event
 * @param {Object} viewState - Current view state
 * @param {Function} updateCallback - Callback to update display
 */
function handleCanvasZoom(event, viewState, updateCallback) {
  event.preventDefault();

  const rect = event.target.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.1, Math.min(viewState.zoom * zoomFactor, 20));

  // Calculate new offset to zoom towards mouse position
  const offsetX =
    mouseX - (mouseX - viewState.offsetX) * (newZoom / viewState.zoom);
  const offsetY =
    mouseY - (mouseY - viewState.offsetY) * (newZoom / viewState.zoom);

  viewState.zoom = newZoom;
  viewState.offsetX = offsetX;
  viewState.offsetY = offsetY;

  if (updateCallback) {
    updateCallback();
  }
}

/**
 * Handle mouse pan on canvas
 * @param {MouseEvent} event - Mouse event
 * @param {Object} viewState - Current view state
 * @param {Object} panState - Pan state tracking
 * @param {Function} updateCallback - Callback to update display
 */
function handleCanvasPan(event, viewState, panState, updateCallback) {
  if (panState.isPanning) {
    const deltaX = event.clientX - panState.lastX;
    const deltaY = event.clientY - panState.lastY;

    viewState.offsetX -= deltaX;
    viewState.offsetY -= deltaY;

    panState.lastX = event.clientX;
    panState.lastY = event.clientY;

    if (updateCallback) {
      updateCallback();
    }
  }
}

export {
  displayImageWithGrid,
  fitImageToCanvas,
  canvasToBlob,
  downloadCanvas,
  createImageSegments,
  handleCanvasZoom,
  handleCanvasPan,
};
