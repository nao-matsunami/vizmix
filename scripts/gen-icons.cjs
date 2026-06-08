/**
 * VizMix PWA icon generator.
 * Draws a dark VJ-mixer motif (cyan->magenta crossfade) and exports
 * the PWA icon set into public/icons/.
 *
 * Run: node scripts/gen-icons.cjs
 */
const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * @param {number} size  pixel size
 * @param {boolean} maskable  keep artwork inside the central safe zone
 * @param {boolean} bleed  fill the whole canvas (no rounded corners) — used for maskable
 */
function draw(size, { maskable = false } = {}) {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");

  // Background. Maskable fills edge-to-edge; normal gets rounded corners.
  ctx.fillStyle = "#141414";
  if (maskable) {
    ctx.fillRect(0, 0, size, size);
  } else {
    const r = size * 0.22;
    roundRect(ctx, 0, 0, size, size, r);
    ctx.fill();
  }

  // Safe zone: maskable artwork must live within the central ~80%.
  const inset = maskable ? size * 0.18 : size * 0.16;
  const area = size - inset * 2;
  const x0 = inset;
  const y0 = inset;

  // Three "channel" bars rising across a cyan->magenta gradient.
  const grad = ctx.createLinearGradient(x0, 0, x0 + area, 0);
  grad.addColorStop(0, "#00e5ff");
  grad.addColorStop(1, "#ff2bd6");

  const cols = 3;
  const gap = area * 0.12;
  const barW = (area - gap * (cols - 1)) / cols;
  const heights = [0.55, 1.0, 0.72]; // relative bar heights
  ctx.fillStyle = grad;
  for (let i = 0; i < cols; i++) {
    const h = area * heights[i];
    const bx = x0 + i * (barW + gap);
    const by = y0 + (area - h);
    roundRect(ctx, bx, by, barW, h, barW * 0.25);
    ctx.fill();
  }

  // Crossfader line across the middle.
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(2, size * 0.025);
  ctx.lineCap = "round";
  const cy = y0 + area * 0.5;
  ctx.beginPath();
  ctx.moveTo(x0, cy);
  ctx.lineTo(x0 + area, cy);
  ctx.stroke();

  // Fader knob.
  ctx.fillStyle = "#ffffff";
  const knobX = x0 + area * 0.62;
  ctx.beginPath();
  ctx.arc(knobX, cy, Math.max(3, size * 0.055), 0, Math.PI * 2);
  ctx.fill();

  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function save(canvas, name) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  console.log("wrote", path.relative(path.join(__dirname, ".."), file));
}

save(draw(192), "pwa-192.png");
save(draw(512), "pwa-512.png");
save(draw(512, { maskable: true }), "pwa-maskable-512.png");
save(draw(180), "apple-touch-icon-180.png");
save(draw(32), "favicon-32.png");
console.log("done");
