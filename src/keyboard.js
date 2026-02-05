/**
 * VizMix - Keyboard Manager
 * v0.6.0
 */

const KEY_MAP = {
  'Digit1': { action: 'bankA', value: 0 },
  'Digit2': { action: 'bankA', value: 1 },
  'Digit3': { action: 'bankA', value: 2 },
  'Digit4': { action: 'bankA', value: 3 },
  'Digit5': { action: 'bankA', value: 4 },
  'Digit6': { action: 'bankA', value: 5 },
  'Digit7': { action: 'bankA', value: 6 },
  'Digit8': { action: 'bankA', value: 7 },

  'KeyQ': { action: 'bankB', value: 0 },
  'KeyW': { action: 'bankB', value: 1 },
  'KeyE': { action: 'bankB', value: 2 },
  'KeyR': { action: 'bankB', value: 3 },
  'KeyT': { action: 'bankB', value: 4 },
  'KeyY': { action: 'bankB', value: 5 },
  'KeyU': { action: 'bankB', value: 6 },
  'KeyI': { action: 'bankB', value: 7 },

  'KeyA': { action: 'crossfade', value: 0 },
  'KeyS': { action: 'crossfade', value: 50 },
  'KeyD': { action: 'crossfade', value: 100 },

  'Space': { action: 'tap' },
  'ArrowUp': { action: 'bpmAdjust', value: 1 },
  'ArrowDown': { action: 'bpmAdjust', value: -1 },
  'KeyP': { action: 'bpmToggle' },

  'KeyX': { action: 'autoSwitchToggle' },
  'BracketLeft': { action: 'intervalDecrease' },
  'BracketRight': { action: 'intervalIncrease' },

  'KeyO': { action: 'openOutput' },
  'KeyH': { action: 'showHelp' },

  'F1': { action: 'fxInvert' },
  'F2': { action: 'fxGrayscale' },
  'F3': { action: 'fxSepia' },
  'F4': { action: 'fxBlurReset' },
  'F5': { action: 'fxBrightnessReset' },
  'F6': { action: 'fxContrastReset' },
};

const SHIFT_KEY_MAP = {
  'ArrowUp': { action: 'bpmAdjust', value: 5 },
  'ArrowDown': { action: 'bpmAdjust', value: -5 },
};

// 連続移動キー
const CONTINUOUS_KEYS = ['ArrowLeft', 'ArrowRight', 'Comma', 'Period'];

let callbacks = {};

// 連続移動用の状態
let continuousMove = {
  active: false,
  direction: 0,
  speed: 5,
  intervalId: null,
};

// 連続移動の開始
function startContinuousMove(direction, speed) {
  if (continuousMove.intervalId) return;

  continuousMove.active = true;
  continuousMove.direction = direction;
  continuousMove.speed = speed;

  // 最初の1回
  if (callbacks.crossfadeAdjust) {
    callbacks.crossfadeAdjust(direction * speed);
  }

  // 100msごとに繰り返し
  continuousMove.intervalId = setInterval(() => {
    if (callbacks.crossfadeAdjust) {
      callbacks.crossfadeAdjust(continuousMove.direction * continuousMove.speed);
    }
  }, 100);
}

// 連続移動の停止
function stopContinuousMove() {
  if (continuousMove.intervalId) {
    clearInterval(continuousMove.intervalId);
    continuousMove.intervalId = null;
  }
  continuousMove.active = false;
}

export function initKeyboard(actionCallbacks) {
  callbacks = actionCallbacks;
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  console.log('Keyboard shortcuts initialized');
}

export function destroyKeyboard() {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  stopContinuousMove();
}

function handleKeyDown(e) {
  if (e.target.matches('input, textarea, select')) return;

  // デバッグ: キー入力をログ出力
  console.log(`[Keyboard] code: ${e.code}, key: ${e.key}, ctrl: ${e.ctrlKey}, shift: ${e.shiftKey}`);

  // デバッグオーバーレイ: Ctrl+Shift+D
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
    e.preventDefault();
    console.log('[Keyboard] Debug overlay triggered');
    if (callbacks.debugToggle) callbacks.debugToggle();
    return;
  }

  // 連続移動キー（←→<>）
  if (CONTINUOUS_KEYS.includes(e.code) && !continuousMove.active) {
    e.preventDefault();
    const direction = (e.code === 'ArrowLeft' || e.code === 'Comma') ? -1 : 1;
    const speed = e.shiftKey ? 5 : 1; // 通常±1%, Shift±5%
    startContinuousMove(direction, speed);
    return;
  }

  // 修飾キーとの組み合わせは無視（Shiftは除く）
  if (e.ctrlKey || e.altKey) return;

  // 通常のキー処理
  const mapping = e.shiftKey && SHIFT_KEY_MAP[e.code]
    ? SHIFT_KEY_MAP[e.code]
    : KEY_MAP[e.code];

  console.log(`[Keyboard] Mapping for ${e.code}:`, mapping);

  if (!mapping) return;

  const callback = callbacks[mapping.action];
  console.log(`[Keyboard] Action: ${mapping.action}, callback exists: ${!!callback}`);
  if (callback) {
    e.preventDefault();
    callback(mapping.value);
  }
}

function handleKeyUp(e) {
  if (CONTINUOUS_KEYS.includes(e.code)) {
    stopContinuousMove();
  }
}

export function getShortcutList() {
  return `
=== VizMix Keyboard Shortcuts ===

[Channel A]  1 2 3 4 5 6 7 8
[Channel B]  Q W E R T Y U I

[Crossfader]
A = Left (100% A)
S = Center (50/50)
D = Right (100% B)
← → = Adjust ±1% (hold to repeat)
< > = Adjust ±1% (hold to repeat)
Shift + ← → = Adjust ±5%

[BPM]
Space = Tap tempo
↑ ↓ = ±1 BPM
Shift + ↑ ↓ = ±5 BPM
P = Play/Pause

[Auto Switch]
X = Toggle
[ ] = Change interval

[Effects]
F1 = Invert ON/OFF
F2 = Grayscale ON/OFF
F3 = Sepia ON/OFF
F4 = Blur Reset
F5 = Brightness Reset
F6 = Contrast Reset

[Other]
O = Open Output
H = This help
Ctrl+Shift+D = Debug overlay
`;
}
