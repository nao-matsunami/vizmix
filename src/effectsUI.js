/**
 * VizMix - Effects UI Module (Resolume-style)
 * v0.6.0
 */

// エフェクト定義
const effectDefinitions = {
  invert: {
    name: 'Invert',
    category: 'Color',
    shortcut: 'F1',
    type: 'toggle',
    params: []
  },
  grayscale: {
    name: 'Grayscale',
    category: 'Color',
    shortcut: 'F2',
    type: 'toggle-amount',
    params: [
      { name: 'Amount', key: 'amount', min: 0, max: 100, default: 100, unit: '%' }
    ]
  },
  sepia: {
    name: 'Sepia',
    category: 'Color',
    shortcut: 'F3',
    type: 'toggle-amount',
    params: [
      { name: 'Amount', key: 'amount', min: 0, max: 100, default: 100, unit: '%' }
    ]
  },
  blur: {
    name: 'Blur',
    category: 'Blur',
    shortcut: 'F4',
    type: 'continuous',
    params: [
      { name: 'Radius', key: 'amount', min: 0, max: 100, default: 0, unit: '%' }
    ]
  },
  brightness: {
    name: 'Brightness',
    category: 'Adjust',
    shortcut: 'F5',
    type: 'continuous',
    params: [
      { name: 'Amount', key: 'amount', min: -100, max: 100, default: 0, unit: '' }
    ]
  },
  contrast: {
    name: 'Contrast',
    category: 'Adjust',
    shortcut: 'F6',
    type: 'continuous',
    params: [
      { name: 'Amount', key: 'amount', min: -100, max: 100, default: 0, unit: '' }
    ]
  }
};

// カテゴリ順序
const categoryOrder = ['Color', 'Adjust', 'Blur'];

let currentEffectsState = null;
let onEffectChangeCallback = null;
let selectedEffect = null;

/**
 * エフェクトUIを初期化
 */
export function initEffectsUI(effectsState, onEffectChange) {
  currentEffectsState = effectsState;
  onEffectChangeCallback = onEffectChange;

  // パネル折りたたみ
  const header = document.getElementById('effectsHeader');
  if (header) {
    header.addEventListener('click', togglePanel);
  }

  // エフェクト項目クリック
  document.querySelectorAll('.effect-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const effectKey = item.dataset.effect;
      if (effectKey) {
        selectEffect(effectKey);
      }
    });

    // ダブルクリックでトグル
    item.addEventListener('dblclick', (e) => {
      const effectKey = item.dataset.effect;
      const def = effectDefinitions[effectKey];
      if (def && (def.type === 'toggle' || def.type === 'toggle-amount')) {
        toggleEffect(effectKey);
      }
    });
  });

  // 初期状態を反映
  updateAllIndicators();

  console.log('Effects UI initialized');
}

/**
 * パネル折りたたみ切替
 */
function togglePanel() {
  const panel = document.querySelector('.effects-panel');
  if (panel) {
    panel.classList.toggle('collapsed');
  }
}

/**
 * エフェクト選択
 */
function selectEffect(effectKey) {
  selectedEffect = effectKey;

  // アクティブ表示更新
  document.querySelectorAll('.effect-item').forEach(el => {
    el.classList.toggle('active', el.dataset.effect === effectKey);
  });

  // パラメータパネル表示
  showEffectParams(effectKey);
}

/**
 * エフェクトトグル
 */
function toggleEffect(effectKey) {
  const def = effectDefinitions[effectKey];
  if (!def) return;

  if (def.type === 'toggle') {
    const current = currentEffectsState[effectKey]?.enabled ?? false;
    updateEffect(effectKey, 'enabled', !current);
  } else if (def.type === 'toggle-amount') {
    const current = currentEffectsState[effectKey]?.enabled ?? false;
    updateEffect(effectKey, 'enabled', !current);
  }
}

/**
 * エフェクト値更新
 */
function updateEffect(effectKey, property, value) {
  if (onEffectChangeCallback) {
    onEffectChangeCallback(effectKey, property, value);
  }

  // インジケーター更新
  updateIndicator(effectKey);

  // パラメータパネルが開いていれば更新
  if (selectedEffect === effectKey) {
    updateParamPanel(effectKey);
  }
}

/**
 * パラメータパネル表示
 */
function showEffectParams(effectKey) {
  const def = effectDefinitions[effectKey];
  const paramsEl = document.getElementById('effectParams');
  if (!def || !paramsEl) return;

  const state = currentEffectsState[effectKey] || {};

  let html = `
    <div class="param-header">
      <span class="param-title">${def.name}</span>
      <button class="param-close" id="paramClose">×</button>
    </div>
  `;

  // トグル付きの場合
  if (def.type === 'toggle' || def.type === 'toggle-amount') {
    const isEnabled = state.enabled ?? false;
    html += `
      <div class="param-row">
        <span class="param-label">Enabled</span>
        <label class="toggle-switch">
          <input type="checkbox" id="param-enabled" ${isEnabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  // パラメータスライダー
  def.params.forEach(param => {
    const currentValue = state[param.key] ?? param.default;
    html += `
      <div class="param-row">
        <span class="param-label">${param.name}</span>
        <input type="range" class="param-slider"
               id="param-${param.key}"
               min="${param.min}" max="${param.max}" value="${currentValue}">
        <span class="param-value" id="param-${param.key}-value">
          ${currentValue}${param.unit}
        </span>
      </div>
    `;
  });

  html += `<div class="param-shortcut">Shortcut: <kbd>${def.shortcut}</kbd></div>`;

  paramsEl.innerHTML = html;
  paramsEl.classList.remove('hidden');

  // イベントバインド
  bindParamEvents(effectKey, def);
}

/**
 * パラメータイベントバインド
 */
function bindParamEvents(effectKey, def) {
  // 閉じるボタン
  const closeBtn = document.getElementById('paramClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideEffectParams);
  }

  // トグル
  const enabledEl = document.getElementById('param-enabled');
  if (enabledEl) {
    enabledEl.addEventListener('change', (e) => {
      updateEffect(effectKey, 'enabled', e.target.checked);
    });
  }

  // スライダー
  def.params.forEach(param => {
    const slider = document.getElementById(`param-${param.key}`);
    const valueEl = document.getElementById(`param-${param.key}-value`);
    if (slider && valueEl) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valueEl.textContent = `${val}${param.unit}`;
        updateEffect(effectKey, param.key, val);
      });
    }
  });
}

/**
 * パラメータパネル更新（値のみ）
 */
function updateParamPanel(effectKey) {
  const def = effectDefinitions[effectKey];
  const state = currentEffectsState[effectKey] || {};

  // トグル更新
  const enabledEl = document.getElementById('param-enabled');
  if (enabledEl) {
    enabledEl.checked = state.enabled ?? false;
  }

  // スライダー更新
  def.params.forEach(param => {
    const slider = document.getElementById(`param-${param.key}`);
    const valueEl = document.getElementById(`param-${param.key}-value`);
    if (slider && valueEl) {
      const val = state[param.key] ?? param.default;
      slider.value = val;
      valueEl.textContent = `${val}${param.unit}`;
    }
  });
}

/**
 * パラメータパネル非表示
 */
export function hideEffectParams() {
  const paramsEl = document.getElementById('effectParams');
  if (paramsEl) {
    paramsEl.classList.add('hidden');
  }
  document.querySelectorAll('.effect-item').forEach(el => {
    el.classList.remove('active');
  });
  selectedEffect = null;
}

/**
 * インジケーター更新
 */
function updateIndicator(effectKey) {
  const item = document.querySelector(`.effect-item[data-effect="${effectKey}"]`);
  if (!item) return;

  const def = effectDefinitions[effectKey];
  const state = currentEffectsState[effectKey] || {};

  let isActive = false;
  if (def.type === 'toggle' || def.type === 'toggle-amount') {
    isActive = state.enabled ?? false;
  } else if (def.type === 'continuous') {
    // continuous の場合、デフォルト値以外ならアクティブ
    const param = def.params[0];
    if (param) {
      const val = state[param.key] ?? param.default;
      isActive = val !== param.default;
    }
  }

  item.classList.toggle('enabled', isActive);
}

/**
 * 全インジケーター更新
 */
function updateAllIndicators() {
  Object.keys(effectDefinitions).forEach(key => {
    updateIndicator(key);
  });
}

/**
 * 外部からの状態更新（MIDI等）
 */
export function syncEffectsUI(newState) {
  currentEffectsState = newState;
  updateAllIndicators();
  if (selectedEffect) {
    updateParamPanel(selectedEffect);
  }
}

/**
 * キーボードショートカット処理
 */
export function handleEffectShortcut(key) {
  const mapping = {
    'F1': 'invert',
    'F2': 'grayscale',
    'F3': 'sepia',
    'F4': 'blur',
    'F5': 'brightness',
    'F6': 'contrast'
  };

  const effectKey = mapping[key];
  if (!effectKey) return false;

  const def = effectDefinitions[effectKey];

  if (def.type === 'toggle' || def.type === 'toggle-amount') {
    toggleEffect(effectKey);
  } else if (def.type === 'continuous') {
    // continuous はリセット
    const param = def.params[0];
    if (param) {
      updateEffect(effectKey, param.key, param.default);
    }
  }

  return true;
}

export { effectDefinitions };
