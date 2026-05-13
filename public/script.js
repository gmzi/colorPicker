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

// ─── Strict Input Parsers (Validation) ────────────────────────────────────────

function parseHex(str) {
  const clean = str.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    return clean.split("").map((c) => parseInt(c + c, 16));
  }
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function parseRgb(str) {
  const clean = str.replace(/rgba?\(|\)/gi, "").trim();
  const parts = clean
    .split(/[\s,]+/)
    .filter((p) => p !== "")
    .map(Number);
  if (
    parts.length === 3 &&
    parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)
  ) {
    return parts;
  }
  return null;
}

function parseHsl(str) {
  const clean = str.replace(/hsla?\(|\)|°|%/gi, "").trim();
  const parts = clean
    .split(/[\s,]+/)
    .filter((p) => p !== "")
    .map(Number);
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    const [h, s, l] = parts;
    if (h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100) {
      return hslToRgb(h, s, l);
    }
  }
  return null;
}

function smartParse(str) {
  return parseHex(str) || parseRgb(str) || parseHsl(str) || null;
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
let currentRgb = [69, 123, 217];
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

// ─── Core Synchronization Engine ──────────────────────────────────────────────

/**
 * Updates the global application state from an RGB color array.
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @param {HTMLElement|null} sourceInput - The input element currently driving the change
 */
function syncFromRgb(r, g, b, sourceInput = null) {
  currentRgb = [r, g, b];
  [hue, saturation, brightness] = rgbToHsv(r, g, b);

  hueSlider.value = hue;
  drawCanvas();
  updateMarkerPosition();

  const hex = rgbToHex(r, g, b);
  swatchEl.style.backgroundColor = hex;

  if (sourceInput !== hexInput) hexInput.value = hex;
  if (sourceInput !== rgbInput) rgbInput.value = `${r}, ${g}, ${b}`;
  if (sourceInput !== hslInput) {
    const [h, s, l] = rgbToHsl(r, g, b);
    hslInput.value = `${h}°, ${s}%, ${l}%`;
  }

  const useDark = brightness > 60 && saturation < 55;
  marker.style.borderColor = useDark
    ? "rgba(0,0,0,0.72)"
    : "rgba(255,255,255,0.92)";
  marker.style.boxShadow = useDark
    ? "0 0 0 1.5px rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.25)"
    : "0 0 0 1.5px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.5)";
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

  const [r, g, b] = hsvToRgb(hue, saturation, brightness);
  syncFromRgb(r, g, b, null);
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
  "Color picker. Arrow keys adjust saturation and brightness.",
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
    const [r, g, b] = hsvToRgb(hue, saturation, brightness);
    syncFromRgb(r, g, b, null);
  }
});

// ─── Hue Slider ───────────────────────────────────────────────────────────────

hueSlider.addEventListener("input", () => {
  hue = parseInt(hueSlider.value);
  drawCanvas();
  const [r, g, b] = hsvToRgb(hue, saturation, brightness);
  syncFromRgb(r, g, b, null);
});

// ─── Text Inputs Logic & Input Validation ──────────────────────────────────────

function setError(input, on) {
  input.classList.toggle("input-error", on);
}

// Live typing controllers (Debounced to give breathing room while user constructs values)
const liveHex = debounce(() => {
  const rgb = parseHex(hexInput.value);
  setError(hexInput, !rgb && hexInput.value.trim().length > 0);
  if (rgb) syncFromRgb(...rgb, hexInput);
}, 250);

const liveRgb = debounce(() => {
  const rgb = parseRgb(rgbInput.value);
  setError(rgbInput, !rgb && rgbInput.value.trim().length > 0);
  if (rgb) syncFromRgb(...rgb, rgbInput);
}, 250);

const liveHsl = debounce(() => {
  const rgb = parseHsl(hslInput.value);
  setError(hslInput, !rgb && hslInput.value.trim().length > 0);
  if (rgb) syncFromRgb(...rgb, hslInput);
}, 250);

// Global Paste Event Interceptor
function onPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData("text").trim();
  const rgb = smartParse(text);

  if (rgb) {
    e.preventDefault();
    setError(e.target, false);
    // Passing null ensures even the current field gets overwritten with the clean string format
    syncFromRgb(...rgb, null);
  }
}

[hexInput, rgbInput, hslInput].forEach((inp, i) => {
  const liveParser = [liveHex, liveRgb, liveHsl][i];

  inp.addEventListener("paste", onPaste);
  inp.addEventListener("input", liveParser);

  inp.addEventListener("focus", () => {
    activeInput = inp;
  });

  inp.addEventListener("blur", () => {
    activeInput = null;
    setError(inp, false);
    syncFromRgb(...currentRgb, null);
  });
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

// ─── Initial Load ─────────────────────────────────────────────────────────────

window.addEventListener("load", () => {
  resizeCanvas();
  const [r, g, b] = hsvToRgb(hue, saturation, brightness);
  syncFromRgb(r, g, b, null);
});
