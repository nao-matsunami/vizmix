# VizMix v0.3.0 → v0.5.0 統合実装指示書

## 概要

3つのバージョンを順番に実装し、v0.5.0 を完成させる。

| バージョン | 機能 |
|-----------|------|
| v0.3.0 | サムネール表示 + 設定保存 |
| v0.4.0 | キーボードショートカット |
| v0.5.0 | MIDI コントローラー対応 |

- **現在のバージョン**: v0.2.0（BPM機能実装済み）
- **作業ディレクトリ**: `D:\PlayCanvas\wb-vj`
- **技術スタック**: PlayCanvas 2.14.4 + Vite

---

# Phase 1: v0.3.0 - サムネール・設定保存

## 1.1 サムネール表示

### 要件
- 動画ドロップ時にバンクボタンにサムネール画像を表示
- シェーダードロップ時に1フレームキャプチャして表示
- サムネールサイズ: 128x72px（JPEG 70%品質）
- 数字は右下に小さく表示

### 新規ファイル: `src/thumbnail.js`

```javascript
/**
 * VizMix - Thumbnail Generator
 */

/**
 * 動画からサムネールを生成
 * @param {string} videoUrl - 動画のURL
 * @returns {Promise<string>} - Base64 データURL
 */
export async function generateVideoThumbnail(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 72;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      video.remove();
      resolve(dataUrl);
    };
    
    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = videoUrl;
  });
}

/**
 * シェーダーからサムネールを生成
 * shaderRendererのrenderTargetからピクセルを読み取る
 */
export function generateShaderThumbnail(gl, renderTarget, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  
  // WebGLからピクセルを読み取り
  const pixels = new Uint8Array(width * height * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  
  // ImageDataに変換（上下反転）
  const imageData = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = pixels[srcIdx];
      imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
      imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
      imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }
  
  // リサイズして描画
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0, 128, 72);
  
  return canvas.toDataURL('image/jpeg', 0.7);
}

/**
 * バンクボタンにサムネールを設定
 */
export function setButtonThumbnail(button, thumbnailDataUrl) {
  if (thumbnailDataUrl) {
    button.style.backgroundImage = `url(${thumbnailDataUrl})`;
    button.style.backgroundSize = 'cover';
    button.style.backgroundPosition = 'center';
    button.classList.add('has-thumbnail');
  } else {
    button.style.backgroundImage = '';
    button.classList.remove('has-thumbnail');
  }
}
```

### バンクボタンHTML構造を更新

```html
<button class="bank-btn" data-index="0" data-channel="A">
  <span class="bank-number">1</span>
</button>
```

### style.css に追加

```css
.bank-btn {
  position: relative;
  background-size: cover;
  background-position: center;
}

.bank-btn .bank-number {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.bank-btn.has-thumbnail {
  color: transparent;
}

.bank-btn.has-thumbnail .bank-number,
.bank-btn:hover .bank-number {
  opacity: 1;
}
```

---

## 1.2 設定保存

### 新規ファイル: `src/storage.js`

```javascript
/**
 * VizMix - Storage Manager
 */

const SETTINGS_KEY = 'vizmix-settings';
const SHADERS_KEY = 'vizmix-shaders';

const defaultSettings = {
  version: '0.3.0',
  bpm: 120,
  crossfade: 50,
  autoSwitch: { enabled: false, interval: 4 },
  banks: {
    A: Array(8).fill(null).map(() => ({ type: 'video', url: null, thumbnail: null, name: null })),
    B: Array(8).fill(null).map(() => ({ type: 'video', url: null, thumbnail: null, name: null })),
  },
};

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error('Failed to save settings:', e);
    return false;
  }
}

export function loadSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { ...defaultSettings };
}

export function saveShaderCode(channel, index, code) {
  try {
    const data = localStorage.getItem(SHADERS_KEY);
    const shaders = data ? JSON.parse(data) : { A: Array(8).fill(null), B: Array(8).fill(null) };
    shaders[channel][index] = code;
    localStorage.setItem(SHADERS_KEY, JSON.stringify(shaders));
    return true;
  } catch (e) {
    console.error('Failed to save shader:', e);
    return false;
  }
}

export function loadAllShaders() {
  try {
    const data = localStorage.getItem(SHADERS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load shaders:', e);
  }
  return { A: Array(8).fill(null), B: Array(8).fill(null) };
}

export function updateBankSettings(channel, index, bankData) {
  const settings = loadSettings();
  settings.banks[channel][index] = { ...settings.banks[channel][index], ...bankData };
  saveSettings(settings);
}

export function updateBpmSettings(bpm, autoSwitch = null) {
  const settings = loadSettings();
  settings.bpm = bpm;
  if (autoSwitch !== null) settings.autoSwitch = autoSwitch;
  saveSettings(settings);
}

export function updateCrossfade(value) {
  const settings = loadSettings();
  settings.crossfade = value;
  saveSettings(settings);
}

export function clearSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(SHADERS_KEY);
  console.log('Settings cleared');
}
```

### main.js への統合

```javascript
import { loadSettings, loadAllShaders, updateBankSettings, updateBpmSettings, updateCrossfade, saveShaderCode, clearSettings } from './storage.js';
import { generateVideoThumbnail, setButtonThumbnail } from './thumbnail.js';

// 起動時に設定を復元
async function restoreSettings() {
  const settings = loadSettings();
  const shaders = loadAllShaders();
  
  // BPM復元
  setBPM(settings.bpm);
  document.getElementById('bpmInput').value = settings.bpm;
  
  // クロスフェーダー復元
  document.getElementById('crossfader').value = settings.crossfade;
  setCrossfade(settings.crossfade / 100);
  
  // 自動切替復元
  document.getElementById('autoSwitchEnabled').checked = settings.autoSwitch.enabled;
  document.getElementById('switchInterval').value = settings.autoSwitch.interval;
  
  // バンク復元
  for (const channel of ['A', 'B']) {
    for (let i = 0; i < 8; i++) {
      const bank = settings.banks[channel][i];
      const shaderCode = shaders[channel][i];
      const btn = document.querySelector(`#bank${channel} .bank-btn[data-index="${i}"]`);
      
      if (bank.type === 'shader' && shaderCode) {
        setShaderSource(channel, i, shaderCode, bank.name);
        if (btn) {
          btn.classList.add('shader');
          btn.title = bank.name || '';
          if (bank.thumbnail) setButtonThumbnail(btn, bank.thumbnail);
        }
      } else if (bank.thumbnail && btn) {
        setButtonThumbnail(btn, bank.thumbnail);
      }
    }
  }
  
  console.log('Settings restored');
}

// init() の最後で呼び出し
await restoreSettings();
```

### UI追加: 設定クリアボタン

```html
<button id="clearSettings" title="設定をクリア">🗑️ Reset</button>
```

```javascript
document.getElementById('clearSettings').addEventListener('click', () => {
  if (confirm('全ての設定をクリアしますか？')) {
    clearSettings();
    location.reload();
  }
});
```

---

# Phase 2: v0.4.0 - キーボードショートカット

## 2.1 キーマッピング

| キー | 機能 |
|------|------|
| `1-8` | Channel A バンク選択 |
| `Q W E R T Y U I` | Channel B バンク選択 |
| `A` | クロスフェーダー左端 (0%) |
| `S` | クロスフェーダー中央 (50%) |
| `F` | クロスフェーダー右端 (100%) |
| `← →` | クロスフェーダー ±5% |
| `Space` | タップテンポ |
| `↑ ↓` | BPM ±1 |
| `Shift + ↑ ↓` | BPM ±5 |
| `P` | BPM 再生/一時停止 |
| `X` | 自動切替トグル |
| `[ ]` | 切替間隔変更 |
| `O` | Output Window を開く |
| `H` | ヘルプ表示 |
| `Ctrl+D` | デバッグオーバーレイ |

※ `D` キーは `F` に変更（デバッグオーバーレイと競合回避）

## 2.2 新規ファイル: `src/keyboard.js`

```javascript
/**
 * VizMix - Keyboard Manager
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
  'KeyF': { action: 'crossfade', value: 100 },
  'ArrowLeft': { action: 'crossfadeAdjust', value: -5 },
  'ArrowRight': { action: 'crossfadeAdjust', value: 5 },
  
  'Space': { action: 'tap' },
  'ArrowUp': { action: 'bpmAdjust', value: 1 },
  'ArrowDown': { action: 'bpmAdjust', value: -1 },
  'KeyP': { action: 'bpmToggle' },
  
  'KeyX': { action: 'autoSwitchToggle' },
  'BracketLeft': { action: 'intervalDecrease' },
  'BracketRight': { action: 'intervalIncrease' },
  
  'KeyO': { action: 'openOutput' },
  'KeyH': { action: 'showHelp' },
};

const SHIFT_KEY_MAP = {
  'ArrowUp': { action: 'bpmAdjust', value: 5 },
  'ArrowDown': { action: 'bpmAdjust', value: -5 },
};

let callbacks = {};

export function initKeyboard(actionCallbacks) {
  callbacks = actionCallbacks;
  document.addEventListener('keydown', handleKeyDown);
  console.log('Keyboard shortcuts initialized');
}

function handleKeyDown(e) {
  if (e.target.matches('input, textarea, select')) return;
  
  // Ctrl+D でデバッグオーバーレイ
  if (e.ctrlKey && e.code === 'KeyD') {
    e.preventDefault();
    if (callbacks.debugToggle) callbacks.debugToggle();
    return;
  }
  
  const mapping = e.shiftKey && SHIFT_KEY_MAP[e.code] 
    ? SHIFT_KEY_MAP[e.code] 
    : KEY_MAP[e.code];
  
  if (!mapping) return;
  
  const callback = callbacks[mapping.action];
  if (callback) {
    e.preventDefault();
    callback(mapping.value);
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
F = Right (100% B)
← → = Adjust ±5%

[BPM]
Space = Tap tempo
↑ ↓ = ±1 BPM
Shift + ↑ ↓ = ±5 BPM
P = Play/Pause

[Auto Switch]
X = Toggle
[ ] = Change interval

[Other]
O = Open Output
H = This help
Ctrl+D = Debug overlay
`;
}
```

## 2.3 main.js への統合

```javascript
import { initKeyboard, getShortcutList } from './keyboard.js';

function initKeyboardShortcuts() {
  initKeyboard({
    bankA: (index) => selectBank('A', index),
    bankB: (index) => selectBank('B', index),
    
    crossfade: (value) => {
      document.getElementById('crossfader').value = value;
      document.getElementById('crossfader').dispatchEvent(new Event('input'));
    },
    
    crossfadeAdjust: (delta) => {
      const slider = document.getElementById('crossfader');
      slider.value = Math.max(0, Math.min(100, parseInt(slider.value) + delta));
      slider.dispatchEvent(new Event('input'));
    },
    
    tap: () => {
      document.getElementById('tapTempo').click();
    },
    
    bpmAdjust: (delta) => {
      setBPM(bpmState.bpm + delta);
      document.getElementById('bpmInput').value = bpmState.bpm;
    },
    
    bpmToggle: () => {
      document.getElementById('bpmPlayPause')?.click();
    },
    
    autoSwitchToggle: () => {
      const cb = document.getElementById('autoSwitchEnabled');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    },
    
    intervalDecrease: () => {
      const sel = document.getElementById('switchInterval');
      const vals = [1, 2, 4, 8, 16];
      const idx = vals.indexOf(parseInt(sel.value));
      if (idx > 0) {
        sel.value = vals[idx - 1];
        sel.dispatchEvent(new Event('change'));
      }
    },
    
    intervalIncrease: () => {
      const sel = document.getElementById('switchInterval');
      const vals = [1, 2, 4, 8, 16];
      const idx = vals.indexOf(parseInt(sel.value));
      if (idx < vals.length - 1) {
        sel.value = vals[idx + 1];
        sel.dispatchEvent(new Event('change'));
      }
    },
    
    openOutput: () => document.getElementById('openOutput').click(),
    
    showHelp: () => showKeyboardHelp(),
    
    debugToggle: () => {
      showDebugOverlay = !showDebugOverlay;
      debugOverlay.style.display = showDebugOverlay ? 'block' : 'none';
    },
  });
}

function selectBank(channel, index) {
  const container = document.getElementById(`bank${channel}`);
  container.querySelectorAll('.bank-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
  videoManager.setChannelSource(channel, index);
  setChannelSource(channel, getSourceType(channel, index), index);
  updateChannelPreview(channel);
}

function showKeyboardHelp() {
  const modal = document.createElement('div');
  modal.className = 'keyboard-help-modal';
  modal.innerHTML = `
    <div class="keyboard-help-content">
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
      <pre>${getShortcutList()}</pre>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
```

## 2.4 style.css に追加

```css
.keyboard-help-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.keyboard-help-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  position: relative;
}

.keyboard-help-content .close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 50%;
  color: var(--text-primary);
  cursor: pointer;
}

.keyboard-help-content pre {
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}
```

---

# Phase 3: v0.5.0 - MIDI対応

## 3.1 MIDIマッピング

| MIDI | 機能 |
|------|------|
| Note 0-7 | Channel A バンク |
| Note 8-15 | Channel B バンク |
| Note 16 | 自動切替トグル |
| Note 17 | タップテンポ |
| CC 1 | クロスフェーダー (0-127 → 0-100%) |
| CC 2 | BPM (0-127 → 60-200) |

## 3.2 新規ファイル: `src/midi.js`

```javascript
/**
 * VizMix - MIDI Manager
 */

let midiAccess = null;
let callbacks = {};
let isEnabled = false;

const NOTE_MAP = {
  0: { action: 'bankA', value: 0 },
  1: { action: 'bankA', value: 1 },
  2: { action: 'bankA', value: 2 },
  3: { action: 'bankA', value: 3 },
  4: { action: 'bankA', value: 4 },
  5: { action: 'bankA', value: 5 },
  6: { action: 'bankA', value: 6 },
  7: { action: 'bankA', value: 7 },
  8: { action: 'bankB', value: 0 },
  9: { action: 'bankB', value: 1 },
  10: { action: 'bankB', value: 2 },
  11: { action: 'bankB', value: 3 },
  12: { action: 'bankB', value: 4 },
  13: { action: 'bankB', value: 5 },
  14: { action: 'bankB', value: 6 },
  15: { action: 'bankB', value: 7 },
  16: { action: 'autoSwitchToggle' },
  17: { action: 'tap' },
};

const CC_MAP = {
  1: { action: 'crossfade', range: [0, 100] },
  2: { action: 'bpm', range: [60, 200] },
};

export async function initMidi(actionCallbacks) {
  callbacks = actionCallbacks;
  
  if (!navigator.requestMIDIAccess) {
    console.warn('Web MIDI API not supported');
    return false;
  }
  
  try {
    midiAccess = await navigator.requestMIDIAccess();
    midiAccess.inputs.forEach(input => {
      console.log(`MIDI connected: ${input.name}`);
      input.onmidimessage = handleMidiMessage;
    });
    
    midiAccess.onstatechange = (e) => {
      if (e.port.type === 'input' && e.port.state === 'connected') {
        e.port.onmidimessage = handleMidiMessage;
        console.log(`MIDI connected: ${e.port.name}`);
        updateMidiStatus();
      }
    };
    
    isEnabled = true;
    return true;
  } catch (err) {
    console.error('MIDI access denied:', err);
    return false;
  }
}

function handleMidiMessage(e) {
  if (!isEnabled) return;
  
  const [status, data1, data2] = e.data;
  const msgType = status & 0xF0;
  
  if (msgType === 0x90 && data2 > 0) {
    // Note On
    const mapping = NOTE_MAP[data1];
    if (mapping && callbacks[mapping.action]) {
      callbacks[mapping.action](mapping.value);
      showMidiIndicator(`Note ${data1}`);
    }
  } else if (msgType === 0xB0) {
    // Control Change
    const mapping = CC_MAP[data1];
    if (mapping && callbacks[mapping.action]) {
      const [min, max] = mapping.range;
      const value = Math.round(min + (data2 / 127) * (max - min));
      callbacks[mapping.action](value);
      showMidiIndicator(`CC${data1}: ${value}`);
    }
  }
}

function showMidiIndicator(msg) {
  let el = document.getElementById('midiIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'midiIndicator';
    el.className = 'midi-indicator';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 400);
}

export function getMidiDevices() {
  if (!midiAccess) return [];
  const devices = [];
  midiAccess.inputs.forEach(input => {
    devices.push({ name: input.name, state: input.state });
  });
  return devices;
}

function updateMidiStatus() {
  const el = document.getElementById('midiDevices');
  if (!el) return;
  const devices = getMidiDevices();
  el.innerHTML = devices.length 
    ? devices.map(d => `<span class="midi-device">${d.name}</span>`).join('')
    : '<span class="no-devices">No MIDI</span>';
}
```

## 3.3 main.js への統合

```javascript
import { initMidi, getMidiDevices } from './midi.js';

async function initMidiController() {
  const success = await initMidi({
    bankA: (index) => selectBank('A', index),
    bankB: (index) => selectBank('B', index),
    crossfade: (value) => {
      document.getElementById('crossfader').value = value;
      document.getElementById('crossfader').dispatchEvent(new Event('input'));
    },
    bpm: (value) => {
      setBPM(value);
      document.getElementById('bpmInput').value = value;
    },
    tap: () => document.getElementById('tapTempo').click(),
    autoSwitchToggle: () => {
      const cb = document.getElementById('autoSwitchEnabled');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    },
  });
  
  if (success) {
    console.log('MIDI ready');
    // デバイスリスト更新
    const devices = getMidiDevices();
    const el = document.getElementById('midiDevices');
    if (el) {
      el.innerHTML = devices.length 
        ? devices.map(d => `<span class="midi-device">${d.name}</span>`).join('')
        : '<span class="no-devices">No MIDI</span>';
    }
  }
}
```

## 3.4 index.html に追加

```html
<!-- header内 -->
<div class="midi-section">
  <span>MIDI:</span>
  <div id="midiDevices"><span class="no-devices">Checking...</span></div>
</div>
```

## 3.5 style.css に追加

```css
.midi-section {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.midi-device {
  padding: 2px 8px;
  background: var(--accent-master);
  color: white;
  border-radius: 4px;
  font-size: 11px;
}

.no-devices {
  color: var(--text-secondary);
  font-style: italic;
}

.midi-indicator {
  position: fixed;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(138, 43, 226, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  z-index: 1000;
}

.midi-indicator.visible {
  opacity: 1;
}
```

---

# バージョン更新

## version.js

```javascript
export const APP_NAME = "VizMix";
export const APP_VERSION = "0.5.0";
export const APP_FULL_NAME = `${APP_NAME} v${APP_VERSION}`;

export const VERSION_HISTORY = {
  "0.1.0": "基本機能（A/Bチャンネル、クロスフェード、バンク切替、GLSL対応）",
  "0.2.0": "BPM機能（タップテンポ、自動切替、ビートインジケーター）",
  "0.3.0": "サムネール表示、設定保存・復元",
  "0.4.0": "キーボードショートカット",
  "0.5.0": "MIDIコントローラー対応",
};

export function printVersion() {
  console.log(`%c${APP_FULL_NAME}`, 'color: #00ff88; font-size: 16px; font-weight: bold;');
}
```

---

# テスト項目

## v0.3.0 テスト
- [ ] 動画ドロップでサムネール表示
- [ ] シェーダードロップでサムネール表示
- [ ] ページリロードで設定復元
- [ ] BPM/クロスフェーダー復元
- [ ] シェーダー復元
- [ ] 設定クリアボタン動作

## v0.4.0 テスト
- [ ] 1-8キーでChannel Aバンク切替
- [ ] Q-IキーでChannel Bバンク切替
- [ ] A/S/Fでクロスフェーダー
- [ ] ←→でクロスフェーダー微調整
- [ ] Spaceでタップテンポ
- [ ] ↑↓でBPM調整
- [ ] Hでヘルプ表示
- [ ] Ctrl+Dでデバッグ

## v0.5.0 テスト
- [ ] MIDIデバイス接続検出
- [ ] ノートでバンク切替
- [ ] CCでクロスフェーダー/BPM
- [ ] インジケーター表示

---

# 実行順序

1. Phase 1 (v0.3.0) を実装
2. テスト
3. Phase 2 (v0.4.0) を実装
4. テスト
5. Phase 3 (v0.5.0) を実装
6. 全体テスト
7. version.js を 0.5.0 に更新
8. 完了報告

---

# 注意事項

- 各Phaseで動作確認してから次へ
- 既存機能を壊さないよう注意
- Blob URLは永続化不可（動画は再ドロップ必要）
- MIDI は Chrome 推奨（HTTPS/localhost必須）
- デバッグオーバーレイは Ctrl+D に変更

---

# 完了後

全テスト完了したらNaoに報告。
