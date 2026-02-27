/**
 * VizMix v0.7.0 - Control Screen
 * Plane-based video display with opacity crossfade
 * Each channel has independent 8 banks
 * BPM sync with auto-switch
 * Thumbnails and settings persistence
 * Keyboard shortcuts
 * MIDI controller support
 * Effects (Invert, Grayscale, Sepia, Blur, Brightness, Contrast)
 */

import * as pc from "playcanvas";
import {
  state,
  initBroadcast,
  setCrossfade,
  setChannelSource,
  setOutputWindow,
  broadcastState,
  broadcastBankSwitch,
  broadcastReset,
  broadcastVideoFile,
  broadcastShaderFile,
  broadcastAllShaders,
  transferAllCustomVideos,
  broadcastBpmState,
  broadcastBeat,
  broadcastAutoSwitch,
  broadcastEffectsState,
} from "./mixer.js";
import {
  effectsState,
  toggleInvert,
  toggleGrayscale,
  toggleSepia,
  setGrayscaleAmount,
  setSepiaAmount,
  setBlurAmount,
  setBrightnessAmount,
  setContrastAmount,
  setGlitchAmount,
  setRgbShiftAmount,
  setRgbMultiplyAmount,
  setRgbMultiplyColor,
  resetEffect,
  getEffectParams,
} from "./effects.js";
import { videoManager, setVideoSource, setShaderSource, setShaderDefaults, setShaderRawSource, getShaderRawSource, getSourceType, getShaderVersion } from "./videoManager.js";
import { ShaderPreviewRenderer } from "./shaderPreview.js";
import {
  bpmState,
  setBPM,
  tap,
  togglePlay,
  setAutoSwitch,
  setSwitchInterval,
  startBeatLoop,
} from "./bpm.js";
import { generateVideoThumbnail, generateISFThumbnail, setButtonThumbnail } from "./thumbnail.js";
import {
  loadSettings,
  loadAllShaders,
  updateBankSettings,
  updateBpmSettings,
  updateCrossfade,
  saveShaderCode,
  clearSettings,
} from "./storage.js";
import { initKeyboard, getShortcutList } from "./keyboard.js";
import { initMidi, getMidiDevices, toggleLearnMode, clearAllLearnMappings, registerLearnableTarget } from "./midi.js";
import { initEffectsUI as initEffectsPanelUI, syncEffectsUI, handleEffectShortcut, hideEffectParams } from './effectsUI.js';
import { initMediaBrowsers } from './mediaBrowser.js';
import { initWebcam, getWebcamManager, WebcamManager } from './webcam.js';

const BANK_SIZE = 8;

// ── captureStream フレームレート ──────────────────────────────────────────────
const CAPTURE_FPS = 30;

// ── 出力解像度（UIセレクトから動的に取得） ────────────────────────────────────
const OUTPUT_RESOLUTIONS = {
  '960x540':   [960,  540],
  '1280x720':  [1280, 720],
  '1920x1080': [1920, 1080],
};
const OUTPUT_RESOLUTION_KEY = 'vizmix-output-resolution';

let currentOutputWidth  = 1280;
let currentOutputHeight = 720;

function applyOutputResolution(key) {
  const entry = OUTPUT_RESOLUTIONS[key];
  if (!entry) return;
  [currentOutputWidth, currentOutputHeight] = entry;
  if (app) {
    app.resizeCanvas(currentOutputWidth, currentOutputHeight);
    // resizeCanvas後もCSSを明示的に再適用（アスペクト比崩れ防止）
    const canvas = app.graphicsDevice.canvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    console.log(`Output resolution: ${currentOutputWidth}x${currentOutputHeight}`);
  }
  localStorage.setItem(OUTPUT_RESOLUTION_KEY, key);
}
// ── 映像解像度チェック（4Kブロック用） ──────────────────────────────────────
function getVideoResolution(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => resolve(null);
    v.src = url;
  });
}
// ─────────────────────────────────────────────────────────────────────────────

let webcamManager = null;
const channelSourceMode = { A: 'media', B: 'media' }; // 'media' or 'cam'
let outputWindow = null;
let app = null;
let planeA = null;
let planeB = null;
let materialA = null;
let materialB = null;
let camera = null;
let textureUpdateLogged = false;
let currentCrossfadeValue = 0;
let dimmerA = 1.0;
let dimmerB = 1.0;

// BPM Flash state
let flashEnabled = false;
let flashDivisor = 4; // 1/4 beat pattern
let flashOpacity = 0;
let flashOverlay = null;

// Auto-switch state
let autoSwitchToB = true; // true: switch to B, false: switch to A

// デバッグオーバーレイ
let debugOverlay = null;
let showDebugOverlay = false;

function createDebugOverlay() {
  debugOverlay = document.createElement('div');
  debugOverlay.id = 'debugOverlay';
  debugOverlay.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0,0,0,0.8);
    color: #0f0;
    font-family: monospace;
    font-size: 12px;
    padding: 10px;
    border-radius: 5px;
    z-index: 1000;
    display: none;
    max-width: 400px;
  `;
  document.body.appendChild(debugOverlay);
  // Debug overlay toggle is now handled by keyboard.js (Ctrl+D)
}

function updateDebugOverlay() {
  if (!debugOverlay || !videoManager) return;
  
  const chA = videoManager.channelA;
  const chB = videoManager.channelB;
  
  const infoA = chA.currentSourceType === 'shader'
    ? `SHADER Bank${chA.currentIndex + 1} "${chA.shaderSource?.name}" (${chA.shaderSource?.shaderCode?.length || 0}ch)`
    : `VIDEO Bank${chA.currentIndex + 1}`;
    
  const infoB = chB.currentSourceType === 'shader'
    ? `SHADER Bank${chB.currentIndex + 1} "${chB.shaderSource?.name}" (${chB.shaderSource?.shaderCode?.length || 0}ch)`
    : `VIDEO Bank${chB.currentIndex + 1}`;
  
  debugOverlay.innerHTML = `
    <div style="color:#f88">Ch A: ${infoA}</div>
    <div style="color:#8f8">Ch B: ${infoB}</div>
    <div>Crossfade: ${currentCrossfadeValue.toFixed(2)}</div>
    <div style="font-size:10px;color:#888;margin-top:5px">Ctrl+Shift+D to hide | H for help</div>
  `;
}

async function init() {
  console.log("VizMix v0.8.0 Control initializing...");
  initBroadcast(handleMessage);
  initUI();
  await initPlayCanvas();

  // mixer state を VideoManager の実際の状態と同期（初期値ハードコードに依存しない）
  state.channelA.source = videoManager.channelA.currentSourceType;
  state.channelA.videoIndex = videoManager.channelA.currentIndex;
  state.channelB.source = videoManager.channelB.currentSourceType;
  state.channelB.videoIndex = videoManager.channelB.currentIndex;
  console.log(`Mixer state synced: A=index ${state.channelA.videoIndex}, B=index ${state.channelB.videoIndex}`);

  initChannelControllers();
  createDebugOverlay();
  initKeyboardShortcuts();
  await initMidiController();
  // Effects Panel UI 初期化 (Resolume-style)
  initEffectsPanelUI(effectsState, (effectKey, property, value) => {
    // エフェクト変更コールバック
    if (property === 'enabled') {
      effectsState[effectKey].enabled = value;
    } else {
      effectsState[effectKey][property] = value;
    }

    // Output Windowに同期
    broadcastEffectsState();

    console.log(`Effect ${effectKey}.${property} = ${value}`);
  });

  await restoreSettings();
  // デフォルト映像のサムネールを非同期で生成（UIブロックを避ける）
  setTimeout(() => generateDefaultThumbnails(), 500);

  // Media Browser 初期化
  const mediaBrowsers = initMediaBrowsers();
  // ダブルクリックでアクティブBankにアサイン
  const handleMediaDoubleClick = (mediaInfo) => {
    const channel = mediaInfo.channel;
    // アクティブなBankボタンのインデックスを取得
    const container = document.getElementById(`bank${channel}`);
    if (!container) return;
    const activeBtn = container.querySelector('.bank-btn.active');
    if (!activeBtn) return;
    const index = parseInt(activeBtn.dataset.index, 10);
    // ドロップと同じ処理をシミュレート
    const fakeDropData = {
      name: mediaInfo.name,
      type: mediaInfo.type,
      mediaType: mediaInfo.mediaType,
      blobUrl: mediaInfo.blobUrl,
    };
    assignMediaToBank(channel, index, fakeDropData);
  };
  if (mediaBrowsers.A) mediaBrowsers.A.onDoubleClickAssign = handleMediaDoubleClick;
  if (mediaBrowsers.B) mediaBrowsers.B.onDoubleClickAssign = handleMediaDoubleClick;
  console.log("Media Browsers initialized");

  // Webcam 初期化
  await initWebcamUI();

  // Output Windowからの ready通知を受けてcaptureStreamを接続
  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'output-ready') return;

    // outputWindowの参照を更新（リロード後も対応）
    outputWindow = e.source;
    setOutputWindow(outputWindow);

    // PlayCanvasキャンバスからMediaStreamを取得してOutputの<video>に接続
    const stream = app.graphicsDevice.canvas.captureStream(CAPTURE_FPS);
    const outputVideo = outputWindow.document.querySelector('#output');
    if (outputVideo) {
      outputVideo.srcObject = stream;
      outputVideo.play().catch(err => console.warn('Output video.play() failed:', err));
      // 接続完了をOutputに通知 → Outputのリトライループが停止する
      outputWindow.postMessage({ type: 'stream-connected' }, '*');
      console.log(`captureStream: connected (${currentOutputWidth}x${currentOutputHeight} @${CAPTURE_FPS}fps)`);
    } else {
      console.error('captureStream: #output video element not found');
    }

    // エフェクト初期状態を同期
    broadcastEffectsState();
  });

  console.log("VizMix v0.8.0 Control ready");
}

async function handleMessage(data) {
  if (data.type === "request-state") {
    console.log("Received request-state from Output Window");
    broadcastAllShaders();
    await transferAllCustomVideos();
    broadcastState();
  }
}

function initUI() {
  // ── 出力解像度セレクト ────────────────────────────────────────────────────
  const resolutionSelect = document.getElementById('outputResolution');
  if (resolutionSelect) {
    // localStorageから復元（なければデフォルト720p）
    const saved = localStorage.getItem(OUTPUT_RESOLUTION_KEY) || '1280x720';
    resolutionSelect.value = saved;
    // 変数にも反映（initPlayCanvasより先に呼ばれるため）
    const entry = OUTPUT_RESOLUTIONS[saved];
    if (entry) [currentOutputWidth, currentOutputHeight] = entry;

    resolutionSelect.addEventListener('change', (e) => {
      applyOutputResolution(e.target.value);
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  document.getElementById("openOutput").addEventListener("click", () => {
    if (outputWindow && !outputWindow.closed) {
      outputWindow.focus();
    } else {
      outputWindow = window.open(
        "./output.html",
        "VizMix-Output",
        "width=1280,height=720"
      );
    }
    // postMessage + Transferable用にOutput Window参照を登録
    setOutputWindow(outputWindow);
  });

  // Clear settings button
  document.getElementById("clearSettings").addEventListener("click", () => {
    if (confirm("全ての設定をクリアしますか？\nAll settings will be reset.")) {
      broadcastReset();
      clearSettings();
      // BroadcastChannelメッセージ送信完了を待ってからリロード
      setTimeout(() => location.reload(), 200);
    }
  });

  const fpsDisplay = document.createElement('div');
  fpsDisplay.id = 'fpsDisplay';
  fpsDisplay.textContent = '-- FPS';
  document.body.appendChild(fpsDisplay);

  const showFpsCheckbox = document.getElementById('showFps');
  if (showFpsCheckbox) {
    showFpsCheckbox.addEventListener('change', (e) => {
      fpsDisplay.classList.toggle('visible', e.target.checked);
    });
  }

  const crossfader = document.getElementById("crossfader");
  crossfader.addEventListener("input", (e) => {
    const value = parseInt(e.target.value) / 100;
    setCrossfade(value);
    updatePreviewBorders(value);
    currentCrossfadeValue = value;
    updateCrossfade(parseInt(e.target.value));
  });

  // Dimmer faders
  const dimmerASlider = document.getElementById('dimmerA');
  const dimmerBSlider = document.getElementById('dimmerB');
  const dimmerAValue = document.getElementById('dimmerAValue');
  const dimmerBValue = document.getElementById('dimmerBValue');
  if (dimmerASlider) {
    dimmerASlider.addEventListener('input', (e) => {
      dimmerA = parseInt(e.target.value) / 100;
      if (dimmerAValue) dimmerAValue.textContent = e.target.value;
    });
  }
  if (dimmerBSlider) {
    dimmerBSlider.addEventListener('input', (e) => {
      dimmerB = parseInt(e.target.value) / 100;
      if (dimmerBValue) dimmerBValue.textContent = e.target.value;
    });
  }

  // Playback controls
  initPlaybackControls();

  createBankButtons("bankA", "A");
  createBankButtons("bankB", "B");

  initBPMControls();

  document.addEventListener(
    "click",
    () => {
      videoManager.playAll();
    },
    { once: true }
  );
}

function initChannelControllers() {
  document.querySelectorAll('.channel-controller').forEach(controller => {
    const channel = controller.dataset.channel;
    const videoChannel = channel === 'A' ? videoManager.channelA : videoManager.channelB;

    controller.querySelectorAll('.ctrl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        controller.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        videoChannel.setPlaybackState(action);
        console.log(`[${channel}] Playback: ${action}`);
      });
    });

    const slider = controller.querySelector('.speed-slider');
    const valueDisplay = controller.querySelector('.speed-value');

    slider.addEventListener('input', (e) => {
      const rate = parseInt(e.target.value) / 100;
      videoChannel.setPlaybackRate(rate);
      valueDisplay.textContent = `${e.target.value}%`;
    });
  });

  console.log('Channel controllers initialized');
}

// ── Playback Controls ──────────────────────────────────────────────────────
const seekDragging = { A: false, B: false };

function initPlaybackControls() {
  ['A', 'B'].forEach(ch => {
    const btn = document.querySelector(`.play-pause-toggle[data-channel="${ch}"]`);
    const seekBar = document.getElementById(`seekBar${ch}`);

    if (btn) {
      btn.addEventListener('click', () => {
        const vc = ch === 'A' ? videoManager.channelA : videoManager.channelB;
        if (vc.currentSourceType === 'shader') return;
        const video = vc.video;
        if (!video) return;
        if (video.paused) {
          vc.playbackState = 'play';
          video.play().catch(() => {});
          btn.textContent = '||';
          btn.classList.remove('paused');
        } else {
          vc.playbackState = 'pause';
          video.pause();
          btn.textContent = '\u25B6';
          btn.classList.add('paused');
        }
      });
    }

    if (seekBar) {
      seekBar.addEventListener('mousedown', () => { seekDragging[ch] = true; });
      seekBar.addEventListener('touchstart', () => { seekDragging[ch] = true; });
      seekBar.addEventListener('input', () => {
        const vc = ch === 'A' ? videoManager.channelA : videoManager.channelB;
        if (vc.currentSourceType === 'shader') return;
        const video = vc.video;
        if (!video || !video.duration) return;
        video.currentTime = (parseFloat(seekBar.value) / 100) * video.duration;
      });
      seekBar.addEventListener('mouseup', () => { seekDragging[ch] = false; });
      seekBar.addEventListener('touchend', () => { seekDragging[ch] = false; });
    }
  });
}

function updatePlaybackUI() {
  ['A', 'B'].forEach(ch => {
    const vc = ch === 'A' ? videoManager.channelA : videoManager.channelB;
    const container = document.getElementById(`playback${ch}`);
    if (!container) return;

    // ISFシェーダーの場合はシークバー非表示
    if (vc.currentSourceType === 'shader') {
      container.style.visibility = 'hidden';
      return;
    }
    container.style.visibility = 'visible';

    const video = vc.video;
    if (!video || !video.duration || isNaN(video.duration)) return;

    if (!seekDragging[ch]) {
      const seekBar = document.getElementById(`seekBar${ch}`);
      if (seekBar) {
        seekBar.value = (video.currentTime / video.duration) * 100;
      }
    }

    const timeEl = document.getElementById(`seekTime${ch}`);
    if (timeEl) {
      const t = Math.floor(video.currentTime);
      const m = Math.floor(t / 60);
      const s = t % 60;
      timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }
  });
}

function initBPMControls() {
  const bpmInput = document.getElementById("bpmInput");
  const tapBtn = document.getElementById("tapBtn");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const playPauseIcon = document.getElementById("playPauseIcon");
  const autoSwitchCheckbox = document.getElementById("autoSwitch");
  const switchIntervalSelect = document.getElementById("switchInterval");

  // BPM input
  if (bpmInput) {
    bpmInput.addEventListener("change", (e) => {
      const newBpm = setBPM(parseInt(e.target.value) || 120);
      e.target.value = newBpm;
      broadcastBpmState();
      updateBpmSettings(newBpm);
    });

    bpmInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });
  }

  // Tap button
  if (tapBtn) {
    tapBtn.addEventListener("click", () => {
      const newBpm = tap();
      if (bpmInput) bpmInput.value = newBpm;
      broadcastBpmState();
    });

    // Keyboard shortcut: Space for tap
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !e.target.matches("input, textarea")) {
        e.preventDefault();
        const newBpm = tap();
        if (bpmInput) bpmInput.value = newBpm;
        broadcastBpmState();
        tapBtn.classList.add("active");
        setTimeout(() => tapBtn.classList.remove("active"), 100);
      }
    });
  }

  // Play/Pause button
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      const isPlaying = togglePlay();
      playPauseBtn.classList.toggle("playing", isPlaying);
      if (playPauseIcon) {
        playPauseIcon.textContent = isPlaying ? "||" : "▶";
      }
      broadcastBpmState();
    });
  }

  // Auto switch checkbox
  if (autoSwitchCheckbox) {
    autoSwitchCheckbox.addEventListener("change", (e) => {
      setAutoSwitch(e.target.checked);
      broadcastBpmState();
      updateBpmSettings(bpmState.bpm, {
        enabled: e.target.checked,
        interval: parseInt(switchIntervalSelect?.value || 4)
      });
    });
  }

  // Switch interval select
  if (switchIntervalSelect) {
    switchIntervalSelect.addEventListener("change", (e) => {
      setSwitchInterval(parseInt(e.target.value));
      broadcastBpmState();
      updateBpmSettings(bpmState.bpm, {
        enabled: autoSwitchCheckbox?.checked || false,
        interval: parseInt(e.target.value)
      });
    });
  }

  // BPM Flash controls
  const flashToggle = document.getElementById('flashToggle');
  const flashPattern = document.getElementById('flashPattern');
  if (flashToggle) {
    flashToggle.addEventListener('click', () => {
      flashEnabled = !flashEnabled;
      flashToggle.classList.toggle('active', flashEnabled);
      if (!flashEnabled) flashOpacity = 0;
    });
  }
  if (flashPattern) {
    flashPattern.addEventListener('change', (e) => {
      flashDivisor = parseInt(e.target.value);
    });
  }

  // Start beat loop
  startBeatLoop(onBeat, onAutoSwitch);
  console.log("BPM controls initialized");
}

let totalBeatCount = 0;

function onBeat(beatCount) {
  // Update beat indicators
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`beat${i}`);
    if (dot) {
      dot.classList.toggle("active", i === beatCount);
    }
  }

  // BPM Flash
  totalBeatCount++;
  if (flashEnabled && totalBeatCount % flashDivisor === 0) {
    flashOpacity = 1.0;
  }

  // Broadcast beat to output window
  broadcastBeat(beatCount);
}

function onAutoSwitch() {
  // Toggle crossfade
  const crossfader = document.getElementById("crossfader");

  if (autoSwitchToB) {
    // Switch to B
    currentCrossfadeValue = 1.0;
    if (crossfader) crossfader.value = 100;
    setCrossfade(1.0);
  } else {
    // Switch to A
    currentCrossfadeValue = 0.0;
    if (crossfader) crossfader.value = 0;
    setCrossfade(0.0);
  }

  updatePreviewBorders(currentCrossfadeValue);
  autoSwitchToB = !autoSwitchToB;
  broadcastAutoSwitch();
  console.log(`Auto-switched to ${autoSwitchToB ? 'A' : 'B'}`);
}

async function restoreSettings() {
  const settings = loadSettings();
  const shaders = loadAllShaders();

  console.log("Restoring settings:", settings);

  // Restore BPM
  setBPM(settings.bpm);
  const bpmInput = document.getElementById("bpmInput");
  if (bpmInput) bpmInput.value = settings.bpm;

  // Restore crossfader
  const crossfader = document.getElementById("crossfader");
  if (crossfader) {
    crossfader.value = settings.crossfade;
    const value = settings.crossfade / 100;
    setCrossfade(value);
    updatePreviewBorders(value);
    currentCrossfadeValue = value;
  }

  // Restore auto switch
  const autoSwitchCheckbox = document.getElementById("autoSwitch");
  const switchIntervalSelect = document.getElementById("switchInterval");
  if (autoSwitchCheckbox) {
    autoSwitchCheckbox.checked = settings.autoSwitch.enabled;
    setAutoSwitch(settings.autoSwitch.enabled);
  }
  if (switchIntervalSelect) {
    switchIntervalSelect.value = settings.autoSwitch.interval;
    setSwitchInterval(settings.autoSwitch.interval);
  }

  // Restore banks
  for (const channel of ['A', 'B']) {
    for (let i = 0; i < 8; i++) {
      const bank = settings.banks[channel][i];
      const shaderCode = shaders[channel][i];
      const btn = document.querySelector(`#bank${channel} .bank-btn[data-index="${i}"]`);

      if (!btn) continue;

      if (bank && bank.type === 'shader' && shaderCode) {
        // Restore shader
        setShaderSource(channel, i, shaderCode, bank.name);
        btn.classList.add('shader');
        btn.title = bank.name || '';
        if (bank.name) btn.setAttribute('data-name', bank.name);
        console.log(`Restored shader [${channel}] bank ${i + 1}: ${bank.name}`);
      }

      if (bank && bank.thumbnail) {
        setButtonThumbnail(btn, bank.thumbnail);
      }
    }
  }

  console.log("Settings restored");
}

// デフォルト映像のサムネールを生成
async function generateDefaultThumbnails() {
  console.log("Generating thumbnails for default videos...");
  const settings = loadSettings();
  
  for (const channel of ['A', 'B']) {
    const container = document.getElementById(`bank${channel}`);
    if (!container) continue;
    
    for (let i = 0; i < 8; i++) {
      const btn = container.querySelector(`.bank-btn[data-index="${i}"]`);
      if (!btn) continue;
      
      // 既にサムネールがある場合はスキップ
      if (btn.classList.contains('has-thumbnail')) continue;
      
      // シェーダーの場合はスキップ
      if (btn.classList.contains('shader')) continue;
      
      // カスタム映像の場合はスキップ（保存されたサムネールがあるはず）
      const savedBank = settings.banks[channel][i];
      if (savedBank && savedBank.thumbnail) {
        setButtonThumbnail(btn, savedBank.thumbnail);
        continue;
      }
      
      // デフォルト映像のサムネールを生成
      const videoUrl = `./samples/P01-${String((channel === 'A' ? i : i + 8) + 1).padStart(3, '0')}_`;
      try {
        // videoManager から実際のURLを取得
        const actualUrl = channel === 'A' 
          ? videoManager.channelA.video?.src 
          : videoManager.channelB.video?.src;
        
        // デフォルト映像のURLを構築
        const defaultUrls = channel === 'A' 
          ? [
              './samples/P01-001_Circle_color-1.0-0.1-0.1.mp4',
              './samples/P01-002_Circle_color-0.1-0.3-1.0.mp4',
              './samples/P01-003_Polygon_color-1.0-0.8-0.0.mp4',
              './samples/P01-004_Polygon_color-0.3-1.0-0.3.mp4',
              './samples/P01-005_Triangle_color-0.8-0.0-1.0.mp4',
              './samples/P01-006_Triangle_color-0.0-1.0-1.0.mp4',
              './samples/P01-007_Circle_color-0.5-0.0-0.5.mp4',
              './samples/P01-008_Polygon_color-1.0-1.0-1.0.mp4',
            ]
          : [
              './samples/P01-009_Circle_color-0.7-0.7-0.7.mp4',
              './samples/P01-010_Triangle_color-0.9-0.9-0.0.mp4',
              './samples/P01-011_12_kinetic_lines_color-1.0-1.0-1.0.mp4',
              './samples/P01-012_13_kinetic_curves_color-0.0-1.0-1.0.mp4',
              './samples/P01-013_12_kinetic_lines_color-0.0-1.0-0.0.mp4',
              './samples/P01-014_13_kinetic_curves_color-1.0-0.5-0.0.mp4',
              './samples/P01-015_12_kinetic_lines_color-1.0-0.0-0.5.mp4',
              './samples/P01-016_Polygon_color-0.5-0.5-1.0.mp4',
            ];
        
        const url = defaultUrls[i];
        const thumbnail = await generateVideoThumbnail(url);
        setButtonThumbnail(btn, thumbnail);
        console.log(`Generated thumbnail for [${channel}] bank ${i + 1}`);
      } catch (e) {
        console.warn(`Failed to generate thumbnail for [${channel}] bank ${i + 1}:`, e);
      }
    }
  }
  
  console.log("Default thumbnails generation complete");
}

function initKeyboardShortcuts() {
  initKeyboard({
    bankA: (index) => selectBank('A', index),
    bankB: (index) => selectBank('B', index),

    crossfade: (value) => {
      const slider = document.getElementById('crossfader');
      if (slider) {
        slider.value = value;
        slider.dispatchEvent(new Event('input'));
      }
    },

    crossfadeAdjust: (delta) => {
      const slider = document.getElementById('crossfader');
      if (slider) {
        slider.value = Math.max(0, Math.min(100, parseInt(slider.value) + delta));
        slider.dispatchEvent(new Event('input'));
      }
    },

    tap: () => {
      const tapBtn = document.getElementById('tapBtn');
      if (tapBtn) tapBtn.click();
    },

    bpmAdjust: (delta) => {
      const newBpm = setBPM(bpmState.bpm + delta);
      const bpmInput = document.getElementById('bpmInput');
      if (bpmInput) bpmInput.value = newBpm;
      broadcastBpmState();
      updateBpmSettings(newBpm);
    },

    bpmToggle: () => {
      const btn = document.getElementById('playPauseBtn');
      if (btn) btn.click();
    },

    autoSwitchToggle: () => {
      const cb = document.getElementById('autoSwitch');
      if (cb) {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      }
    },

    intervalDecrease: () => {
      const sel = document.getElementById('switchInterval');
      if (!sel) return;
      const vals = [1, 2, 4, 8, 16];
      const idx = vals.indexOf(parseInt(sel.value));
      if (idx > 0) {
        sel.value = vals[idx - 1];
        sel.dispatchEvent(new Event('change'));
      }
    },

    intervalIncrease: () => {
      const sel = document.getElementById('switchInterval');
      if (!sel) return;
      const vals = [1, 2, 4, 8, 16];
      const idx = vals.indexOf(parseInt(sel.value));
      if (idx < vals.length - 1) {
        sel.value = vals[idx + 1];
        sel.dispatchEvent(new Event('change'));
      }
    },

    openOutput: () => {
      const btn = document.getElementById('openOutput');
      if (btn) btn.click();
    },

    showHelp: () => showKeyboardHelp(),

    debugToggle: () => {
      showDebugOverlay = !showDebugOverlay;
      if (debugOverlay) {
        debugOverlay.style.display = showDebugOverlay ? 'block' : 'none';
      }
    },

    fxInvert: () => handleEffectShortcut('F1'),
    fxGrayscale: () => handleEffectShortcut('F2'),
    fxSepia: () => handleEffectShortcut('F3'),
    fxBlurReset: () => handleEffectShortcut('F4'),
    fxBrightnessReset: () => handleEffectShortcut('F5'),
    fxContrastReset: () => handleEffectShortcut('F6'),
  });
}

// Glitchエフェクト用オーバーレイcanvas
let glitchOverlay = null;
let glitchCtx = null;

function ensureGlitchOverlay() {
  const masterCanvas = document.getElementById('canvasMaster');
  if (!masterCanvas) return null;
  if (!glitchOverlay) {
    glitchOverlay = document.createElement('canvas');
    glitchOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    masterCanvas.parentElement.appendChild(glitchOverlay);
    glitchCtx = glitchOverlay.getContext('2d', { willReadFrequently: true });
  }
  // サイズ同期
  if (glitchOverlay.width !== masterCanvas.width || glitchOverlay.height !== masterCanvas.height) {
    glitchOverlay.width = masterCanvas.width;
    glitchOverlay.height = masterCanvas.height;
  }
  return glitchCtx;
}

// Master Outputにエフェクトを適用
function applyEffectsToCanvas() {
  const canvas = document.getElementById('canvasMaster');
  if (!canvas) return;

  const params = getEffectParams();

  let filters = [];

  if (params.invert > 0.5) filters.push('invert(1)');
  if (params.grayscale > 0) filters.push(`grayscale(${params.grayscale})`);
  if (params.sepia > 0) filters.push(`sepia(${params.sepia})`);
  if (params.blur > 0) filters.push(`blur(${params.blur * 10}px)`);
  if (params.brightness !== 0) filters.push(`brightness(${1 + params.brightness})`);
  if (params.contrast !== 0) filters.push(`contrast(${1 + params.contrast})`);

  canvas.style.filter = filters.length > 0 ? filters.join(' ') : 'none';

  // Glitch系エフェクト（Canvas 2Dオーバーレイ）
  const needsGlitch = params.glitch > 0 || params.rgbShift > 0 || params.rgbMultiply > 0;
  if (needsGlitch) {
    const ctx = ensureGlitchOverlay();
    if (!ctx) return;
    const w = glitchOverlay.width;
    const h = glitchOverlay.height;
    ctx.clearRect(0, 0, w, h);

    // RGB Shift: draw the source with offset channels
    if (params.rgbShift > 0) {
      const shift = Math.round(params.rgbShift * w * 0.02);
      ctx.globalCompositeOperation = 'source-over';
      // Red channel (shifted right)
      ctx.drawImage(canvas, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const srcData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const s = srcData.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          // Red from shifted position
          const rx = Math.min(w - 1, Math.max(0, x + shift));
          const rIdx = (y * w + rx) * 4;
          d[idx] = s[rIdx]; // R
          // Green stays
          d[idx + 1] = s[idx + 1]; // G
          // Blue from opposite shift
          const bx = Math.min(w - 1, Math.max(0, x - shift));
          const bIdx = (y * w + bx) * 4;
          d[idx + 2] = s[bIdx + 2]; // B
          d[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Glitch: horizontal slice displacement
    if (params.glitch > 0) {
      if (params.rgbShift <= 0) {
        ctx.drawImage(canvas, 0, 0, w, h);
      }
      const imgData = ctx.getImageData(0, 0, w, h);
      const clone = new Uint8ClampedArray(imgData.data);
      const sliceCount = Math.floor(params.glitch * 20) + 1;
      const t = performance.now() * 0.001;
      for (let s = 0; s < sliceCount; s++) {
        const sliceY = Math.floor(Math.abs(Math.sin(t * 3.7 + s * 1.3)) * h);
        const sliceH = Math.floor(Math.abs(Math.sin(t * 5.1 + s * 2.1)) * 20) + 2;
        const offset = Math.floor((Math.sin(t * 10.0 + s * 7.3) * params.glitch * w * 0.1));
        for (let y = sliceY; y < Math.min(h, sliceY + sliceH); y++) {
          for (let x = 0; x < w; x++) {
            const srcX = Math.min(w - 1, Math.max(0, x - offset));
            const dstIdx = (y * w + x) * 4;
            const srcIdx = (y * w + srcX) * 4;
            imgData.data[dstIdx] = clone[srcIdx];
            imgData.data[dstIdx + 1] = clone[srcIdx + 1];
            imgData.data[dstIdx + 2] = clone[srcIdx + 2];
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // RGB Multiply: tint overlay
    if (params.rgbMultiply > 0) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = params.rgbMultiply;
      ctx.fillStyle = params.rgbMultiplyColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    }

    glitchOverlay.style.display = 'block';
  } else if (glitchOverlay) {
    glitchOverlay.style.display = 'none';
  }
}

function selectBank(channel, index) {
  const container = document.getElementById(`bank${channel}`);
  if (!container) return;

  container.querySelectorAll('.bank-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  const sourceType = getSourceType(channel, index);
  const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;

  // シェーダーのバージョンチェック（変更があれば強制リロード）
  if (sourceType === 'shader') {
    const currentVersion = videoChannel.currentShaderVersion;
    const bankVersion = getShaderVersion(channel, index);
    if (currentVersion !== bankVersion || videoChannel.currentIndex !== index) {
      videoChannel.currentShaderVersion = -1;
    }
  }

  videoManager.setChannelSource(channel, index);
  setChannelSource(channel, sourceType, index);
  // Send explicit bank-switch message for reliable Output sync
  broadcastBankSwitch(channel, sourceType, index);
  updateChannelPreview(channel);
}

function showKeyboardHelp() {
  // Remove existing modal if any
  const existing = document.querySelector('.keyboard-help-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'keyboard-help-modal';
  modal.innerHTML = `
    <div class="keyboard-help-content">
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">x</button>
      <pre>${getShortcutList()}</pre>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function initMidiController() {
  const success = await initMidi({
    bankA: (index) => selectBank('A', index),
    bankB: (index) => selectBank('B', index),
    crossfade: (value) => {
      const slider = document.getElementById('crossfader');
      if (slider) {
        slider.value = value;
        slider.dispatchEvent(new Event('input'));
      }
    },
    dimmerA: (value) => {
      dimmerA = value / 100;
      const slider = document.getElementById('dimmerA');
      const valEl = document.getElementById('dimmerAValue');
      if (slider) slider.value = value;
      if (valEl) valEl.textContent = value;
    },
    dimmerB: (value) => {
      dimmerB = value / 100;
      const slider = document.getElementById('dimmerB');
      const valEl = document.getElementById('dimmerBValue');
      if (slider) slider.value = value;
      if (valEl) valEl.textContent = value;
    },
    bpm: (value) => {
      const newBpm = setBPM(value);
      const bpmInput = document.getElementById('bpmInput');
      if (bpmInput) bpmInput.value = newBpm;
      broadcastBpmState();
      updateBpmSettings(newBpm);
    },
    tap: () => {
      const tapBtn = document.getElementById('tapBtn');
      if (tapBtn) tapBtn.click();
    },
    autoSwitchToggle: () => {
      const cb = document.getElementById('autoSwitch');
      if (cb) {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      }
    },
    flashToggle: () => {
      flashEnabled = !flashEnabled;
      const btn = document.getElementById('flashToggle');
      if (btn) btn.classList.toggle('active', flashEnabled);
      if (!flashEnabled) flashOpacity = 0;
    },

    fxInvert: () => {
      toggleInvert();
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
    fxGrayscale: () => {
      toggleGrayscale();
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
    fxSepia: () => {
      toggleSepia();
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
    fxBlur: (value) => {
      setBlurAmount(value);
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
    fxBrightness: (value) => {
      setBrightnessAmount(value);
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
    fxContrast: (value) => {
      setContrastAmount(value);
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
    fxGlitch: (value) => {
      setGlitchAmount(value);
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
    fxRgbShift: (value) => {
      setRgbShiftAmount(value);
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
    fxRgbMultiply: (value) => {
      setRgbMultiplyAmount(value);
      broadcastEffectsState();
      syncEffectsUI(effectsState);
    },
  });

  if (success) {
    console.log('MIDI controller ready');
    // Update device list
    const devices = getMidiDevices();
    const el = document.getElementById('midiDevices');
    if (el) {
      el.innerHTML = devices.length
        ? devices.map(d => `<span class="midi-device">${d.name}</span>`).join('')
        : '<span class="no-devices">No MIDI</span>';
    }
  } else {
    console.log('MIDI not available');
    const el = document.getElementById('midiDevices');
    if (el) el.innerHTML = '<span class="no-devices">Not supported</span>';
  }

  // Register learnable targets
  registerLearnableTarget('crossfade', document.getElementById('crossfader'), 'slider', [0, 100]);
  registerLearnableTarget('dimmerA', document.getElementById('dimmerA'), 'slider', [0, 100]);
  registerLearnableTarget('dimmerB', document.getElementById('dimmerB'), 'slider', [0, 100]);
  registerLearnableTarget('fxBlur', document.querySelector('[data-effect="blur"]'), 'slider', [0, 100]);
  registerLearnableTarget('fxBrightness', document.querySelector('[data-effect="brightness"]'), 'slider', [-100, 100]);
  registerLearnableTarget('fxContrast', document.querySelector('[data-effect="contrast"]'), 'slider', [-100, 100]);
  registerLearnableTarget('fxGlitch', document.querySelector('[data-effect="glitch"]'), 'slider', [0, 100]);
  registerLearnableTarget('fxRgbShift', document.querySelector('[data-effect="rgbShift"]'), 'slider', [0, 100]);
  registerLearnableTarget('fxRgbMultiply', document.querySelector('[data-effect="rgbMultiply"]'), 'slider', [0, 100]);
  registerLearnableTarget('fxInvert', document.querySelector('[data-effect="invert"]'), 'button');
  registerLearnableTarget('fxGrayscale', document.querySelector('[data-effect="grayscale"]'), 'button');
  registerLearnableTarget('fxSepia', document.querySelector('[data-effect="sepia"]'), 'button');
  registerLearnableTarget('flashToggle', document.getElementById('flashToggle'), 'button');
  registerLearnableTarget('autoSwitchToggle', document.getElementById('autoSwitch'), 'button');

  // MIDI Learn button
  const learnBtn = document.getElementById('midiLearnBtn');
  if (learnBtn) {
    learnBtn.addEventListener('click', () => {
      const active = toggleLearnMode();
      learnBtn.classList.toggle('active', active);
    });
  }

  // MIDI Clear button
  const clearBtn = document.getElementById('midiClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all MIDI Learn mappings?')) {
        clearAllLearnMappings();
      }
    });
  }
}

function createBankButtons(containerId, channel) {
  const container = document.getElementById(containerId);
  for (let i = 0; i < BANK_SIZE; i++) {
    const btn = document.createElement("button");
    btn.className = `bank-btn bank-${channel.toLowerCase()}`;
    btn.dataset.index = i;
    btn.dataset.channel = channel;
    if (i === 0) btn.classList.add("active");

    // Set button text (visible when no thumbnail)
    btn.textContent = i + 1;

    // Add bank number span for thumbnail overlay
    const numberSpan = document.createElement("span");
    numberSpan.className = "bank-number";
    numberSpan.textContent = i + 1;
    btn.appendChild(numberSpan);

    btn.addEventListener("click", () => {
      console.log(`Bank button clicked: channel=${channel}, index=${i}, type=${getSourceType(channel, i)}`);
      selectBank(channel, i);
    });

    btn.addEventListener("dragover", (e) => {
      e.preventDefault();
      btn.classList.add("dragover");
    });

    btn.addEventListener("dragleave", () => {
      btn.classList.remove("dragover");
    });

    btn.addEventListener("drop", async (e) => {
      e.preventDefault();
      btn.classList.remove("dragover");

      console.log(`[Bank ${channel}${i + 1}] drop event received`);

      // Check for VizMix media browser data first
      const vizmixData = e.dataTransfer.getData('application/vizmix-media');
      if (vizmixData) {
        console.log(`[Bank ${channel}${i + 1}] VizMix media data: ${vizmixData}`);
        try {
          const media = JSON.parse(vizmixData);
          if (media.mediaType === 'video') {
            // 4K以上の映像をブロック
            const res = await getVideoResolution(media.blobUrl);
            if (res && res.width > 1920) {
              alert("この映像は4K以上の解像度です。パフォーマンスの問題があるため、1080p以下の映像を使用してください。");
              return;
            }
            // Use blob URL directly
            setVideoSource(channel, i, media.blobUrl, media.name, media.type);
            btn.title = media.name;
            btn.classList.remove("shader");
            btn.classList.add("custom");
            console.log(`[${channel}] Bank ${i + 1}: Assigned video "${media.name}" from MediaBrowser`);

            // Generate thumbnail
            try {
              const thumbnail = await generateVideoThumbnail(media.blobUrl);
              setButtonThumbnail(btn, thumbnail);
              updateBankSettings(channel, i, { type: 'video', thumbnail, name: media.name });
            } catch (err) {
              console.warn("Failed to generate thumbnail:", err);
              updateBankSettings(channel, i, { type: 'video', thumbnail: null, name: media.name });
            }

            // Note: Can't broadcast blob URL to Output Window, need to fetch and send arrayBuffer
            try {
              const response = await fetch(media.blobUrl);
              const arrayBuffer = await response.arrayBuffer();
              broadcastVideoFile(channel, i, arrayBuffer, media.type, media.name);
            } catch (err) {
              console.warn("Failed to broadcast video to Output:", err);
            }

            if (btn.classList.contains("active")) {
              const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;
              videoChannel.currentIndex = -1;
              videoManager.setChannelSource(channel, i);
              setChannelSource(channel, "video", i);
              updateChannelPreview(channel);
            }
          } else if (media.mediaType === 'shader') {
            // Handle shader from MediaBrowser
            try {
              const response = await fetch(media.blobUrl);
              const shaderCode = await response.text();
              handleShaderCode(channel, i, shaderCode, media.name, btn);
            } catch (err) {
              console.error("Failed to load shader:", err);
            }
          }
          return;
        } catch (err) {
          console.error("Failed to parse VizMix media data:", err);
        }
      }

      // Fallback: Handle external file drop (from OS file manager)
      console.log(`[Bank ${channel}${i + 1}] files count: ${e.dataTransfer.files.length}`);
      console.log(`[Bank ${channel}${i + 1}] items count: ${e.dataTransfer.items.length}`);

      let file = null;
      if (e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      } else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const item = e.dataTransfer.items[0];
        if (item.kind === 'file') {
          file = item.getAsFile();
        }
      }

      if (!file) {
        console.warn(`[Bank ${channel}${i + 1}] No file in drop event`);
        return;
      }
      console.log(`[Bank ${channel}${i + 1}] File: ${file.name}, type: ${file.type}, size: ${file.size}`);

      if (file.type.startsWith("video/")) {
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: file.type });
        const url = URL.createObjectURL(blob);

        // 4K以上の映像をブロック
        const res = await getVideoResolution(url);
        if (res && res.width > 1920) {
          URL.revokeObjectURL(url);
          alert("この映像は4K以上の解像度です。パフォーマンスの問題があるため、1080p以下の映像を使用してください。");
          return;
        }

        setVideoSource(channel, i, url, file.name, file.type);
        btn.title = file.name;
        btn.classList.remove("shader");
        btn.classList.add("custom");
        console.log(`[${channel}] Bank ${i + 1}: Assigned video "${file.name}"`);

        // Generate thumbnail
        try {
          const thumbnail = await generateVideoThumbnail(url);
          setButtonThumbnail(btn, thumbnail);
          updateBankSettings(channel, i, { type: 'video', thumbnail, name: file.name });
        } catch (err) {
          console.warn("Failed to generate thumbnail:", err);
          updateBankSettings(channel, i, { type: 'video', thumbnail: null, name: file.name });
        }

        broadcastVideoFile(channel, i, arrayBuffer, file.type, file.name);

        if (btn.classList.contains("active")) {
          const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;
          videoChannel.currentIndex = -1;
          videoManager.setChannelSource(channel, i);
          setChannelSource(channel, "video", i);
          updateChannelPreview(channel);
        }
      } else if (file.name.endsWith(".glsl") || file.name.endsWith(".frag") || file.name.endsWith(".fs")) {
        handleShaderDrop(channel, i, file, btn);
      } else {
        console.warn("Unsupported file type:", file.type);
      }
    });

    container.appendChild(btn);
  }
}

// シェーダープレビューレンダラー（チャンネルごと）
const shaderPreviews = { A: null, B: null };

function destroyShaderPreview(channel) {
  if (shaderPreviews[channel]) {
    shaderPreviews[channel].destroy();
    shaderPreviews[channel] = null;
  }
}

function updateChannelPreview(channel) {
  const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;
  const previewId = channel === "A" ? "previewA" : "previewB";
  const indicatorId = channel === "A" ? "shaderIndicatorA" : "shaderIndicatorB";
  const preview = document.getElementById(previewId);
  const indicator = document.getElementById(indicatorId);

  if (!preview) return;

  // Check if in webcam mode
  const isWebcamMode = channelSourceMode[channel] === 'cam' && webcamManager && webcamManager.isActive(channel);

  // シェーダープレビューの除去
  const removeShaderPreview = () => {
    destroyShaderPreview(channel);
    const cvs = preview.querySelector('canvas.shader-preview');
    if (cvs) cvs.remove();
  };

  if (isWebcamMode) {
    // Webcam mode
    preview.classList.remove('shader-mode');
    preview.classList.add('video-mode');
    if (indicator) indicator.classList.remove('visible');
    removeShaderPreview();

    const webcamVideo = webcamManager.getVideo(channel);
    if (webcamVideo) {
      // Remove old videos and add webcam video
      const oldVideos = preview.querySelectorAll('video');
      oldVideos.forEach(v => {
        if (v !== webcamVideo) v.remove();
      });
      if (!preview.contains(webcamVideo)) {
        preview.appendChild(webcamVideo);
      }
      webcamVideo.style.cssText = "display:block;width:100%;height:100%;object-fit:cover;";
    }
    console.log(`Preview ${channel} updated (webcam mode)`);
  } else if (videoChannel.currentSourceType === 'shader') {
    // Shader mode
    preview.classList.add('shader-mode');
    preview.classList.remove('video-mode');
    if (indicator) indicator.classList.remove('visible');

    // Remove webcam video if present
    const webcamVideo = webcamManager ? webcamManager.getVideo(channel) : null;
    if (webcamVideo && preview.contains(webcamVideo)) {
      webcamVideo.style.display = 'none';
    }

    // シェーダープレビュー用canvas + レンダラーを生成
    let cvs = preview.querySelector('canvas.shader-preview');
    if (!cvs) {
      removeShaderPreview();
      cvs = document.createElement('canvas');
      cvs.className = 'shader-preview';
      cvs.width = 320;
      cvs.height = 180;
      cvs.style.transform = 'scaleY(-1)';
      preview.appendChild(cvs);
    }

    // 現在のバンクの生ソースを取得してプレビューレンダラーにセット
    const rawSource = getShaderRawSource(channel, videoChannel.currentIndex);
    if (rawSource) {
      if (!shaderPreviews[channel]) {
        shaderPreviews[channel] = new ShaderPreviewRenderer(cvs);
      }
      shaderPreviews[channel].setShader(rawSource);
    }

    console.log(`Preview ${channel} updated (shader mode)`);
  } else {
    // Bank video mode
    preview.classList.remove('shader-mode');
    preview.classList.add('video-mode');
    if (indicator) indicator.classList.remove('visible');
    removeShaderPreview();

    // Remove webcam video if present
    const webcamVideo = webcamManager ? webcamManager.getVideo(channel) : null;
    if (webcamVideo && preview.contains(webcamVideo)) {
      webcamVideo.remove();
    }

    if (videoChannel && videoChannel.video) {
      if (!preview.contains(videoChannel.video)) {
        const oldVideos = preview.querySelectorAll('video');
        oldVideos.forEach(v => v.remove());
        preview.appendChild(videoChannel.video);
      }
      videoChannel.video.style.cssText = "display:block;width:100%;height:100%;object-fit:cover;";
    }
    console.log(`Preview ${channel} updated (video mode)`);
  }
}

async function handleShaderDrop(channel, index, file, btn) {
  try {
    const shaderCode = await file.text();
    handleShaderCode(channel, index, shaderCode, file.name, btn);
  } catch (e) {
    console.error("Failed to load shader:", e);
    alert(`シェーダーの読み込みに失敗しました: ${e.message}`);
  }
}

/**
 * ISFフォーマット(.fs)をPlayCanvas ShaderSource用GLSLに変換
 * - /*{ JSON }*\/ ヘッダーを除去
 * - void main() → void mainImage(out vec4 fragColor, in vec2 fragCoord)
 * - isf_FragNormCoord → (fragCoord / iResolution.xy)
 * - RENDERSIZE → iResolution.xy
 * - TIME → iTime
 * - gl_FragColor → fragColor
 */
function parseISFForPlayCanvas(source) {
  // INPUTSを取得
  let isfMeta = null;
  const metaMatch = source.match(/\/\*(\{[\s\S]*?\})\*\//m);
  if (metaMatch) {
    try { isfMeta = JSON.parse(metaMatch[1]); } catch(e) {}
  }

  let code = source.replace(/\/\*\{[\s\S]*?\}\*\//m, '').trim();
  code = code.replace(/\bisf_FragNormCoord\b/g, '(fragCoord / iResolution.xy)');
  code = code.replace(/\bRENDERSIZE\b/g, 'iResolution.xy');
  code = code.replace(/\bTIME\b/g, 'iTime');
  code = code.replace(/void\s+main\s*\(\s*\)/, 'void mainImage(out vec4 fragColor, in vec2 fragCoord)');
  code = code.replace(/\bgl_FragColor\b/g, 'fragColor');

  // INPUTSのuniform宣言を先頭に追加
  const typeMap = { float:'float', bool:'bool', int:'int', color:'vec4', point2D:'vec2' };
  let uniformDecls = '';
  if (isfMeta && isfMeta.INPUTS) {
    for (const inp of isfMeta.INPUTS) {
      const t = typeMap[inp.TYPE] || 'float';
      uniformDecls += `uniform ${t} ${inp.NAME};\n`;
    }
  }
  return uniformDecls + code;
}

function handleShaderCode(channel, index, shaderCode, fileName, btn) {
  console.log('[ISF変換前]', shaderCode.substring(0, 100));
  const isISF = fileName.toLowerCase().endsWith('.fs');
  const convertedCode = isISF ? parseISFForPlayCanvas(shaderCode) : shaderCode;
  console.log('[ISF変換後]', convertedCode.substring(0, 100));
  console.log(`handleShaderCode: [${channel}] bank=${index + 1}, file=${fileName}, code length=${convertedCode.length}`);

  setShaderSource(channel, index, convertedCode, fileName);
  setShaderRawSource(channel, index, shaderCode);
  videoManager.invalidateShaderCache(channel, index);

  // ISF INPUTSのDEFAULT値をバンクデータに保存（ShaderSource作成時に適用される）
  if (isISF) {
    const metaMatch = shaderCode.match(/\/\*(\{[\s\S]*?\})\*\//m);
    if (metaMatch) {
      try {
        const isfMeta = JSON.parse(metaMatch[1]);
        if (isfMeta.INPUTS) {
          const defaults = {};
          for (const inp of isfMeta.INPUTS) {
            if (inp.DEFAULT !== undefined) {
              defaults[inp.NAME] = inp.DEFAULT;
            }
          }
          if (Object.keys(defaults).length > 0) {
            setShaderDefaults(channel, index, defaults);
          }
        }
      } catch(e) { console.warn('ISF DEFAULT parse error:', e); }
    }

    // ISFサムネール生成（生のISFソースを渡す）
    generateISFThumbnail(shaderCode).then(thumb => {
      if (thumb) setButtonThumbnail(btn, thumb);
    }).catch(e => console.warn('ISF thumbnail error:', e));
  }

  btn.title = fileName;
  btn.setAttribute('data-name', fileName);
  btn.classList.remove("custom");
  btn.classList.add("shader");
  console.log(`[${channel}] Bank ${index + 1}: Assigned shader "${fileName}"`);

  // Save shader to storage
  saveShaderCode(channel, index, convertedCode);
  updateBankSettings(channel, index, { type: 'shader', name: fileName, thumbnail: null });

  broadcastShaderFile(channel, index, convertedCode, fileName);

  if (btn.classList.contains("active")) {
    console.log(`handleShaderCode: [${channel}] Bank ${index + 1} is active, switching`);

    const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;
    videoChannel.currentShaderVersion = -1;

    videoManager.setChannelSource(channel, index);
    setChannelSource(channel, "shader", index);
    updateChannelPreview(channel);
  }
}

/**
 * メディアをBankにアサインする共通関数（ドロップ & ダブルクリック共用）
 */
async function assignMediaToBank(channel, index, media) {
  const container = document.getElementById(`bank${channel}`);
  if (!container) return;
  const btn = container.querySelectorAll('.bank-btn')[index];
  if (!btn) return;

  if (media.mediaType === 'video') {
    // 4K以上の映像をブロック
    const res = await getVideoResolution(media.blobUrl);
    if (res && res.width > 1920) {
      alert("この映像は4K以上の解像度です。パフォーマンスの問題があるため、1080p以下の映像を使用してください。");
      return;
    }
    setVideoSource(channel, index, media.blobUrl, media.name, media.type);
    btn.title = media.name;
    btn.classList.remove("shader");
    btn.classList.add("custom");

    try {
      const thumbnail = await generateVideoThumbnail(media.blobUrl);
      setButtonThumbnail(btn, thumbnail);
      updateBankSettings(channel, index, { type: 'video', thumbnail, name: media.name });
    } catch (err) {
      console.warn("Failed to generate thumbnail:", err);
      updateBankSettings(channel, index, { type: 'video', thumbnail: null, name: media.name });
    }

    try {
      const response = await fetch(media.blobUrl);
      const arrayBuffer = await response.arrayBuffer();
      broadcastVideoFile(channel, index, arrayBuffer, media.type, media.name);
    } catch (err) {
      console.warn("Failed to broadcast video to Output:", err);
    }

    if (btn.classList.contains("active")) {
      const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;
      videoChannel.currentIndex = -1;
      videoManager.setChannelSource(channel, index);
      setChannelSource(channel, "video", index);
      updateChannelPreview(channel);
    }
  } else if (media.mediaType === 'shader') {
    try {
      const response = await fetch(media.blobUrl);
      const shaderCode = await response.text();
      handleShaderCode(channel, index, shaderCode, media.name, btn);
    } catch (err) {
      console.error("Failed to load shader:", err);
    }
  }

  console.log(`[${channel}] Bank ${index + 1}: Assigned "${media.name}" via double-click/drop`);
}

function updatePreviewBorders(value) {
  const previewA = document.getElementById("previewA");
  const previewB = document.getElementById("previewB");
  previewA.classList.toggle("active", value <= 0.5);
  previewB.classList.toggle("active", value >= 0.5);
}

function createVideoPlane(name, zPosition) {
  const plane = new pc.Entity(name);
  plane.addComponent("render", {
    type: "plane",
  });

  const material = new pc.StandardMaterial();
  material.useLighting = false;
  material.emissive = new pc.Color(1, 1, 1);
  material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.update();

  plane.render.material = material;
  plane.setLocalEulerAngles(-90, 0, 0);
  plane.setLocalPosition(0, 0, zPosition);

  console.log("Plane created:", name);

  return { entity: plane, material: material };
}

function updatePlaneSize() {
  if (!planeA || !planeB || !camera) return;

  const screenAspect = camera.camera.aspectRatio;
  const orthoHeight = camera.camera.orthoHeight;
  const screenHeight = orthoHeight * 2;
  const screenWidth = screenHeight * screenAspect;

  // Calculate size for Plane A
  const texA = videoManager.getTextureA();
  const aspectA = texA && texA.width && texA.height
    ? (texA.width / texA.height)
    : (16 / 9);

  let widthA, heightA;
  if (screenAspect > aspectA) {
    widthA = screenWidth;
    heightA = widthA / aspectA;
  } else {
    heightA = screenHeight;
    widthA = heightA * aspectA;
  }
  planeA.setLocalScale(widthA, 1, -heightA);

  // Calculate size for Plane B (independent)
  const texB = videoManager.getTextureB();
  const aspectB = texB && texB.width && texB.height
    ? (texB.width / texB.height)
    : (16 / 9);

  let widthB, heightB;
  if (screenAspect > aspectB) {
    widthB = screenWidth;
    heightB = widthB / aspectB;
  } else {
    heightB = screenHeight;
    widthB = heightB * aspectB;
  }
  planeB.setLocalScale(widthB, 1, -heightB);

  console.log(
    "updatePlaneSize - texA:", texA ? `${texA.width}x${texA.height}` : 'null',
    "texB:", texB ? `${texB.width}x${texB.height}` : 'null',
    "=> A:", `${widthA.toFixed(1)}x${heightA.toFixed(1)} (${aspectA.toFixed(2)})`,
    "B:", `${widthB.toFixed(1)}x${heightB.toFixed(1)} (${aspectB.toFixed(2)})`
  );
}

async function initPlayCanvas() {
  const canvas = document.getElementById("canvasMaster");
  const container = canvas.parentElement;

  app = new pc.Application(canvas, {
    graphicsDeviceOptions: { alpha: true },
  });

  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_FIXED, currentOutputWidth, currentOutputHeight);

  // captureStream用に選択解像度で描画。CSSでプレビューサイズに縮小表示。
  app.resizeCanvas(currentOutputWidth, currentOutputHeight);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.objectFit = 'contain';

  const device = app.graphicsDevice;

  try {
    await videoManager.init(device);
  } catch (e) {
    console.error("Failed to initialize video manager:", e);
  }

  console.log("Video A ready:", videoManager.channelA.video.readyState);
  console.log("Video B ready:", videoManager.channelB.video.readyState);

  camera = new pc.Entity("camera");
  camera.addComponent("camera", {
    clearColor: new pc.Color(0, 0, 0),
    projection: pc.PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 1,
  });
  camera.setPosition(0, 0, 1);
  app.root.addChild(camera);

  console.log("Camera created (Orthographic)");
  console.log("  Position:", camera.getPosition().toString());
  console.log("  orthoHeight:", camera.camera.orthoHeight);

  const resultA = createVideoPlane("PlaneA", -0.01);
  const resultB = createVideoPlane("PlaneB", 0);

  planeA = resultA.entity;
  planeB = resultB.entity;
  materialA = resultA.material;
  materialB = resultB.material;

  app.root.addChild(planeA);
  app.root.addChild(planeB);

  currentCrossfadeValue = state.crossfade;

  let lastLogTime = 0;
  let shaderDebugCount = 0;

  app.on("update", function (dt) {
    const channelA = videoManager.channelA;
    const channelB = videoManager.channelB;
    const canvas = app.graphicsDevice.canvas;

    if (channelA.currentSourceType === 'shader' && channelA.shaderSource) {
      channelA.shaderSource.setResolution(canvas.width, canvas.height);
    }
    if (channelB.currentSourceType === 'shader' && channelB.shaderSource) {
      channelB.shaderSource.setResolution(canvas.width, canvas.height);
    }

    videoManager.update();

    // シェーダープレビューレンダラー更新（メインShaderSourceと同じ時刻基準）
    if (shaderPreviews.A?.active) {
      const t = channelA.shaderSource ? performance.now() / 1000 - channelA.shaderSource.startTime : 0;
      shaderPreviews.A.render(t);
    }
    if (shaderPreviews.B?.active) {
      const t = channelB.shaderSource ? performance.now() / 1000 - channelB.shaderSource.startTime : 0;
      shaderPreviews.B.render(t);
    }

    const texA = videoManager.getTextureA();
    const texB = videoManager.getTextureB();

    if ((channelA.currentSourceType === 'shader' || channelB.currentSourceType === 'shader') && shaderDebugCount < 5) {
      console.log(`[Control Debug ${shaderDebugCount}]`, {
        chA_type: channelA.currentSourceType,
        chA_shaderName: channelA.shaderSource?.name,
        chA_tex: texA ? `${texA.width}x${texA.height}` : 'null',
        chB_type: channelB.currentSourceType,
        chB_shaderName: channelB.shaderSource?.name,
        chB_tex: texB ? `${texB.width}x${texB.height}` : 'null',
      });
      shaderDebugCount++;
    }

    if (texA && planeA) {
      const matA = planeA.render.meshInstances[0].material;
      if (matA.emissiveMap !== texA) {
        matA.emissiveMap = texA;
        updatePlaneSize(); // テクスチャ変更時にサイズ再計算
      }
      matA.opacity = (1.0 - currentCrossfadeValue) * dimmerA;
      matA.update();
    }

    if (texB && planeB) {
      const matB = planeB.render.meshInstances[0].material;
      if (matB.emissiveMap !== texB) {
        matB.emissiveMap = texB;
        updatePlaneSize(); // テクスチャ変更時にサイズ再計算
      }
      matB.opacity = currentCrossfadeValue * dimmerB;
      matB.update();
    }

    const now = performance.now();
    if (now - lastLogTime > 10000) {
      const shaderInfoA = channelA.currentSourceType === 'shader' && channelA.shaderSource 
        ? `shader:${channelA.shaderSource.name}` 
        : `video:${channelA.currentIndex + 1}`;
      const shaderInfoB = channelB.currentSourceType === 'shader' && channelB.shaderSource 
        ? `shader:${channelB.shaderSource.name}` 
        : `video:${channelB.currentIndex + 1}`;
      console.log(`[Control Status] A: ${shaderInfoA}, B: ${shaderInfoB}, crossfade: ${currentCrossfadeValue.toFixed(2)}`);
      lastLogTime = now;
    }

    if (showDebugOverlay) {
      updateDebugOverlay();
    }

    if (!textureUpdateLogged && texA && texB) {
      console.log("--- Initial Texture Debug Info ---");
      console.log("texA:", texA?.width, "x", texA?.height);
      console.log("texB:", texB?.width, "x", texB?.height);
      textureUpdateLogged = true;
    }

    if (!window.fpsData) {
      window.fpsData = { frames: 0, lastTime: performance.now() };
    }
    window.fpsData.frames++;
    if (now - window.fpsData.lastTime >= 1000) {
      const fpsEl = document.getElementById('fpsDisplay');
      if (fpsEl) fpsEl.textContent = `${window.fpsData.frames} FPS`;
      window.fpsData.frames = 0;
      window.fpsData.lastTime = now;
    }

    // エフェクト適用
    applyEffectsToCanvas();

    // 再生コントロールUI更新
    updatePlaybackUI();

    // BPM Flash overlay
    if (flashOpacity > 0) {
      if (!flashOverlay) {
        flashOverlay = document.createElement('div');
        flashOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:#fff;pointer-events:none;';
        document.getElementById('previewMaster').appendChild(flashOverlay);
      }
      flashOverlay.style.opacity = flashOpacity;
      flashOverlay.style.display = 'block';
      flashOpacity = Math.max(0, flashOpacity - dt * 20);
    } else if (flashOverlay) {
      flashOverlay.style.display = 'none';
    }
  });

  app.start();

  setTimeout(updatePlaneSize, 100);

  setupChannelPreviews();
}

function setupChannelPreviews() {
  const canvasA = document.getElementById("canvasA");
  const canvasB = document.getElementById("canvasB");

  if (canvasA) canvasA.style.display = "none";
  if (canvasB) canvasB.style.display = "none";

  const videoA = videoManager.channelA.video;
  const videoB = videoManager.channelB.video;

  if (videoA) {
    videoA.style.cssText =
      "display:block;width:100%;height:100%;object-fit:cover;";
    document.getElementById("previewA").appendChild(videoA);
  }

  if (videoB) {
    videoB.style.cssText =
      "display:block;width:100%;height:100%;object-fit:cover;";
    document.getElementById("previewB").appendChild(videoB);
  }

  console.log("Channel previews setup complete");
}

/**
 * Initialize Webcam UI and handlers
 */
async function initWebcamUI() {
  // Check if webcam is supported
  if (!WebcamManager.isSupported()) {
    console.warn('[Webcam] Not supported in this browser');
    disableWebcamButtons('Not supported');
    return;
  }

  if (!WebcamManager.isSecureContext()) {
    console.warn('[Webcam] Requires HTTPS or localhost');
    disableWebcamButtons('HTTPS required');
    return;
  }

  // Initialize webcam manager
  webcamManager = await initWebcam();
  if (!webcamManager) {
    disableWebcamButtons('Init failed');
    return;
  }

  // Populate camera dropdowns
  updateCameraDropdowns(webcamManager.devices);

  // Listen for device changes
  webcamManager.onDevicesUpdated = (devices) => {
    updateCameraDropdowns(devices);
  };

  // Bind source toggle buttons
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => handleSourceToggle(btn));
  });

  // Bind camera select dropdowns
  ['A', 'B'].forEach(channel => {
    const select = document.getElementById(`camSelect${channel}`);
    if (select) {
      select.addEventListener('change', (e) => handleCameraSelect(channel, e.target.value));
    }
  });

  console.log('[Webcam] UI initialized');
}

function disableWebcamButtons(reason) {
  document.querySelectorAll('.source-btn[data-source="cam"]').forEach(btn => {
    btn.classList.add('disabled');
    btn.title = reason;
    btn.disabled = true;
  });
}

function updateCameraDropdowns(devices) {
  ['A', 'B'].forEach(channel => {
    const select = document.getElementById(`camSelect${channel}`);
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Camera --</option>';

    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label;
      select.appendChild(option);
    });

    // Restore selection if still available
    if (currentValue && devices.some(d => d.deviceId === currentValue)) {
      select.value = currentValue;
    }
  });
}

async function handleSourceToggle(btn) {
  if (btn.disabled) return;

  const channel = btn.dataset.channel;
  const source = btn.dataset.source;

  // Update button states
  const toggleContainer = btn.parentElement;
  toggleContainer.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Show/hide camera select dropdown
  const camSelectRow = document.getElementById(`camSelectRow${channel}`);

  if (source === 'media') {
    if (camSelectRow) camSelectRow.style.display = 'none';

    // Stop webcam if active
    if (webcamManager && webcamManager.isActive(channel)) {
      webcamManager.stop(channel);
    }

    // Clear webcam source and restore bank video
    videoManager.clearWebcamSource(channel);
    channelSourceMode[channel] = 'media';

    // Restore active bank video
    const buttons = document.querySelectorAll(`#bank${channel} .bank-btn`);
    const activeBtn = Array.from(buttons).find(b => b.classList.contains('active'));
    if (activeBtn) {
      const index = parseInt(activeBtn.dataset.index);
      videoManager.setChannelSource(channel, index);
    }
    updateChannelPreview(channel);

    console.log(`[${channel}] Switched to Media mode`);
  } else {
    if (camSelectRow) camSelectRow.style.display = '';

    channelSourceMode[channel] = 'cam';

    // Start camera if one is selected
    const select = document.getElementById(`camSelect${channel}`);
    if (select && select.value) {
      await handleCameraSelect(channel, select.value);
    }

    console.log(`[${channel}] Switched to Camera mode`);
  }
}

async function handleCameraSelect(channel, deviceId) {
  if (!webcamManager) return;

  if (!deviceId) {
    webcamManager.stop(channel);
    videoManager.clearWebcamSource(channel);
    updateChannelPreview(channel);
    console.log(`[${channel}] Camera stopped`);
    return;
  }

  console.log(`[${channel}] Starting camera...`);

  const result = await webcamManager.start(channel, deviceId);

  if (result.success) {
    // Connect webcam video to videoManager
    const video = webcamManager.getVideo(channel);
    videoManager.setWebcamSource(channel, video);
    updateChannelPreview(channel);

    console.log(`[${channel}] Camera started: ${result.label} (${result.width}x${result.height})`);
  } else {
    console.error(`[${channel}] Camera error: ${result.error}`);
    alert(`Camera error: ${result.error}`);
  }
}

init();

// Debug globals
window.videoManager = videoManager;
window.getPlaneA = () => planeA;
window.getPlaneB = () => planeB;
window.getMaterialA = () => materialA;
window.getMaterialB = () => materialB;
window.getApp = () => app;
