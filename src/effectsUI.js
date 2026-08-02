/**
 * VizMix - Effects UI Module (Resolume-style)
 *
 * 一覧・パラメータパネル・ショートカットを **effectRegistry から生成** する。
 * 静的HTMLにエフェクト項目を書かないので、レジストリに載せれば必ずUIに出る
 * （旧実装では index.html への追記漏れで Saturate / Hue Rotate が死蔵していた）。
 */

import {
  EFFECTS, EFFECT_BY_ID, effectsByCategory, SHORTCUT_TO_EFFECT, isEffectActive,
} from "./effectRegistry.js";

// 旧 effectDefinitions 互換のビュー（外部から参照されている場合のため）
const effectDefinitions = Object.fromEntries(
  EFFECTS.map((e) => [e.id, {
    name: e.label,
    category: e.category,
    shortcut: e.shortcut,
    type: e.type,
    params: e.params.map((p) => ({
      name: p.label, key: p.stateKey, type: p.type === "color" ? "color" : undefined,
      min: p.min, max: p.max, default: p.default, unit: p.unit,
    })),
  }])
);

const colorPresets = [
  { label: "R", color: "#FF0000" },
  { label: "G", color: "#00FF00" },
  { label: "B", color: "#0000FF" },
  { label: "C", color: "#00FFFF" },
  { label: "M", color: "#FF00FF" },
  { label: "Y", color: "#FFFF00" },
];

let currentEffectsState = null;
let onEffectChangeCallback = null;
let selectedEffect = null;

/**
 * 一覧の DOM を生成する。
 * MIDI の learnable target が [data-effect=...] を querySelector で拾うため、
 * それより先に呼ぶ必要がある（main.js の initUI 冒頭で呼んでいる）。
 */
export function buildEffectsList() {
  const list = document.getElementById("effectsList");
  if (!list) {
    console.warn("[effectsUI] #effectsList not found");
    return;
  }
  let html = "";
  for (const group of effectsByCategory()) {
    html += `<div class="effect-category">${group.category}</div>`;
    for (const e of group.items) {
      html += `
              <div class="effect-item" data-effect="${e.id}">
                <span class="effect-indicator"></span>
                <span class="effect-name">${e.label}</span>
                <span class="effect-shortcut">${e.shortcut || ""}</span>
              </div>`;
    }
  }
  list.innerHTML = html;
}

/**
 * エフェクトUIを初期化
 */
export function initEffectsUI(effectsState, onEffectChange) {
  currentEffectsState = effectsState;
  onEffectChangeCallback = onEffectChange;

  // 一覧が未生成なら作る（buildEffectsList を単独で呼んでいない経路の保険）
  const list = document.getElementById("effectsList");
  if (list && !list.querySelector(".effect-item")) buildEffectsList();

  initFxSidePanel();

  document.querySelectorAll(".effect-item").forEach((item) => {
    item.addEventListener("click", () => {
      const effectKey = item.dataset.effect;
      if (effectKey) selectEffect(effectKey);
    });

    // ダブルクリックで ON/OFF（マニュアル記載の仕様。型を問わず全エフェクト）
    item.addEventListener("dblclick", () => {
      const effectKey = item.dataset.effect;
      if (EFFECT_BY_ID[effectKey]) toggleEffect(effectKey);
    });
  });

  updateAllIndicators();

  console.log(`Effects UI initialized (${EFFECTS.length} effects from registry)`);
}

/**
 * サイドパネル開閉トグル
 */
function initFxSidePanel() {
  const panel = document.getElementById("fx-side-panel");
  const closeBtn = document.getElementById("fx-panel-close");
  const toggleBtn = document.getElementById("fx-panel-toggle");

  if (!panel || !closeBtn || !toggleBtn) return;

  closeBtn.addEventListener("click", () => {
    panel.classList.add("fx-panel-closed");
    toggleBtn.classList.remove("fx-toggle-hidden");
  });

  toggleBtn.addEventListener("click", () => {
    panel.classList.remove("fx-panel-closed");
    toggleBtn.classList.add("fx-toggle-hidden");
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;

    if (e.key === "Tab") {
      e.preventDefault();
      if (panel.classList.contains("fx-panel-closed")) {
        panel.classList.remove("fx-panel-closed");
        toggleBtn.classList.add("fx-toggle-hidden");
      } else {
        panel.classList.add("fx-panel-closed");
        toggleBtn.classList.remove("fx-toggle-hidden");
      }
    }
  });

  const saved = localStorage.getItem("vizmix_fx_panel_open");
  if (saved === "false") {
    panel.classList.add("fx-panel-closed");
    toggleBtn.classList.remove("fx-toggle-hidden");
  }

  const observer = new MutationObserver(() => {
    const isOpen = !panel.classList.contains("fx-panel-closed");
    localStorage.setItem("vizmix_fx_panel_open", isOpen.toString());
  });
  observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
}

/**
 * エフェクト選択
 */
function selectEffect(effectKey) {
  selectedEffect = effectKey;

  document.querySelectorAll(".effect-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.effect === effectKey);
  });

  showEffectParams(effectKey);
}

/**
 * エフェクトトグル
 */
function toggleEffect(effectKey) {
  const def = EFFECT_BY_ID[effectKey];
  if (!def) return;
  const current = currentEffectsState[effectKey]?.enabled ?? false;
  updateEffect(effectKey, "enabled", !current);
}

/**
 * エフェクト値更新
 */
function updateEffect(effectKey, property, value) {
  if (onEffectChangeCallback) {
    onEffectChangeCallback(effectKey, property, value);
  }

  updateIndicator(effectKey);

  if (selectedEffect === effectKey) {
    updateParamPanel(effectKey);
  }
}

/**
 * パラメータパネル表示（レジストリのパラメータ記述から生成）
 */
function showEffectParams(effectKey) {
  const def = EFFECT_BY_ID[effectKey];
  const paramsEl = document.getElementById("effectParams");
  if (!def || !paramsEl) return;

  const state = currentEffectsState[effectKey] || {};

  let html = `
    <div class="param-header">
      <span class="param-title">${def.label}</span>
      <button class="param-close" id="paramClose">×</button>
    </div>
  `;

  {
    const isEnabled = state.enabled ?? false;
    html += `
      <div class="param-row">
        <span class="param-label">Enabled</span>
        <label class="toggle-switch">
          <input type="checkbox" id="param-enabled" ${isEnabled ? "checked" : ""}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  // 'toggle' は量を UI に出さない（ON で全開）
  const shown = def.type === "toggle" ? [] : def.params;

  shown.forEach((param) => {
    const currentValue = state[param.stateKey] ?? param.default;
    if (param.type === "color") {
      html += `
        <div class="param-row">
          <span class="param-label">${param.label}</span>
          <input type="color" id="param-${param.stateKey}" value="${currentValue}" style="width:32px;height:24px;border:none;background:none;cursor:pointer;">
          <div class="color-presets" style="display:flex;gap:3px;margin-left:8px;">
            ${colorPresets.map((p) => `<button class="color-preset-btn" data-color="${p.color}" style="width:22px;height:22px;background:${p.color};border:1px solid #555;border-radius:3px;cursor:pointer;font-size:8px;color:#fff;line-height:22px;text-align:center;">${p.label}</button>`).join("")}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="param-row">
          <span class="param-label">${param.label}</span>
          <input type="range" class="param-slider"
                 id="param-${param.stateKey}"
                 min="${param.min}" max="${param.max}" value="${currentValue}">
          <span class="param-value" id="param-${param.stateKey}-value">
            ${currentValue}${param.unit}
          </span>
        </div>
      `;
    }
  });

  if (def.shortcut) {
    html += `<div class="param-shortcut">Shortcut: <kbd>${def.shortcut}</kbd></div>`;
  }

  paramsEl.innerHTML = html;
  paramsEl.classList.remove("hidden");

  bindParamEvents(effectKey, def, shown);
}

/**
 * パラメータイベントバインド
 */
function bindParamEvents(effectKey, def, shown) {
  const closeBtn = document.getElementById("paramClose");
  if (closeBtn) closeBtn.addEventListener("click", hideEffectParams);

  const enabledEl = document.getElementById("param-enabled");
  if (enabledEl) {
    enabledEl.addEventListener("change", (e) => {
      updateEffect(effectKey, "enabled", e.target.checked);
    });
  }

  shown.forEach((param) => {
    if (param.type === "color") {
      const colorInput = document.getElementById(`param-${param.stateKey}`);
      if (colorInput) {
        colorInput.addEventListener("input", (e) => {
          updateEffect(effectKey, param.stateKey, e.target.value);
        });
      }
      document.querySelectorAll(".color-preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const color = btn.dataset.color;
          if (colorInput) colorInput.value = color;
          updateEffect(effectKey, param.stateKey, color);
        });
      });
    } else {
      const slider = document.getElementById(`param-${param.stateKey}`);
      const valueEl = document.getElementById(`param-${param.stateKey}-value`);
      if (slider && valueEl) {
        slider.addEventListener("input", (e) => {
          const val = parseFloat(e.target.value);
          valueEl.textContent = `${val}${param.unit}`;
          updateEffect(effectKey, param.stateKey, val);
        });
      }
    }
  });
}

/**
 * パラメータパネル更新（値のみ）
 */
function updateParamPanel(effectKey) {
  const def = EFFECT_BY_ID[effectKey];
  if (!def) return;
  const state = currentEffectsState[effectKey] || {};

  const enabledEl = document.getElementById("param-enabled");
  if (enabledEl) enabledEl.checked = state.enabled ?? false;

  const shown = def.type === "toggle" ? [] : def.params;
  shown.forEach((param) => {
    if (param.type === "color") {
      const colorInput = document.getElementById(`param-${param.stateKey}`);
      if (colorInput) colorInput.value = state[param.stateKey] ?? param.default;
    } else {
      const slider = document.getElementById(`param-${param.stateKey}`);
      const valueEl = document.getElementById(`param-${param.stateKey}-value`);
      if (slider && valueEl) {
        const val = state[param.stateKey] ?? param.default;
        slider.value = val;
        valueEl.textContent = `${val}${param.unit}`;
      }
    }
  });
}

/**
 * パラメータパネル非表示
 */
export function hideEffectParams() {
  const paramsEl = document.getElementById("effectParams");
  if (paramsEl) paramsEl.classList.add("hidden");
  document.querySelectorAll(".effect-item").forEach((el) => el.classList.remove("active"));
  selectedEffect = null;
}

/**
 * インジケーター更新（「効いているか」はレジストリの判定に一本化）
 */
function updateIndicator(effectKey) {
  const item = document.querySelector(`.effect-item[data-effect="${effectKey}"]`);
  if (!item) return;
  const def = EFFECT_BY_ID[effectKey];
  if (!def) return;
  item.classList.toggle("enabled", isEffectActive(def, currentEffectsState[effectKey]));
}

function updateAllIndicators() {
  for (const e of EFFECTS) updateIndicator(e.id);
}

/**
 * 外部からの状態更新（MIDI等）
 */
export function syncEffectsUI(newState) {
  currentEffectsState = newState;
  updateAllIndicators();
  if (selectedEffect) updateParamPanel(selectedEffect);
}

/**
 * キーボードショートカット処理（割当はレジストリの shortcut から導出）
 */
export function handleEffectShortcut(key) {
  const effectKey = SHORTCUT_TO_EFFECT[key];
  if (!effectKey) return false;

  const def = EFFECT_BY_ID[effectKey];
  if (!def) return false;

  if (def.type === "toggle" || def.type === "toggle-amount") {
    toggleEffect(effectKey);
  } else if (def.gate) {
    // continuous は代表パラメータを既定値に戻す（従来どおりリセット動作）
    updateEffect(effectKey, def.gate.stateKey, def.gate.default);
  }
  return true;
}

export { effectDefinitions };
