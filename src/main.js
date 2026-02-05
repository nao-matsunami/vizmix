/**
 * VizMix v0.6.0 - Control Screen
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
  broadcastState,
  broadcastVideoFile,
  broadcastShaderFile,
  broadcastAllShaders,
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
  resetEffect,
  getEffectParams,
} from "./effects.js";
import { videoManager, setVideoSource, setShaderSource, getSourceType, getShaderVersion } from "./videoManager.js";
import {
  bpmState,
  setBPM,
  tap,
  togglePlay,
  setAutoSwitch,
  setSwitchInterval,
  startBeatLoop,
} from "./bpm.js";
import { generateVideoThumbnail, setButtonThumbnail } from "./thumbnail.js";
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
import { initMidi, getMidiDevices } from "./midi.js";
import { initEffectsUI as initEffectsPanelUI, syncEffectsUI, handleEffectShortcut, hideEffectParams } from './effectsUI.js';

const BANK_SIZE = 8;
let outputWindow = null;
let app = null;
let planeA = null;
let planeB = null;
let materialA = null;
let materialB = null;
let camera = null;
let textureUpdateLogged = false;
let currentCrossfadeValue = 0;

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
  console.log("VizMix v0.6.0 Control initializing...");
  initBroadcast(handleMessage);
  initUI();
  await initPlayCanvas();
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
  console.log("VizMix v0.6.0 Control ready");
}

function handleMessage(data) {
  if (data.type === "request-state") {
    console.log("Received request-state from Output Window");
    broadcastAllShaders();
    setTimeout(() => {
      broadcastState();
    }, 50);
  }
}

function initUI() {
  document.getElementById("openOutput").addEventListener("click", () => {
    if (outputWindow && !outputWindow.closed) outputWindow.focus();
    else
      outputWindow = window.open(
        "./output.html",
        "VizMix-Output",
        "width=1280,height=720"
      );
  });

  // Clear settings button
  document.getElementById("clearSettings").addEventListener("click", () => {
    if (confirm("全ての設定をクリアしますか？\nAll settings will be reset.")) {
      clearSettings();
      location.reload();
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

  // Start beat loop
  startBeatLoop(onBeat, onAutoSwitch);
  console.log("BPM controls initialized");
}

function onBeat(beatCount) {
  // Update beat indicators
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`beat${i}`);
    if (dot) {
      dot.classList.toggle("active", i === beatCount);
    }
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
}

function selectBank(channel, index) {
  const container = document.getElementById(`bank${channel}`);
  if (!container) return;

  container.querySelectorAll('.bank-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  const sourceType = getSourceType(channel, index);
  videoManager.setChannelSource(channel, index);
  setChannelSource(channel, sourceType, index);
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
      const sourceType = getSourceType(channel, i);
      console.log(`Bank button clicked: channel=${channel}, index=${i}, type=${sourceType}`);
      
      container
        .querySelectorAll(".bank-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;
      
      if (sourceType === 'shader') {
        const currentVersion = videoChannel.currentShaderVersion;
        const bankVersion = getShaderVersion(channel, i);
        if (currentVersion !== bankVersion || videoChannel.currentIndex !== i) {
          videoChannel.currentShaderVersion = -1;
        }
      }

      videoManager.setChannelSource(channel, i);
      setChannelSource(channel, sourceType, i);
      updateChannelPreview(channel);
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

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (file.type.startsWith("video/")) {
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: file.type });
        const url = URL.createObjectURL(blob);

        setVideoSource(channel, i, url);
        btn.title = file.name;
        btn.classList.remove("shader");
        btn.classList.add("custom");
        console.log(`[${channel}] Bank ${i + 1}: Assigned video "${file.name}"`);

        // Generate thumbnail
        try {
          const thumbnail = await generateVideoThumbnail(url);
          setButtonThumbnail(btn, thumbnail);
          updateBankSettings(channel, i, { type: 'video', thumbnail, name: file.name });
        } catch (e) {
          console.warn("Failed to generate thumbnail:", e);
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

function updateChannelPreview(channel) {
  const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;
  const previewId = channel === "A" ? "previewA" : "previewB";
  const indicatorId = channel === "A" ? "shaderIndicatorA" : "shaderIndicatorB";
  const preview = document.getElementById(previewId);
  const indicator = document.getElementById(indicatorId);

  if (!preview) return;

  if (videoChannel.currentSourceType === 'shader') {
    preview.classList.add('shader-mode');
    preview.classList.remove('video-mode');
    if (indicator) indicator.classList.add('visible');
    console.log(`Preview ${channel} updated (shader mode)`);
  } else {
    preview.classList.remove('shader-mode');
    preview.classList.add('video-mode');
    if (indicator) indicator.classList.remove('visible');

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

    console.log(`handleShaderDrop: [${channel}] bank=${index + 1}, file=${file.name}, code length=${shaderCode.length}`);

    setShaderSource(channel, index, shaderCode, file.name);
    videoManager.invalidateShaderCache(channel, index);

    btn.title = file.name;
    btn.setAttribute('data-name', file.name);
    btn.classList.remove("custom");
    btn.classList.add("shader");
    console.log(`[${channel}] Bank ${index + 1}: Assigned shader "${file.name}"`);

    // Save shader to storage
    saveShaderCode(channel, index, shaderCode);
    updateBankSettings(channel, index, { type: 'shader', name: file.name, thumbnail: null });

    broadcastShaderFile(channel, index, shaderCode, file.name);

    if (btn.classList.contains("active")) {
      console.log(`handleShaderDrop: [${channel}] Bank ${index + 1} is active, switching`);

      const videoChannel = channel === "A" ? videoManager.channelA : videoManager.channelB;
      videoChannel.currentShaderVersion = -1;

      videoManager.setChannelSource(channel, index);
      setChannelSource(channel, "shader", index);
      updateChannelPreview(channel);
    }
  } catch (e) {
    console.error("Failed to load shader:", e);
    alert(`シェーダーの読み込みに失敗しました: ${e.message}`);
  }
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

  // 実際のテクスチャサイズから動的にアスペクト比を計算
  const texA = videoManager.getTextureA();
  const videoAspect = texA && texA.width && texA.height
    ? (texA.width / texA.height)
    : (16 / 9);

  let width, height;

  // Coverモード: 画面を埋める（黒帯なし）
  if (screenAspect > videoAspect) {
    // 画面が映像より横長 → 幅に合わせる
    width = screenWidth;
    height = width / videoAspect;
  } else {
    // 画面が映像より縦長 → 高さに合わせる
    height = screenHeight;
    width = height * videoAspect;
  }

  planeA.setLocalScale(width, 1, -height);
  planeB.setLocalScale(width, 1, -height);

  console.log(
    "Updated plane size (Cover):",
    width.toFixed(2),
    "x",
    height.toFixed(2),
    "Screen Aspect:",
    screenAspect.toFixed(2),
    "Video Aspect:",
    videoAspect.toFixed(2)
  );
}

async function initPlayCanvas() {
  const canvas = document.getElementById("canvasMaster");
  const container = canvas.parentElement;

  app = new pc.Application(canvas, {
    graphicsDeviceOptions: { alpha: true },
  });

  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  function resizeToContainer() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    app.resizeCanvas(width, height);
    console.log("Canvas resized to container:", width, "x", height);
  }

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
      matA.opacity = 1.0 - currentCrossfadeValue;
      matA.update();
    }

    if (texB && planeB) {
      const matB = planeB.render.meshInstances[0].material;
      if (matB.emissiveMap !== texB) {
        matB.emissiveMap = texB;
      }
      matB.opacity = currentCrossfadeValue;
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
  });

  app.start();

  resizeToContainer();
  setTimeout(updatePlaneSize, 100);

  window.addEventListener("resize", () => {
    resizeToContainer();
    setTimeout(updatePlaneSize, 100);
  });

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

init();

// Debug globals
window.videoManager = videoManager;
window.getPlaneA = () => planeA;
window.getPlaneB = () => planeB;
window.getMaterialA = () => materialA;
window.getMaterialB = () => materialB;
window.getApp = () => app;
