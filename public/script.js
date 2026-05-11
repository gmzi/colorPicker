// ─── Color Conversion Utilities ───────────────────────────────────────────────

function hsvToRgb(h, s, v) {
  s /= 100;
  v /= 100;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const table = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ];
  return table[i].map((c) => Math.round(c * 255));
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [
    Math.round(h * 360),
    Math.round(max === 0 ? 0 : (d / max) * 100),
    Math.round(max * 100),
  ];
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  if (hex.length !== 6 || !/^[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ─── Smart Parser ─────────────────────────────────────────────────────────────
// Tries to read any common color format from an arbitrary string.
// Returns [r, g, b] (0–255) or null.

function smartParse(raw) {
  const s = raw.trim();

  // #rrggbb / #rgb / rrggbb / rgb (bare hex)
  const hex = hexToRgb(s);
  if (hex) return hex;

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbFn = s.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbFn) {
    const [r, g, b] = [+rgbFn[1], +rgbFn[2], +rgbFn[3]];
    if ([r, g, b].every((n) => n >= 0 && n <= 255))
      return [r, g, b].map(Math.round);
  }

  // hsl(h, s%, l%) or hsla(...)
  const hslFn = s.match(
    /hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/i,
  );
  if (hslFn) return hslToRgb(+hslFn[1], +hslFn[2], +hslFn[3]);

  // Plain "r, g, b" (no function wrapper)
  const csvParts = s.split(",").map((p) => parseFloat(p.trim()));
  if (csvParts.length === 3 && csvParts.every((n) => !isNaN(n))) {
    // Heuristic: if all values ≤ 255 treat as RGB, else try HSL
    if (csvParts.every((n) => n >= 0 && n <= 255))
      return csvParts.map(Math.round);
  }

  // Plain "h°, s%, l%" — strip degree/percent symbols then split
  const hslParts = s.replace(/[°%]/g, "").split(",").map(parseFloat);
  if (hslParts.length === 3 && hslParts.every((n) => !isNaN(n))) {
    const [h, sv, l] = hslParts;
    if (h >= 0 && h <= 360 && sv >= 0 && sv <= 100 && l >= 0 && l <= 100) {
      return hslToRgb(h, sv, l);
    }
  }

  return null;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function clamp(val, lo, hi) {
  return Math.min(hi, Math.max(lo, val));
}

// ─── State ────────────────────────────────────────────────────────────────────

let hue = 217;
let saturation = 68;
let brightness = 85;
let isDragging = false;
let isNightTheme = false;
let activeInput = null;

// ─── DOM References ───────────────────────────────────────────────────────────

const canvas = document.getElementById("color-canvas");
const ctx = canvas.getContext("2d");
const marker = document.getElementById("selection-marker");
const swatchEl = document.getElementById("current-color");
const hueSlider = document.getElementById("hue-slider");
const hexInput = document.getElementById("hex-input");
const rgbInput = document.getElementById("rgb-input");
const hslInput = document.getElementById("hsl-input");
const themeToggle = document.getElementById("theme-toggle");

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const size = wrapper.clientWidth;

  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawCanvas();
  updateMarkerPosition();
}

function drawCanvas() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  ctx.fillRect(0, 0, w, h);

  const wGrad = ctx.createLinearGradient(0, 0, w, 0);
  wGrad.addColorStop(0, "rgba(255,255,255,1)");
  wGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = wGrad;
  ctx.fillRect(0, 0, w, h);

  const bGrad = ctx.createLinearGradient(0, 0, 0, h);
  bGrad.addColorStop(0, "rgba(0,0,0,0)");
  bGrad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = bGrad;
  ctx.fillRect(0, 0, w, h);
}

function updateMarkerPosition() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  marker.style.left = (saturation / 100) * w + "px";
  marker.style.top = (1 - brightness / 100) * h + "px";
}

// ─── Color Update ─────────────────────────────────────────────────────────────

function updateFromHSV() {
  const [r, g, b] = hsvToRgb(hue, saturation, brightness);
  const hex = rgbToHex(r, g, b);
  const [h2, s2, l2] = rgbToHsl(r, g, b);

  swatchEl.style.backgroundColor = hex;

  if (activeInput !== hexInput) hexInput.value = hex;
  if (activeInput !== rgbInput) rgbInput.value = `${r}, ${g}, ${b}`;
  if (activeInput !== hslInput) hslInput.value = `${h2}°, ${s2}%, ${l2}%`;

  const useDark = brightness > 60 && saturation < 55;
  marker.style.borderColor = useDark
    ? "rgba(0,0,0,0.72)"
    : "rgba(255,255,255,0.92)";
  marker.style.boxShadow = useDark
    ? "0 0 0 1.5px rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.25)"
    : "0 0 0 1.5px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.5)";
}

// ─── Sync helpers ─────────────────────────────────────────────────────────────

// Full sync from RGB: updates HSV state, redraws canvas, moves marker, refreshes all outputs.
function syncFromRgb(r, g, b) {
  [hue, saturation, brightness] = rgbToHsv(r, g, b);
  hueSlider.value = hue;
  drawCanvas();
  updateMarkerPosition();
  updateFromHSV();
}

// ─── Canvas Interaction ───────────────────────────────────────────────────────

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: clamp(
      (src.clientX - rect.left) * (canvas.clientWidth / rect.width),
      0,
      canvas.clientWidth,
    ),
    y: clamp(
      (src.clientY - rect.top) * (canvas.clientHeight / rect.height),
      0,
      canvas.clientHeight,
    ),
  };
}

function pickFromPos({ x, y }) {
  saturation = Math.round((x / canvas.clientWidth) * 100);
  brightness = Math.round((1 - y / canvas.clientHeight) * 100);
  updateMarkerPosition();
  updateFromHSV();
}

canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  canvas.focus();
  pickFromPos(getCanvasPos(e));
});
window.addEventListener("mousemove", (e) => {
  if (isDragging) pickFromPos(getCanvasPos(e));
});
window.addEventListener("mouseup", () => {
  isDragging = false;
});

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    isDragging = true;
    pickFromPos(getCanvasPos(e));
  },
  { passive: false },
);
canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    if (isDragging) pickFromPos(getCanvasPos(e));
  },
  { passive: false },
);
canvas.addEventListener("touchend", () => {
  isDragging = false;
});

// ─── Keyboard Nudge ───────────────────────────────────────────────────────────

canvas.setAttribute("tabindex", "0");
canvas.setAttribute("role", "slider");
canvas.setAttribute(
  "aria-label",
  "Color picker. Arrow keys adjust saturation and brightness. Hold Shift for larger steps.",
);

canvas.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 5 : 1;
  let moved = true;
  switch (e.key) {
    case "ArrowRight":
      saturation = clamp(saturation + step, 0, 100);
      break;
    case "ArrowLeft":
      saturation = clamp(saturation - step, 0, 100);
      break;
    case "ArrowUp":
      brightness = clamp(brightness + step, 0, 100);
      break;
    case "ArrowDown":
      brightness = clamp(brightness - step, 0, 100);
      break;
    default:
      moved = false;
  }
  if (moved) {
    e.preventDefault();
    updateMarkerPosition();
    updateFromHSV();
  }
});

// ─── Hue Slider ───────────────────────────────────────────────────────────────

hueSlider.addEventListener("input", () => {
  hue = parseInt(hueSlider.value);
  drawCanvas();
  updateFromHSV();
});

// ─── Text Inputs ──────────────────────────────────────────────────────────────

function setError(input, on) {
  input.classList.toggle("input-error", on);
}

// ── Paste handler (fires on all three inputs) ─────────────────────────────────
// Intercepts the paste event, tries smartParse on the clipboard text immediately
// (no debounce), and syncs everything if valid. This avoids the race condition
// where blur fires before the 300 ms debounce resolves.

function onPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData("text");
  const rgb = smartParse(text);

  if (rgb) {
    e.preventDefault(); // we'll handle the value ourselves
    activeInput = null; // let updateFromHSV rewrite all inputs cleanly
    setError(e.target, false);
    syncFromRgb(...rgb); // immediate, no debounce
  }
  // If we can't parse it, let the browser paste normally;
  // the debounced input handler will try again as the user edits.
}

hexInput.addEventListener("paste", onPaste);
rgbInput.addEventListener("paste", onPaste);
hslInput.addEventListener("paste", onPaste);

// ── Live typing (debounced) ───────────────────────────────────────────────────
// Runs only for manual keystrokes. Paste is handled separately above.

const liveHex = debounce(() => {
  const rgb = hexToRgb(hexInput.value.trim());
  setError(hexInput, !rgb && hexInput.value.trim().length > 0);
  if (rgb) syncFromRgb(...rgb);
}, 300);

const liveRgb = debounce(() => {
  const parts = rgbInput.value.split(",").map((p) => parseInt(p.trim()));
  const ok =
    parts.length === 3 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 255);
  setError(rgbInput, !ok && rgbInput.value.trim().length > 0);
  if (ok) syncFromRgb(...parts);
}, 300);

const liveHsl = debounce(() => {
  const parts = hslInput.value
    .replace(/[°%\s]/g, "")
    .split(",")
    .map(parseFloat);
  const ok = parts.length === 3 && parts.every((n) => !isNaN(n));
  setError(hslInput, !ok && hslInput.value.trim().length > 0);
  if (ok) syncFromRgb(...hslToRgb(...parts));
}, 300);

[hexInput, rgbInput, hslInput].forEach((inp, i) => {
  const liveParser = [liveHex, liveRgb, liveHsl][i];

  inp.addEventListener("focus", () => {
    activeInput = inp;
  });

  inp.addEventListener("blur", () => {
    activeInput = null;
    setError(inp, false);
    updateFromHSV(); // reformat / normalise displayed value on exit
  });

  inp.addEventListener("input", liveParser);
});

// ─── Copy to Clipboard ────────────────────────────────────────────────────────

function copyText(text, el) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  } else {
    const ta = Object.assign(document.createElement("textarea"), {
      value: text,
      style: "position:fixed;opacity:0",
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  el.classList.add("copied");
  setTimeout(() => el.classList.remove("copied"), 950);
}

hexInput.addEventListener("click", () => {
  hexInput.select();
  copyText(hexInput.value, hexInput);
});
rgbInput.addEventListener("click", () => {
  rgbInput.select();
  copyText(rgbInput.value, rgbInput);
});
hslInput.addEventListener("click", () => {
  hslInput.select();
  copyText(hslInput.value, hslInput);
});
swatchEl.addEventListener("click", () => copyText(hexInput.value, swatchEl));

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

themeToggle.addEventListener("click", () => {
  isNightTheme = !isNightTheme;
  document.body.classList.toggle("night-theme", isNightTheme);
  themeToggle.textContent = isNightTheme
    ? "Switch to Day Theme"
    : "Switch to Night Theme";
});

// ─── ResizeObserver ───────────────────────────────────────────────────────────

const ro = new ResizeObserver(debounce(resizeCanvas, 60));
ro.observe(canvas.parentElement);

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener("load", () => {
  resizeCanvas();
  updateFromHSV();
});
