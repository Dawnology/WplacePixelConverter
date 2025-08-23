/**
 * Simple RGB Curves editor producing 256-value LUTs per channel.
 * - Renders 3 tabs (RGB, R, G, B) with draggable control points on a canvas.
 * - Emits change events with computed LUTs.
 */

const DEFAULT_POINTS = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function cubicInterp(p0, p1, p2, p3, t) {
  // Catmull-Rom to Bezier-like smoothness
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * p1 - 2 * p2 + v0 + v1) * t3 +
    (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
    v0 * t +
    p1
  );
}

function buildCurve(points, mode = "smooth") {
  // Points sorted by x in [0,255]
  const pts = points
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  const n = pts.length;
  const lut = new Uint8Array(256);

  // If only two control points, use exact linear interpolation to avoid
  // Catmull-Rom endpoint slope artifacts (which can brighten slightly).
  if (n === 2) {
    const x0 = pts[0].x;
    const y0 = pts[0].y;
    const x1 = pts[1].x;
    const y1 = pts[1].y;
    for (let x = 0; x < 256; x++) {
      let y;
      if (x1 === x0) y = y0;
      else {
        const t = clamp01((x - x0) / (x1 - x0));
        y = y0 + (y1 - y0) * t;
      }
      lut[x] = Math.max(0, Math.min(255, Math.round(y)));
    }
    return lut;
  }

  for (let x = 0; x < 256; x++) {
    // find segment
    let i = 0;
    while (i < n - 1 && x > pts[i + 1].x) i++;
    const p1 = pts[Math.max(0, i - 1)] || pts[0];
    const p2 = pts[i];
    const p3 = pts[Math.min(n - 1, i + 1)] || pts[n - 1];
    const p4 = pts[Math.min(n - 1, i + 2)] || pts[n - 1];
    const x0 = p2.x;
    const x1 = p3.x;
    let y;
    if (x1 === x0) {
      y = p2.y;
    } else {
      const t = clamp01((x - x0) / (x1 - x0));
      if (mode === "linear") {
        y = p2.y + (p3.y - p2.y) * t;
      } else {
        y = cubicInterp(p1.y, p2.y, p3.y, p4.y, t);
      }
    }
    lut[x] = Math.max(0, Math.min(255, Math.round(y)));
  }
  return lut;
}

class CurvesEditor {
  constructor(container) {
    this.container = container;
    this.active = true;
    this.mode = "rgb"; // rgb | r | g | b
    this.interpolation = "smooth"; // smooth | linear
    this.points = {
      r: DEFAULT_POINTS.map((p) => ({ ...p })),
      g: DEFAULT_POINTS.map((p) => ({ ...p })),
      b: DEFAULT_POINTS.map((p) => ({ ...p })),
      rgb: DEFAULT_POINTS.map((p) => ({ ...p })),
    };
    this.drag = { channel: null, index: -1, startX: 0, startY: 0 };
    this.onChange = null; // function({r,g,b})
    this._init();
  }

  _init() {
    // Build UI
    const wrapper = document.createElement("div");
    wrapper.className = "curves";

    const tabs = document.createElement("div");
    tabs.className = "curves-tabs";
    const mkBtn = (id, label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.dataset.mode = id;
      btn.addEventListener("click", () => {
        this.mode = id;
        this._render();
      });
      return btn;
    };
    tabs.append(
      mkBtn("rgb", "RGB"),
      mkBtn("r", "R"),
      mkBtn("g", "G"),
      mkBtn("b", "B")
    );

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    canvas.className = "curves-canvas";
    this.canvas = canvas;

    const toolbar = document.createElement("div");
    toolbar.className = "curves-toolbar";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "Reset";
    resetBtn.title = "Reset current curve only";
    resetBtn.addEventListener("click", () => {
      const current = this.mode === "rgb" ? "rgb" : this.mode;
      this.points[current] = DEFAULT_POINTS.map((p) => ({ ...p }));
      this._emit();
      this._render();
    });
    // Interpolation selector
    const interpWrap = document.createElement("label");
    interpWrap.style.marginLeft = "8px";
    const interpSel = document.createElement("select");
    const optSmooth = document.createElement("option");
    optSmooth.value = "smooth";
    optSmooth.textContent = "Smooth";
    const optLinear = document.createElement("option");
    optLinear.value = "linear";
    optLinear.textContent = "Linear";
    interpSel.append(optSmooth, optLinear);
    interpSel.value = this.interpolation;
    interpSel.addEventListener("change", () => {
      this.interpolation = interpSel.value;
      this._emit();
      this._render();
    });
    const interpLbl = document.createElement("span");
    interpLbl.textContent = " Interpolation: ";
    interpWrap.append(interpLbl, interpSel);

    // Export/Import buttons
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Export";
    exportBtn.style.marginLeft = "8px";
    exportBtn.addEventListener("click", () => this._exportCurves());

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "Import";
    importBtn.style.marginLeft = "4px";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json, .json";
    fileInput.style.display = "none";
    importBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const json = JSON.parse(text);
        this._importCurves(json);
      } catch (err) {
        console.error("Invalid curves JSON", err);
        alert("Invalid curves JSON");
      } finally {
        e.target.value = "";
      }
    });

    toolbar.append(resetBtn, interpWrap, exportBtn, importBtn, fileInput);

    wrapper.append(tabs, canvas, toolbar);
    this.container.appendChild(wrapper);

    // Events
    const getChannel = () => (this.mode === "rgb" ? "rgb" : this.mode);

    const pick = (x, y) => {
      const pts = this.points[getChannel()];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (Math.abs(p.x - x) <= 5 && Math.abs(p.y - y) <= 5) return i;
      }
      return -1;
    };

    const toXY = (evt) => {
      const rect = canvas.getBoundingClientRect();
      const cx = Math.round(((evt.clientX - rect.left) / rect.width) * 255);
      // invert Y so bottom=0 top=255 visually
      const cy = Math.round((1 - (evt.clientY - rect.top) / rect.height) * 255);
      return {
        x: Math.max(0, Math.min(255, cx)),
        y: Math.max(0, Math.min(255, cy)),
      };
    };

    canvas.addEventListener("mousedown", (e) => {
      const { x, y } = toXY(e);
      const idx = pick(x, y);
      const channel = getChannel();
      if (idx >= 0) {
        this.drag = { channel, index: idx };
      } else {
        // Add new point and start dragging
        this.points[channel].push({ x, y });
        this.points[channel].sort((a, b) => a.x - b.x);
        const newIndex = this.points[channel].findIndex(
          (p) => p.x === x && p.y === y
        );
        this.drag = { channel, index: newIndex };
        this._emit();
        this._render();
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this.drag.index < 0) return;
      const { x, y } = toXY(e);
      const pts = this.points[this.drag.channel];
      const i = this.drag.index;
      // lock endpoints by index if 0 or last
      const isEnd = i === 0 || i === pts.length - 1;
      if (isEnd) {
        // allow y change only
        pts[i].y = y;
      } else {
        // keep x order
        const minX = pts[i - 1].x + 1;
        const maxX = pts[i + 1].x - 1;
        pts[i].x = Math.max(minX, Math.min(maxX, x));
        pts[i].y = y;
      }
      this._emit();
      this._render();
    });
    window.addEventListener("mouseup", () => (this.drag.index = -1));

    // Context menu to delete a non-endpoint
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const { x, y } = toXY(e);
      const channel = getChannel();
      const pts = this.points[channel];
      const idx = pts.findIndex(
        (p) => Math.abs(p.x - x) <= 5 && Math.abs(p.y - y) <= 5
      );
      if (idx > 0 && idx < pts.length - 1) {
        pts.splice(idx, 1);
        this._emit();
        this._render();
      }
    });

    this._render();
    this._emit();
  }

  _emit() {
    const make = (pts) => buildCurve(pts, this.interpolation);
    const rgb = make(this.points.rgb);
    const r = make(this.points.r);
    const g = make(this.points.g);
    const b = make(this.points.b);

    const out = { r, g, b, rgb };
    this.lastCurves = out;
    this.onChange && this.onChange(out);
  }

  _render() {
    const ctx = this.canvas.getContext("2d");
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * W;
      const y = (i / 4) * H;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }

    // axes
    ctx.strokeStyle = "#bbb";
    ctx.beginPath();
    ctx.moveTo(0, H - 0.5);
    ctx.lineTo(W, 0.5);
    ctx.stroke();

    const mode = this.mode;
    const channels = mode === "rgb" ? ["rgb"] : [mode];
    const colors = { rgb: "#000000ff", r: "#c33", g: "#3c3", b: "#36c" };

    channels.forEach((ch) => {
      // curve path
      const lut = buildCurve(this.points[ch], this.interpolation);
      ctx.strokeStyle = colors[ch];
      ctx.beginPath();
      for (let x = 0; x < 256; x++) {
        const y = lut[x];
        const cx = (x / 255) * W;
        const cy = H - (y / 255) * H;
        if (x === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      // points
      ctx.fillStyle = colors[ch];
      this.points[ch].forEach((p) => {
        const cx = (p.x / 255) * W;
        const cy = H - (p.y / 255) * H;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  _exportCurves() {
    const toPlain = (arr) => Array.from(arr);
    const make = (pts) => buildCurve(pts, this.interpolation);
    const json = {
      version: 1,
      interpolation: this.interpolation,
      points: {
        rgb: this.points.rgb.map((p) => ({ x: p.x, y: p.y })),
        r: this.points.r.map((p) => ({ x: p.x, y: p.y })),
        g: this.points.g.map((p) => ({ x: p.x, y: p.y })),
        b: this.points.b.map((p) => ({ x: p.x, y: p.y })),
      },
      luts: {
        rgb: toPlain(make(this.points.rgb)),
        r: toPlain(make(this.points.r)),
        g: toPlain(make(this.points.g)),
        b: toPlain(make(this.points.b)),
      },
    };
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "curves.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _importCurves(json) {
    try {
      if (json.interpolation === "smooth" || json.interpolation === "linear") {
        this.interpolation = json.interpolation;
      }
      const setPoints = (key, pts) => {
        if (Array.isArray(pts) && pts.length >= 2) {
          this.points[key] = pts
            .map((p) => ({
              x: Math.max(0, Math.min(255, Math.round(p.x))),
              y: Math.max(0, Math.min(255, Math.round(p.y))),
            }))
            .sort((a, b) => a.x - b.x);
        }
      };
      if (json.points) {
        setPoints("rgb", json.points.rgb);
        setPoints("r", json.points.r);
        setPoints("g", json.points.g);
        setPoints("b", json.points.b);
      } else if (json.luts) {
        // Approximate control points from LUTs (sample every 16px)
        const approxFromLut = (lut) => {
          if (!Array.isArray(lut) || lut.length !== 256)
            return DEFAULT_POINTS.map((p) => ({ ...p }));
          const pts = [];
          for (let x = 0; x <= 255; x += 16) {
            pts.push({ x, y: Math.max(0, Math.min(255, Math.round(lut[x]))) });
          }
          if (pts[pts.length - 1].x !== 255)
            pts.push({
              x: 255,
              y: Math.max(0, Math.min(255, Math.round(lut[255]))),
            });
          return pts;
        };
        this.points.rgb = approxFromLut(json.luts.rgb);
        this.points.r = approxFromLut(json.luts.r || json.luts.rgb);
        this.points.g = approxFromLut(json.luts.g || json.luts.rgb);
        this.points.b = approxFromLut(json.luts.b || json.luts.rgb);
      }
      this._emit();
      this._render();
    } catch (e) {
      console.error("Failed to import curves", e);
      alert("Failed to import curves");
    }
  }
}

export { CurvesEditor };
