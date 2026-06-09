/**
 * VizMix - Automatic Benchmark Mode
 *
 * ?benchmark=1 で起動。素材(動画/ISF/静止画) × 解像度(1080p/720p) × エフェクトを
 * 自動で一巡し、各状態の FPS(平均/最低)・解像度・JSヒープを計測。
 * 結果を画面に表で表示し、JSON ファイルとしてダウンロードできるようにする。
 *
 * 正確な FPS は前面(フォアグラウンド)表示でのみ測れるため、起動だけ手動・計測は自動。
 */

import * as pc from "playcanvas";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** rAF ベースで seconds 秒間 FPS を計測 (1秒ごとサンプル → avg/min) */
function measureFps(seconds) {
  return new Promise((resolve) => {
    const samples = [];
    let frames = 0;
    let last = performance.now();
    const t0 = last;
    function tick(now) {
      frames++;
      if (now - last >= 1000) {
        samples.push(frames);
        frames = 0;
        last = now;
      }
      if (now - t0 < seconds * 1000) {
        requestAnimationFrame(tick);
      } else {
        const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
        const min = samples.length ? Math.min(...samples) : 0;
        resolve({ fpsAvg: Math.round(avg * 10) / 10, fpsMin: min, samples });
      }
    }
    requestAnimationFrame(tick);
  });
}

/** 静止画用のテスト柄テクスチャを生成 (アップロード1回) */
export function generateStaticTexture(device, w = 1280, h = 720) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#203a8f"); g.addColorStop(0.5, "#8f2060"); g.addColorStop(1, "#208f6a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc((i * 137) % w, (i * 211) % h, 30 + (i % 5) * 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 4;
  for (let x = 0; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  const tex = new pc.Texture(device, {
    name: "benchStatic", width: w, height: h, format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  tex.setSource(cv);
  return tex;
}

const EFFECTS = ["none", "brightness", "contrast", "saturate", "hueRotate",
  "grayscale", "sepia", "invert", "blur", "rgbShift", "glitch", "rgbMultiply", "all"];
const RESOS = ["1920x1080", "1280x720"];
const MATERIALS = ["video", "shader", "image"];

// ── 画面表示 (オーバーレイ表) ──────────────────────────────────────────────────

function ensureOverlay() {
  let el = document.getElementById("benchmarkOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "benchmarkOverlay";
    el.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0b0b0bee;color:#ddd;" +
      "font:12px/1.4 monospace;padding:16px;overflow:auto;";
    document.body.appendChild(el);
  }
  return el;
}

function renderTable(results, done) {
  const el = ensureOverlay();
  const rows = results.map((r) =>
    `<tr><td>${r.phase}</td><td>${r.material}</td><td>${r.resolution}</td><td>${r.effect}</td>` +
    `<td style="text-align:right">${r.fpsAvg}</td><td style="text-align:right">${r.fpsMin}</td>` +
    `<td style="text-align:right">${r.heapMB ?? "-"}</td></tr>`).join("");
  el.innerHTML =
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
       <b>VizMix Benchmark ${done ? "(done)" : "(running…)"} — ${results.length} states</b>
       <span><button id="benchDl" style="margin-right:8px">Download JSON</button>
       <button id="benchClose">Close</button></span>
     </div>
     <table style="border-collapse:collapse;width:100%">
       <thead><tr style="color:#4fd1c5">
         <th align=left>phase</th><th align=left>material</th><th align=left>resolution</th>
         <th align=left>effect</th><th align=right>fps avg</th><th align=right>fps min</th><th align=right>heapMB</th>
       </tr></thead><tbody>${rows}</tbody></table>`;
  const dl = document.getElementById("benchDl");
  if (dl) dl.onclick = () => downloadJSON(results);
  const close = document.getElementById("benchClose");
  if (close) close.onclick = () => el.remove();
}

function downloadJSON(results) {
  const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)],
    { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "vizmix-benchmark.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── オーケストレーション ────────────────────────────────────────────────────────

/**
 * @param {Object} ctx
 *   setResolution(key)        : Promise  解像度切替
 *   applyEffect(name)         : void     エフェクト状態を設定 (none/各種/all)
 *   setMaterial(type)         : Promise  素材切替 (video/shader/image)
 *   getEnvStats()             : { resolution, heapMB }
 *   durationSec               : number   各状態の計測秒数
 */
export async function runBenchmark(ctx) {
  const dur = ctx.durationSec || 8;
  const results = [];
  renderTable(results, false);

  // 1) エフェクト × 解像度 (video 素材)
  await ctx.setMaterial("video");
  for (const res of RESOS) {
    await ctx.setResolution(res);
    for (const eff of EFFECTS) {
      ctx.applyEffect(eff);
      await sleep(900); // 安定待ち
      const m = await measureFps(dur);
      results.push({ phase: "effect", material: "video", resolution: res, effect: eff, ...m, ...ctx.getEnvStats() });
      renderTable(results, false);
    }
  }

  // 2) 素材比較 (all エフェクト, 1080p)
  await ctx.setResolution("1920x1080");
  ctx.applyEffect("all");
  for (const mat of MATERIALS) {
    await ctx.setMaterial(mat);
    await sleep(900);
    const m = await measureFps(dur);
    results.push({ phase: "material", material: mat, resolution: "1920x1080", effect: "all", ...m, ...ctx.getEnvStats() });
    renderTable(results, false);
  }

  // 後始末
  await ctx.setMaterial("video");
  ctx.applyEffect("none");
  renderTable(results, true);
  downloadJSON(results);
  window.__benchmarkResults = results;
  console.log("[Benchmark] complete:", results.length, "states");
  return results;
}

export { EFFECTS, RESOS, MATERIALS };
