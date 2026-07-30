/**
 * VizMix - Effects Manager
 *
 * 状態・setter・reset・シリアライズは **すべて effectRegistry から導出** する。
 * エフェクトごとの手書きは無い（1本足すのに触るのは effectSources.js と
 * effectRegistry.js の2ファイルだけ）。
 */

import {
  EFFECTS, EFFECT_BY_ID, createEffectsState, buildActiveChain, isEffectActive,
} from "./effectRegistry.js";

/** エフェクト状態。レジストリから生成 */
export const effectsState = createEffectsState();

function paramOf(effect, key) {
  return effect.params.find((p) => p.stateKey === key) || null;
}

function clampParam(param, value) {
  if (!param) return value;
  if (param.type === "color") return value;
  const v = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(v)) return param.default;
  return Math.max(param.min, Math.min(param.max, v));
}

// ── 更新 ──────────────────────────────────────────────────────────────────────

/**
 * パラメータを UI 値で設定する（範囲はレジストリの min/max でクランプ）。
 * @returns 設定後の値
 */
export function setEffectParam(effectId, key, value) {
  const effect = EFFECT_BY_ID[effectId];
  if (!effect) return undefined;
  const st = effectsState[effectId];
  if (key === "enabled") {
    st.enabled = !!value;
    return st.enabled;
  }
  const param = paramOf(effect, key);
  if (!param) return undefined;
  st[key] = clampParam(param, value);
  return st[key];
}

/**
 * ON/OFF を反転する。
 * toggle-amount で「量が既定値のまま」なら全開にする（従来の
 * toggleGrayscale / toggleSepia が amount 0 → 100 にしていた挙動）。
 */
export function toggleEffectEnabled(effectId) {
  const effect = EFFECT_BY_ID[effectId];
  if (!effect) return false;
  const st = effectsState[effectId];
  st.enabled = !st.enabled;
  if (st.enabled && effect.type === "toggle-amount" && effect.gate) {
    const g = effect.gate;
    if (st[g.stateKey] === g.default) st[g.stateKey] = g.max;
  }
  return st.enabled;
}

export function resetEffect(effectId) {
  const effect = EFFECT_BY_ID[effectId];
  if (!effect) return;
  const st = effectsState[effectId];
  if (effect.type === "toggle" || effect.type === "toggle-amount") st.enabled = false;
  if (effect.type !== "toggle") {
    for (const p of effect.params) st[p.stateKey] = p.default;
  }
}

export function resetAllEffects() {
  for (const e of EFFECTS) resetEffect(e.id);
}

// ── 読み出し ──────────────────────────────────────────────────────────────────

/** 現在の状態から ISF チェーンを組む（レジストリ順・中立値は積まない） */
export function getActiveChain() {
  return buildActiveChain(effectsState);
}

/** そのエフェクトが今効いているか（一覧のインジケーター用） */
export function isActive(effectId) {
  const effect = EFFECT_BY_ID[effectId];
  return effect ? isEffectActive(effect, effectsState[effectId]) : false;
}

// ── 同期 (BroadcastChannel) ───────────────────────────────────────────────────

export function serializeEffectsState() {
  return JSON.parse(JSON.stringify(effectsState));
}

/**
 * 出力ウィンドウ側での復元。
 * 未知のキー/エフェクトは無視し、既知のものだけ取り込む（前方・後方互換）。
 */
export function deserializeEffectsState(data) {
  if (!data) return;
  for (const e of EFFECTS) {
    const incoming = data[e.id];
    if (!incoming || typeof incoming !== "object") continue;
    const st = effectsState[e.id];
    if (incoming.enabled !== undefined && (e.type === "toggle" || e.type === "toggle-amount")) {
      st.enabled = !!incoming.enabled;
    }
    for (const p of e.params) {
      if (incoming[p.stateKey] === undefined) continue;
      st[p.stateKey] = clampParam(p, incoming[p.stateKey]);
    }
  }
}
