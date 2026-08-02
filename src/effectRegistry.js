/**
 * VizMix - Effect Registry (単一のソース・オブ・トゥルース)
 *
 * エフェクト1本 = 「ISF文字列 + 最小メタ(id/label/category/shortcut/type)」の1エントリ。
 * パラメータ(名前・型・既定値・レンジ)は **ISFヘッダの INPUTS から導出** する。
 * 状態・一覧UI・パラメータパネル・チェーン構築・ショートカットは全部ここから生える。
 *
 * 新しいエフェクトを足すとき:
 *   1. src/effectSources.js に ISF を書く
 *   2. この EFFECT_REGISTRY に1エントリ足す
 * 以上。docs/ISF_CONTRACT.md 参照。
 */

import { ISFEffect } from "./isfEffect.js";
import * as S from "./effectSources.js";

/**
 * 配列の順序 = **チェーン適用順**（色調整 → ブラー → グリッチ系）。
 * 一覧UIの並びは category ごとに uiRank で決まる（表示順と適用順は別物）。
 *
 * type:
 *   'toggle'        … ON/OFF のみ。ON でパラメータを MAX に振る (例: Invert)
 *   'toggle-amount' … ON/OFF + 量。ON かつ量>既定 で適用
 *   'continuous'    … 量のみ。既定値以外で適用
 *
 * ui: ISFヘッダから導出できない「表示だけの都合」の上書き。
 *   label     … パラメータ表示名 (既定: color型は 'Color'、他は 'Amount')
 *   factor    … ISF値 → UI値 の倍率 (既定: float は 100 = パーセント表示)
 *   unit      … UI の単位表記 (既定: factor 100 なら '%')
 *   stateKey  … 状態/保存に使うキー (既定: ISF の INPUT 名)
 */
export const EFFECT_REGISTRY = [
  { id: "brightness", label: "Brightness", category: "Adjust", shortcut: "F5",
    type: "continuous", uiRank: 0, isf: S.BRIGHTNESS,
    ui: { amount: { unit: "" } } },

  { id: "contrast", label: "Contrast", category: "Adjust", shortcut: "F6",
    type: "continuous", uiRank: 1, isf: S.CONTRAST,
    ui: { amount: { unit: "" } } },

  { id: "saturate", label: "Saturate", category: "Color", shortcut: "F10",
    type: "continuous", uiRank: 3, isf: S.SATURATE },

  { id: "hueRotate", label: "Hue Rotate", category: "Color", shortcut: "F11",
    type: "continuous", uiRank: 4, isf: S.HUE_ROTATE,
    ui: { amount: { label: "Angle", factor: 1, unit: "°" } } },

  { id: "grayscale", label: "Grayscale", category: "Color", shortcut: "F2",
    type: "toggle-amount", uiRank: 1, isf: S.GRAYSCALE },

  { id: "sepia", label: "Sepia", category: "Color", shortcut: "F3",
    type: "toggle-amount", uiRank: 2, isf: S.SEPIA },

  { id: "invert", label: "Invert", category: "Color", shortcut: "F1",
    type: "toggle", uiRank: 0, isf: S.INVERT },

  // ── 量子化系（Blur より前に潰す）──
  { id: "posterize", label: "Posterize", category: "Noise",
    type: "continuous", uiRank: 0, isf: S.POSTERIZE,
    ui: { levels: { label: "Levels", factor: 1, unit: "" } } },

  { id: "bitcrush", label: "Bitcrush", category: "Destroy",
    type: "continuous", uiRank: 3, isf: S.BITCRUSH,
    ui: { levels: { label: "Levels", factor: 1, unit: "" },
          dither: { label: "Dither" } } },

  { id: "blur", label: "Blur", category: "Blur", shortcut: "F4",
    type: "continuous", uiRank: 0, isf: S.BLUR,
    ui: { amount: { label: "Radius" } } },

  // ── WARP（歪ませてから壊す）──
  { id: "wave", label: "Wave", category: "Warp",
    type: "continuous", uiRank: 0, isf: S.WAVE,
    ui: { frequency: { label: "Frequency", factor: 1, unit: "" },
          speed: { label: "Speed", factor: 1, unit: "" } } },

  { id: "kaleidoscope", label: "Kaleidoscope", category: "Warp",
    type: "continuous", uiRank: 1, isf: S.KALEIDOSCOPE,
    ui: { segments: { label: "Segments", factor: 1, unit: "" },
          rotation: { label: "Rotation", factor: 1, unit: "\u00B0" },
          zoom: { label: "Zoom", factor: 1, unit: "x" } } },

  { id: "mosaic", label: "Mosaic", category: "Warp",
    type: "continuous", uiRank: 2, isf: S.MOSAIC,
    ui: { cellSize: { label: "Cell", factor: 1, unit: "px" },
          dots: { label: "Dots" } } },

  // ── DESTROY（デジタル破壊系）──
  { id: "sliceShift", label: "Slice Shift", category: "Destroy",
    type: "continuous", uiRank: 0, isf: S.SLICE_SHIFT,
    ui: { sliceCount: { label: "Slices", factor: 1, unit: "" },
          maxShift: { label: "Max Shift" } } },

  { id: "blockGlitch", label: "Block Glitch", category: "Destroy",
    type: "continuous", uiRank: 1, isf: S.BLOCK_GLITCH,
    ui: { blockSize: { label: "Block", factor: 1, unit: "px" } } },

  { id: "chromatic", label: "Chromatic Ab.", category: "Destroy",
    type: "continuous", uiRank: 2, isf: S.CHROMATIC,
    ui: { falloff: { label: "Falloff", factor: 1, unit: "" } } },

  { id: "pixelSort", label: "Pixel Sort", category: "Destroy",
    type: "continuous", uiRank: 4, isf: S.PIXEL_SORT,
    ui: { threshold: { label: "Threshold" },
          reach: { label: "Reach", factor: 1, unit: "px" } } },


  { id: "rgbShift", label: "RGB Shift", category: "Glitch", shortcut: "F8",
    type: "continuous", uiRank: 1, isf: S.RGB_SHIFT },

  { id: "glitch", label: "Glitch", category: "Glitch", shortcut: "F7",
    type: "continuous", uiRank: 0, isf: S.GLITCH },

  { id: "rgbMultiply", label: "RGB Multiply", category: "Glitch", shortcut: "F9",
    type: "continuous", uiRank: 2, isf: S.RGB_MULTIPLY,
    ui: { tint: { label: "Color", stateKey: "color" } } },

  // ── 画面系 / 粒子（最後に全体へ重ねる）──
  { id: "scanlines", label: "Scan Lines", category: "Noise",
    type: "continuous", uiRank: 1, isf: S.SCANLINES,
    ui: { lineFreq: { label: "Line Freq", factor: 1, unit: "" },
          rollSpeed: { label: "Roll", factor: 1, unit: "" } } },

  { id: "crt", label: "CRT", category: "Destroy",
    type: "continuous", uiRank: 5, isf: S.CRT,
    ui: { curvature: { label: "Curvature" },
          scanIntensity: { label: "Scanline" } } },

  { id: "noise", label: "Noise", category: "Noise",
    type: "continuous", uiRank: 2, isf: S.NOISE,
    ui: { mono: { label: "Mono", factor: 1, unit: "" } } },
];

/** 一覧UIのカテゴリ表示順 */
export const CATEGORY_ORDER = ["Color", "Adjust", "Blur", "Warp", "Destroy", "Glitch", "Noise"];

// ── ISFヘッダからのパラメータ導出 ──────────────────────────────────────────────

function vec4ToHex(v) {
  const h = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  return `#${h(v[0])}${h(v[1])}${h(v[2])}`.toUpperCase();
}

function hexToVec4(hex) {
  const h = (hex || "#FF0000").replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
    1.0,
  ];
}

/**
 * ISFヘッダの INPUT 1件 → パラメータ記述。
 * ISF値とUI値の変換規則もここで閉じる（他所で /100 しない）。
 */
function describeParam(input, override = {}) {
  const isColor = input.TYPE === "color";
  const factor = override.factor !== undefined ? override.factor : (isColor ? 1 : 100);
  const unit = override.unit !== undefined ? override.unit : (isColor ? "" : (factor === 100 ? "%" : ""));
  const label = override.label !== undefined ? override.label : (isColor ? "Color" : "Amount");

  const p = {
    isfName: input.NAME,
    stateKey: override.stateKey !== undefined ? override.stateKey : input.NAME,
    type: isColor ? "color" : "float",
    label,
    unit,
    factor,
  };

  if (isColor) {
    p.default = vec4ToHex(input.DEFAULT || [1, 0, 0, 1]);
    p.toISF = (uiValue) => hexToVec4(uiValue);
  } else {
    const isfMin = input.MIN !== undefined ? input.MIN : 0;
    const isfMax = input.MAX !== undefined ? input.MAX : 1;
    const isfDef = input.DEFAULT !== undefined ? input.DEFAULT : 0;
    p.min = isfMin * factor;
    p.max = isfMax * factor;
    p.default = isfDef * factor;
    p.isfMax = isfMax;
    p.isfDefault = isfDef;
    p.toISF = (uiValue) => uiValue / factor;
  }
  return p;
}

/** レジストリ1エントリ → 完全な記述 (パラメータは ISF ヘッダ由来) */
function describeEffect(entry) {
  // parseHeader() は device を要らない。コンパイルはしない（記述の取得だけ）
  const probe = new ISFEffect(entry.id, entry.isf);
  const header = probe.parseHeader();
  const inputs = (header.INPUTS || []).filter((i) => i.TYPE !== "image");
  const params = inputs.map((i) => describeParam(i, (entry.ui && entry.ui[i.NAME]) || {}));
  const floats = params.filter((p) => p.type === "float");

  return {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    shortcut: entry.shortcut,
    type: entry.type,
    uiRank: entry.uiRank !== undefined ? entry.uiRank : 0,
    description: header.DESCRIPTION || entry.label,
    params,
    floats,
    // 適用するかどうかを決める「代表パラメータ」= 最初の float。
    // (RGB Multiply は色だけ変えても適用されない、という従来挙動を保つ)
    gate: floats[0] || null,
  };
}

/** id → 記述。モジュール読み込み時に1回だけ作る */
export const EFFECTS = EFFECT_REGISTRY.map(describeEffect);
export const EFFECT_BY_ID = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));

/** 適用順のid列（= レジストリ順） */
export const EFFECT_ORDER = EFFECTS.map((e) => e.id);

/** name → ISF ソース。MasterEffectChain.registerEffect に渡す */
export const EFFECT_ISF = Object.fromEntries(EFFECT_REGISTRY.map((e) => [e.id, e.isf]));

/** 一覧UI用: カテゴリ順 → uiRank順 にグルーピング */
export function effectsByCategory() {
  const groups = [];
  for (const cat of CATEGORY_ORDER) {
    const items = EFFECTS.filter((e) => e.category === cat)
      .sort((a, b) => a.uiRank - b.uiRank);
    if (items.length) groups.push({ category: cat, items });
  }
  // CATEGORY_ORDER に無いカテゴリも落とさない
  const known = new Set(CATEGORY_ORDER);
  const rest = {};
  for (const e of EFFECTS) {
    if (known.has(e.category)) continue;
    (rest[e.category] = rest[e.category] || []).push(e);
  }
  for (const cat of Object.keys(rest)) {
    groups.push({ category: cat, items: rest[cat].sort((a, b) => a.uiRank - b.uiRank) });
  }
  return groups;
}

/** ショートカットキー → エフェクトid */
export const SHORTCUT_TO_EFFECT = Object.fromEntries(
  EFFECTS.filter((e) => e.shortcut).map((e) => [e.shortcut, e.id])
);

// ── 状態 ──────────────────────────────────────────────────────────────────────

/** レジストリから初期状態を作る */
export function createEffectsState() {
  const state = {};
  for (const e of EFFECTS) {
    const s = {};
    if (e.type === "toggle" || e.type === "toggle-amount") s.enabled = false;
    if (e.type !== "toggle") {
      for (const p of e.params) s[p.stateKey] = p.default;
    }
    state[e.id] = s;
  }
  return state;
}

/** そのエフェクトが適用対象か（代表パラメータが既定値から動いているか） */
export function isEffectActive(effect, st) {
  if (!st) return false;
  if (effect.type === "toggle") return !!st.enabled;
  if (!effect.gate) return effect.type === "toggle-amount" ? !!st.enabled : false;
  const ui = st[effect.gate.stateKey];
  const moved = ui !== undefined && ui !== effect.gate.default;
  return effect.type === "toggle-amount" ? !!st.enabled && moved : moved;
}

/**
 * 状態 → ISF に渡すチェーン。レジストリ順に「効いているものだけ」積む。
 * @returns {Array<{name:string, params:Object}>}
 */
export function buildActiveChain(effectsState) {
  const chain = [];
  for (const e of EFFECTS) {
    const st = effectsState[e.id];
    if (!isEffectActive(e, st)) continue;

    const params = {};
    for (const p of e.params) {
      if (e.type === "toggle" && p.type === "float") {
        // ON = 全開（Invert の従来挙動: amount 1.0）
        params[p.isfName] = p.isfMax;
      } else {
        const ui = st[p.stateKey] !== undefined ? st[p.stateKey] : p.default;
        params[p.isfName] = p.toISF(ui);
      }
    }
    chain.push({ name: e.id, params });
  }
  return chain;
}
