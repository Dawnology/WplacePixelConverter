import {
  FREE_PALETTE_COLORS,
  FULL_PALETTE_COLORS,
  getPaletteAsRgb,
  ALL_COLOR_NAMES,
} from "./colors.js";
import { processImage } from "./imageProcessing.js";
import { displayImageWithGrid, downloadCanvas } from "./preview.js";
import {
  applyFloydSteinbergDithering,
  applyNoDithering,
  applyBayerDithering,
  applyRandomDithering,
  applyJarvisDithering,
  applyStuckiDithering,
  applyAtkinsonDithering,
  applyBurkesDithering,
  applySierraLiteDithering,
  applySierra2Dithering,
  applySierra3Dithering,
  applyHalftoneDithering,
} from "./dithering.js";
import {
  imageDataToArrays,
  arraysToImageData,
  getColorStatistics,
} from "./processor.js";

const els = {
  fileInput: document.getElementById("fileInput"),
  paletteType: document.getElementById("paletteType"),
  customizePaletteBtn: document.getElementById("customizePaletteBtn"),
  ditherMethod: document.getElementById("ditherMethod"),
  strength: document.getElementById("strength"),
  strengthVal: document.getElementById("strengthVal"),
  serpentine: document.getElementById("serpentine"),
  brightness: document.getElementById("brightness"),
  brightnessVal: document.getElementById("brightnessVal"),
  contrast: document.getElementById("contrast"),
  contrastVal: document.getElementById("contrastVal"),
  saturation: document.getElementById("saturation"),
  saturationVal: document.getElementById("saturationVal"),
  sharpen: document.getElementById("sharpen"),
  alphaThreshold: document.getElementById("alphaThreshold"),
  alphaVal: document.getElementById("alphaVal"),
  removeSemitransparent: document.getElementById("removeSemitransparent"),
  showGrid: document.getElementById("showGrid"),
  gridSize: document.getElementById("gridSize"),
  gridSizeVal: document.getElementById("gridSizeVal"),
  processBtn: document.getElementById("processBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  downloadGridBtn: document.getElementById("downloadGridBtn"),
  downloadSegmentsBtn: document.getElementById("downloadSegmentsBtn"),
  live: document.getElementById("live"),
  canvas: document.getElementById("canvas"),
  status: document.getElementById("status"),
  updateStatsBtn: document.getElementById("updateStatsBtn"),
  statsBody: document.getElementById("statsBody"),
  paletteDialog: document.getElementById("paletteDialog"),
  paletteGrid: document.getElementById("paletteGrid"),
  paletteSelectAll: document.getElementById("paletteSelectAll"),
  paletteClear: document.getElementById("paletteClear"),
  paletteApply: document.getElementById("paletteApply"),
  paletteCancel: document.getElementById("paletteCancel"),
};

let srcImageData = null;
let outputImageData = null;
let customPalette = [...FULL_PALETTE_COLORS];

const viewState = { zoom: 1, offsetX: 0, offsetY: 0 };
const panState = { isPanning: false, lastX: 0, lastY: 0 };

function setStatus(text) {
  els.status.textContent = text || "";
}

// Initialize and bind slider value labels
function updateValue(el, label, transform = (v) => v) {
  if (!el || !label) return;
  label.textContent = String(transform(Number(el.value)));
}

function bindValueLabel(rangeEl, labelEl, transform) {
  if (!rangeEl || !labelEl) return;
  updateValue(rangeEl, labelEl, transform);
  rangeEl.addEventListener("input", () =>
    updateValue(rangeEl, labelEl, transform)
  );
}

function getActivePaletteHex() {
  const type = els.paletteType.value;
  if (type === "free") return FREE_PALETTE_COLORS;
  if (type === "full") return FULL_PALETTE_COLORS;
  if (type === "custom")
    return customPalette.length ? customPalette : ["#000000", "#ffffff"];
  return FREE_PALETTE_COLORS;
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const reader = new FileReader();
    reader.onload = (e) => (img.src = e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function imageToImageData(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function render(imageData) {
  // Match canvas buffer to CSS size once per change; avoid feedback resizing
  const cssW = Math.max(1, els.canvas.clientWidth || imageData.width);
  const cssH = Math.max(1, els.canvas.clientHeight || imageData.height);
  if (els.canvas.width !== cssW || els.canvas.height !== cssH) {
    els.canvas.width = cssW;
    els.canvas.height = cssH;
  }
  displayImageWithGrid(els.canvas, imageData, {
    showGrid: els.showGrid.checked,
    gridSize: Number(els.gridSize.value) || 128,
    zoom: viewState.zoom,
    offsetX: viewState.offsetX,
    offsetY: viewState.offsetY,
  });
}

// Observe canvas size once
const __canvasResizeObserver = new ResizeObserver(() => {
  if (outputImageData) render(outputImageData);
  else if (srcImageData) render(srcImageData);
});
__canvasResizeObserver.observe(document.getElementById("canvas"));

async function process() {
  if (!srcImageData) return;
  setStatus("Processing…");

  const width = srcImageData.width;
  const height = srcImageData.height;
  const config = {
    brightness: Number(els.brightness.value),
    contrast: Number(els.contrast.value),
    saturation: Number(els.saturation.value),
    useSharpening: els.sharpen.checked,
  };

  let working = new ImageData(
    new Uint8ClampedArray(srcImageData.data),
    width,
    height
  );
  working = processImage(working, width, height, config);

  const paletteHex = getActivePaletteHex();
  const paletteRgb = getPaletteAsRgb(paletteHex);

  const { rgbChannels, alphaChannel } = imageDataToArrays(working);

  const dithering = els.ditherMethod.value;
  const alphaThreshold = Number(els.alphaThreshold.value);

  let rgbOut;
  const progress = () => {};
  switch (dithering) {
    case "floyd_steinberg":
      rgbOut = applyFloydSteinbergDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Number(els.strength.value),
        alphaThreshold,
        progress,
        !!els.serpentine.checked
      );
      break;
    case "jarvis":
      rgbOut = applyJarvisDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Number(els.strength.value),
        alphaThreshold,
        progress,
        !!els.serpentine.checked
      );
      break;
    case "stucki":
      rgbOut = applyStuckiDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Number(els.strength.value),
        alphaThreshold,
        progress,
        !!els.serpentine.checked
      );
      break;
    case "burkes":
      rgbOut = applyBurkesDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Number(els.strength.value),
        alphaThreshold,
        progress,
        !!els.serpentine.checked
      );
      break;
    case "atkinson":
      rgbOut = applyAtkinsonDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Number(els.strength.value),
        alphaThreshold,
        progress,
        !!els.serpentine.checked
      );
      break;
    case "sierra_lite":
      rgbOut = applySierraLiteDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Number(els.strength.value),
        alphaThreshold,
        progress,
        !!els.serpentine.checked
      );
      break;
    case "sierra2":
      rgbOut = applySierra2Dithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Number(els.strength.value),
        alphaThreshold,
        progress,
        !!els.serpentine.checked
      );
      break;
    case "sierra3":
      rgbOut = applySierra3Dithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Number(els.strength.value),
        alphaThreshold,
        progress,
        !!els.serpentine.checked
      );
      break;
    case "bayer":
      rgbOut = applyBayerDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Math.round(Number(els.strength.value) * 128) || 32,
        alphaThreshold,
        progress
      );
      break;
    case "halftone":
      rgbOut = applyHalftoneDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Math.round(Number(els.strength.value) * 128) || 64,
        alphaThreshold,
        progress
      );
      break;
    case "random":
      rgbOut = applyRandomDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        Math.round(Number(els.strength.value) * 64) || 24,
        alphaThreshold,
        progress
      );
      break;
    default:
      rgbOut = applyNoDithering(
        rgbChannels,
        alphaChannel,
        paletteRgb,
        alphaThreshold,
        progress
      );
  }

  // Alpha handling
  const finalAlpha = alphaChannel.map((row) =>
    row.map((a) => {
      if (a < alphaThreshold) return 0;
      if (els.removeSemitransparent.checked) return 255;
      return a;
    })
  );

  outputImageData = arraysToImageData(rgbOut, finalAlpha, width, height);
  render(outputImageData);
  els.downloadBtn.disabled = false;
  els.downloadGridBtn && (els.downloadGridBtn.disabled = false);
  els.downloadSegmentsBtn && (els.downloadSegmentsBtn.disabled = false);
  updateStats();
  setStatus("Done");
}

function updateStats() {
  if (!outputImageData || !els.statsBody) return;
  const stats = getColorStatistics(
    outputImageData,
    ALL_COLOR_NAMES,
    Number(els.alphaThreshold?.value) || 128
  );
  els.statsBody.innerHTML = "";
  for (const row of stats) {
    const tr = document.createElement("tr");
    const nameTd = document.createElement("td");
    nameTd.textContent = row.name || "Unknown";
    const hexTd = document.createElement("td");
    hexTd.textContent = row.hex;
    hexTd.style.background = row.hex;
    // Choose readable text color based on luminance
    try {
      const r = parseInt(row.hex.slice(1, 3), 16);
      const g = parseInt(row.hex.slice(3, 5), 16);
      const b = parseInt(row.hex.slice(5, 7), 16);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      hexTd.style.color = lum < 140 ? "#fff" : "#000";
    } catch (e) {
      hexTd.style.color = "#000";
    }
    const countTd = document.createElement("td");
    countTd.textContent = String(row.count);
    tr.append(nameTd, hexTd, countTd);
    els.statsBody.appendChild(tr);
  }
}

// Palette dialog
function buildPaletteDialog(selectedSet) {
  els.paletteGrid.innerHTML = "";
  FULL_PALETTE_COLORS.forEach((hex) => {
    const wrap = document.createElement("label");
    wrap.className = "swatch";

    const box = document.createElement("span");
    box.className = "swatch-box";
    box.style.background = hex;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedSet.has(hex);
    cb.dataset.hex = hex;

    const name = document.createElement("span");
    name.textContent = ALL_COLOR_NAMES?.[hex] || hex;

    wrap.appendChild(cb);
    wrap.appendChild(box);
    wrap.appendChild(name);

    els.paletteGrid.appendChild(wrap);
  });
}

els.customizePaletteBtn?.addEventListener("click", () => {
  const selected = new Set(customPalette);
  buildPaletteDialog(selected);
  els.paletteDialog.showModal();
});

els.paletteSelectAll?.addEventListener("click", () => {
  els.paletteGrid
    .querySelectorAll("input[type=checkbox]")
    .forEach((cb) => (cb.checked = true));
});

els.paletteClear?.addEventListener("click", () => {
  els.paletteGrid
    .querySelectorAll("input[type=checkbox]")
    .forEach((cb) => (cb.checked = false));
});

els.paletteApply?.addEventListener("click", () => {
  const chosen = [];
  els.paletteGrid.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    if (cb.checked) chosen.push(cb.dataset.hex);
  });
  customPalette = chosen.length ? chosen : ["#000000", "#ffffff"];
  els.paletteDialog.close();
});

els.paletteCancel?.addEventListener("click", () => els.paletteDialog.close());

// Events
els.fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    setStatus("Loading image…");
    const img = await readImageFile(file);
    srcImageData = imageToImageData(img);
    // Reset any previous processed output so preview/zoom applies to the new image
    outputImageData = null;
    els.downloadBtn.disabled = true;
    if (els.downloadGridBtn) els.downloadGridBtn.disabled = false;
    if (els.downloadSegmentsBtn) els.downloadSegmentsBtn.disabled = false;
    viewState.zoom = 1;
    viewState.offsetX = 0;
    viewState.offsetY = 0;
    render(srcImageData);
    setStatus("Image loaded. Click Process.");
  } catch (err) {
    console.error(err);
    setStatus("Failed to load image");
  }
});

els.paletteType.addEventListener("change", () => {
  const isCustom = els.paletteType.value === "custom";
  els.customizePaletteBtn.disabled = !isCustom;
});

els.processBtn.addEventListener("click", process);
els.downloadBtn.addEventListener("click", async () => {
  if (!outputImageData) return;
  await downloadCanvas(els.canvas, "pixelated.png", "image/png");
});
els.updateStatsBtn?.addEventListener("click", updateStats);

// Download with grid overlay
els.downloadGridBtn?.addEventListener("click", async () => {
  // Ensure image has been processed before exporting with grid
  if (!outputImageData && srcImageData) {
    await process();
  }
  const src = outputImageData || srcImageData;
  if (!src) return;
  // Draw into a temporary canvas at image resolution with grid
  const tmp = document.createElement("canvas");
  tmp.width = src.width;
  tmp.height = src.height;
  const ctx = tmp.getContext("2d");
  // Draw image
  const buf = document.createElement("canvas");
  buf.width = src.width;
  buf.height = src.height;
  buf.getContext("2d").putImageData(src, 0, 0);
  ctx.drawImage(buf, 0, 0);
  // Always draw grid at natural scale for this export
  ctx.strokeStyle = "rgba(255,0,0,0.5)";
  ctx.lineWidth = 1;
  const size = Number(els.gridSize.value) || 128;
  for (let x = 0; x <= src.width; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, src.height);
    ctx.stroke();
  }
  for (let y = 0; y <= src.height; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(src.width, y);
    ctx.stroke();
  }
  await downloadCanvas(tmp, "pixelated_with_grid.png", "image/png");
});

// Download per-grid segments (skip fully transparent/empty)
// Replace plain listener with a single-bind guarded listener
if (els.downloadSegmentsBtn && !els.downloadSegmentsBtn.dataset.bound) {
  els.downloadSegmentsBtn.dataset.bound = "1";
  els.downloadSegmentsBtn.addEventListener("click", async () => {
    // Ensure image has been processed before exporting segments
    if (!outputImageData && srcImageData) {
      await process();
    }
    const src = outputImageData || srcImageData;
    if (!src) return;
    const size = Number(els.gridSize.value) || 128;
    const alphaThresh = Number(els.alphaThreshold.value) || 128;
    const baseName = "segment";
    let saved = 0;
    // iterate grid cells
    for (let gy = 0, row = 0; gy < src.height; gy += size, row++) {
      for (let gx = 0, col = 0; gx < src.width; gx += size, col++) {
        const w = Math.min(size, src.width - gx);
        const h = Math.min(size, src.height - gy);
        // Extract sub-image
        const sub = new ImageData(w, h);
        const srcData = src.data;
        const dst = sub.data;
        let hasPixel = false;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const si = ((gy + y) * src.width + (gx + x)) * 4;
            const di = (y * w + x) * 4;
            dst[di] = srcData[si];
            dst[di + 1] = srcData[si + 1];
            dst[di + 2] = srcData[si + 2];
            dst[di + 3] = srcData[si + 3];
            if (!hasPixel && srcData[si + 3] >= alphaThresh) hasPixel = true;
          }
        }
        if (!hasPixel) continue; // skip empty
        // Draw to canvas and download (1-based indices)
        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        tmp.getContext("2d").putImageData(sub, 0, 0);
        await downloadCanvas(
          tmp,
          `${baseName}_${row + 1}_${col + 1}.png`,
          "image/png"
        );
        saved++;
      }
    }
    setStatus(`Saved ${saved} segment(s).`);
  });
}

// Live processing
els.live?.addEventListener("change", () => {
  if (els.live.checked) process();
});
[
  els.strength,
  els.serpentine,
  els.brightness,
  els.contrast,
  els.saturation,
  els.sharpen,
  els.alphaThreshold,
  els.removeSemitransparent,
  els.ditherMethod,
  els.paletteType,
].forEach((el) => {
  el?.addEventListener("input", () => {
    if (els.live?.checked) process();
  });
});

els.showGrid.addEventListener("change", () => {
  if (outputImageData) render(outputImageData);
  else if (srcImageData) render(srcImageData);
});

els.gridSize.addEventListener("input", () => {
  if (outputImageData) render(outputImageData);
  else if (srcImageData) render(srcImageData);
});

// Zoom with wheel (stable canvas size)
els.canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const rect = els.canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.1, Math.min(viewState.zoom * zoomFactor, 20));

  // Adjust pan so the zoom centers on cursor
  viewState.offsetX =
    mouseX - ((mouseX - viewState.offsetX) * newZoom) / viewState.zoom;
  viewState.offsetY =
    mouseY - ((mouseY - viewState.offsetY) * newZoom) / viewState.zoom;

  viewState.zoom = newZoom;

  if (outputImageData) render(outputImageData);
  else if (srcImageData) render(srcImageData);
});

// Pan with mouse drag
els.canvas.addEventListener("mousedown", (e) => {
  panState.isPanning = true;
  panState.lastX = e.clientX;
  panState.lastY = e.clientY;
});
window.addEventListener("mousemove", (e) => {
  if (!panState.isPanning) return;
  const dx = e.clientX - panState.lastX;
  const dy = e.clientY - panState.lastY;
  viewState.offsetX -= dx;
  viewState.offsetY -= dy;
  panState.lastX = e.clientX;
  panState.lastY = e.clientY;
  if (outputImageData) render(outputImageData);
  else if (srcImageData) render(srcImageData);
});
window.addEventListener("mouseup", () => (panState.isPanning = false));

// Value label bindings
bindValueLabel(els.strength, els.strengthVal, (v) => v.toFixed(2));
bindValueLabel(els.brightness, els.brightnessVal, (v) => v.toFixed(2));
bindValueLabel(els.contrast, els.contrastVal, (v) => v.toFixed(2));
bindValueLabel(els.saturation, els.saturationVal, (v) => v.toFixed(2));
bindValueLabel(els.alphaThreshold, els.alphaVal, (v) => Math.round(v));
if (els.gridSize && els.gridSizeVal) {
  els.gridSizeVal.textContent = String(els.gridSize.value);
  els.gridSize.addEventListener(
    "input",
    () => (els.gridSizeVal.textContent = String(els.gridSize.value))
  );
}
