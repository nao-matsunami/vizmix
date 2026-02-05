/**
 * VizMix v0.6.0 - Output Screen
 * Plane-based video display with opacity crossfade
 * Each channel has independent 8 banks
 * BPM sync from Control screen
 * Effects (Invert, Grayscale, Sepia, Blur, Brightness, Contrast)
 */

import * as pc from "playcanvas";
import { state, initBroadcast } from "./mixer.js";
import { VideoManager, setVideoSource, setShaderSource, getSourceType } from "./videoManager.js";
import { bpmState, deserializeBpmState } from "./bpm.js";
import { deserializeEffectsState, getEffectParams } from "./effects.js";

let app = null;
let videoManager = null;
let planeA = null;
let planeB = null;
let materialA = null;
let materialB = null;
let camera = null;
let currentCrossfadeValue = 0.5;

// 初期化前に受信したメッセージをバッファリング
let pendingMessages = [];
let isInitialized = false;

// 現在のチャンネル状態
let currentChannelA = { type: 'video', index: 0 };
let currentChannelB = { type: 'video', index: 1 };

// 更新されたバンクを追跡（video-file/shader-file受信時にセット）
let updatedBanks = { A: new Set(), B: new Set() };

// BPM状態
let currentBeatCount = 0;

// デバッグオーバーレイ
let debugOverlay = null;
let showDebugOverlay = false;

function createDebugOverlay() {
  debugOverlay = document.createElement('div');
  debugOverlay.id = 'debugOverlay';
  debugOverlay.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0,0,0,0.7);
    color: #0f0;
    font-family: monospace;
    font-size: 14px;
    padding: 10px;
    border-radius: 5px;
    z-index: 1000;
    display: none;
  `;
  document.body.appendChild(debugOverlay);
}

function updateDebugOverlay() {
  if (!debugOverlay || !videoManager) return;
  
  const chA = videoManager.channelA;
  const chB = videoManager.channelB;
  
  const infoA = chA.currentSourceType === 'shader'
    ? `SHADER Bank${chA.currentIndex + 1} "${chA.shaderSource?.name}" (${chA.shaderSource?.shaderCode?.length || 0} chars)`
    : `VIDEO Bank${chA.currentIndex + 1}`;
    
  const infoB = chB.currentSourceType === 'shader'
    ? `SHADER Bank${chB.currentIndex + 1} "${chB.shaderSource?.name}" (${chB.shaderSource?.shaderCode?.length || 0} chars)`
    : `VIDEO Bank${chB.currentIndex + 1}`;
  
  const beatDots = ['○', '○', '○', '○'];
  beatDots[currentBeatCount] = '●';

  debugOverlay.innerHTML = `
    <div>Ch A: ${infoA}</div>
    <div>Ch B: ${infoB}</div>
    <div>Crossfade: ${currentCrossfadeValue.toFixed(2)}</div>
    <div>BPM: ${bpmState.bpm} ${beatDots.join(' ')}</div>
    <div style="font-size:11px;color:#888;margin-top:5px">Press D to toggle</div>
  `;
}

async function init() {
  console.log("WB VJ Output initializing...");
  initBroadcast(handleMessage);
  requestState();
  await initPlayCanvas();
  initKeyboard();
  createDebugOverlay();
  document.addEventListener("dblclick", toggleFullscreen);

  document.addEventListener(
    "click",
    () => {
      if (videoManager) videoManager.playAll();
    },
    { once: true }
  );

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && videoManager) {
      console.log("Visibility changed, resuming playback");
      videoManager.playAll();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (videoManager) {
      console.log("Fullscreen changed, ensuring playback");
      setTimeout(() => videoManager.playAll(), 100);
    }
  });

  isInitialized = true;
  
  if (pendingMessages.length > 0) {
    console.log(`Output: Processing ${pendingMessages.length} pending messages`);
    for (const msg of pendingMessages) {
      handleMessage(msg);
    }
    pendingMessages = [];
  }

  console.log("WB VJ Output ready");
}

function handleMessage(data) {
  if (!isInitialized) {
    console.log(`Output: Buffering message (type: ${data.type})`);
    pendingMessages.push(data);
    return;
  }

  if (data.type === "state") {
    Object.assign(state, data.state);
    currentCrossfadeValue = state.crossfade;

    // BPM state sync
    if (data.bpm) {
      deserializeBpmState(data.bpm);
    }

    // エフェクト状態の同期
    if (data.effects) {
      deserializeEffectsState(data.effects);
      applyEffectsToCanvas();
    }

    const chA = state.channelA;
    const newAIndex = chA.source === 'shader' ? chA.shaderIndex : chA.videoIndex;
    const newAType = chA.source || 'video';
    
    // 更新されたバンクを使っている場合は強制リロード
    const forceReloadA = updatedBanks.A.has(newAIndex);
    if (forceReloadA) updatedBanks.A.delete(newAIndex);
    
    if (forceReloadA || currentChannelA.type !== newAType || currentChannelA.index !== newAIndex) {
      console.log(`Output: Switching Channel A to ${newAType} ${newAIndex + 1}${forceReloadA ? ' (force reload)' : ''}`);
      if (videoManager) {
        videoManager.channelA.currentIndex = -1;
        videoManager.channelA.currentShaderVersion = -1;
        videoManager.setChannelSource("A", newAIndex);
      }
      currentChannelA = { type: newAType, index: newAIndex };
    }

    const chB = state.channelB;
    const newBIndex = chB.source === 'shader' ? chB.shaderIndex : chB.videoIndex;
    const newBType = chB.source || 'video';
    
    // 更新されたバンクを使っている場合は強制リロード
    const forceReloadB = updatedBanks.B.has(newBIndex);
    if (forceReloadB) updatedBanks.B.delete(newBIndex);
    
    if (forceReloadB || currentChannelB.type !== newBType || currentChannelB.index !== newBIndex) {
      console.log(`Output: Switching Channel B to ${newBType} ${newBIndex + 1}${forceReloadB ? ' (force reload)' : ''}`);
      if (videoManager) {
        videoManager.channelB.currentIndex = -1;
        videoManager.channelB.currentShaderVersion = -1;
        videoManager.setChannelSource("B", newBIndex);
      }
      currentChannelB = { type: newBType, index: newBIndex };
    }
  } else if (data.type === "video-file") {
    const channel = data.channel;
    console.log(`Output: Received video file for [${channel}] bank ${data.index + 1}: ${data.fileName}`);

    const uint8Array = new Uint8Array(data.data);
    const blob = new Blob([uint8Array], { type: data.mimeType });
    const url = URL.createObjectURL(blob);

    setVideoSource(channel, data.index, url);
    
    // バンクが更新されたことを記録
    updatedBanks[channel].add(data.index);
    
    reloadIfUsingBank(channel, data.index);
  } else if (data.type === "shader-file") {
    const channel = data.channel;
    console.log(`Output: Received shader file for [${channel}] bank ${data.index + 1}: ${data.fileName} (${data.code?.length || 0} chars)`);

    setShaderSource(channel, data.index, data.code, data.fileName);

    if (videoManager) {
      videoManager.invalidateShaderCache(channel, data.index);
    }
    
    // バンクが更新されたことを記録
    updatedBanks[channel].add(data.index);

    reloadIfUsingBank(channel, data.index);
  } else if (data.type === "bpm") {
    // BPM state update
    if (data.bpm) {
      deserializeBpmState(data.bpm);
      console.log(`Output: BPM updated to ${bpmState.bpm}`);
    }
  } else if (data.type === "beat") {
    // Beat sync
    currentBeatCount = data.beatCount;
    if (data.bpm) {
      bpmState.bpm = data.bpm;
    }
  } else if (data.type === "auto-switch") {
    // Auto switch handled by state update
    console.log("Output: Received auto-switch signal");
  } else if (data.type === "effects") {
    // エフェクト状態の更新
    if (data.effects) {
      deserializeEffectsState(data.effects);
      applyEffectsToCanvas();
    }
  }
}

// エフェクトをキャンバスに適用（CSS filter使用）
function applyEffectsToCanvas() {
  if (!app) return;

  const canvas = app.graphicsDevice.canvas;
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

function reloadIfUsingBank(channel, bankIndex) {
  if (!videoManager) return;

  if (channel === "A" && currentChannelA.index === bankIndex) {
    console.log(`Output: Reloading Channel A (bank ${bankIndex + 1} updated)`);
    videoManager.channelA.currentIndex = -1;
    videoManager.channelA.currentShaderVersion = -1;
    videoManager.setChannelSource("A", bankIndex);
  }
  
  if (channel === "B" && currentChannelB.index === bankIndex) {
    console.log(`Output: Reloading Channel B (bank ${bankIndex + 1} updated)`);
    videoManager.channelB.currentIndex = -1;
    videoManager.channelB.currentShaderVersion = -1;
    videoManager.setChannelSource("B", bankIndex);
  }
}

function requestState() {
  const channel = new BroadcastChannel("wb-vj-sync");
  channel.postMessage({ type: "request-state" });
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
  plane.setLocalScale(1, 1, 1);

  return { entity: plane, material: material };
}

async function initPlayCanvas() {
  const canvas = document.getElementById("output");
  console.log('Output: canvas element', canvas);

  app = new pc.Application(canvas, {
    graphicsDeviceOptions: { alpha: false, antialias: true },
  });

  // アスペクト比を維持するため、手動でサイズ管理
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  // 16:9 アスペクト比を維持してリサイズ
  resizeCanvasWithAspect();

  const device = app.graphicsDevice;
  console.log('Output: graphics device ready');

  videoManager = new VideoManager();
  try {
    await videoManager.init(device);
    console.log('Output: VideoManager initialized');
    console.log('Output: Video A ready:', videoManager.channelA.video.readyState);
    console.log('Output: Video B ready:', videoManager.channelB.video.readyState);
  } catch (e) {
    console.error("Failed to initialize video manager:", e);
  }

  camera = new pc.Entity("camera");
  camera.addComponent("camera", {
    clearColor: new pc.Color(0, 0, 0),
    projection: pc.PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 1,
  });
  camera.setPosition(0, 0, 1);
  app.root.addChild(camera);
  console.log('Output: Camera created');

  const resultA = createVideoPlane("PlaneA", -0.01);
  const resultB = createVideoPlane("PlaneB", 0);

  planeA = resultA.entity;
  planeB = resultB.entity;
  materialA = resultA.material;
  materialB = resultB.material;

  app.root.addChild(planeA);
  app.root.addChild(planeB);

  let textureLogged = false;
  let lastLogTime = 0;
  let shaderDebugCount = 0;

  app.on("update", () => {
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
      console.log(`[Output Debug ${shaderDebugCount}]`, {
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
        console.log('Output: Updated texture A');
        updatePlaneSize(); // テクスチャ変更時にサイズ再計算
      }
      matA.opacity = 1.0 - currentCrossfadeValue;
      matA.update();
    }

    if (texB && planeB) {
      const matB = planeB.render.meshInstances[0].material;
      if (matB.emissiveMap !== texB) {
        matB.emissiveMap = texB;
        console.log('Output: Updated texture B');
      }
      matB.opacity = currentCrossfadeValue;
      matB.update();
    }

    const now = performance.now();
    if (now - lastLogTime > 10000) {
      const infoA = channelA.currentSourceType === 'shader' 
        ? `shader:${channelA.shaderSource?.name || 'unknown'}` 
        : `video:${channelA.currentIndex + 1}`;
      const infoB = channelB.currentSourceType === 'shader' 
        ? `shader:${channelB.shaderSource?.name || 'unknown'}` 
        : `video:${channelB.currentIndex + 1}`;
      console.log(`[Output Status] A: ${infoA}, B: ${infoB}, crossfade: ${currentCrossfadeValue.toFixed(2)}`);
      lastLogTime = now;
    }

    if (showDebugOverlay) {
      updateDebugOverlay();
    }

    if (!textureLogged && texA && texB) {
      console.log('Output textures ready:', { 
        texA: `${texA.width}x${texA.height}`, 
        texB: `${texB.width}x${texB.height}` 
      });
      textureLogged = true;
    }
  });

  app.start();
  console.log('Output PlayCanvas started');

  setTimeout(updatePlaneSize, 100);

  window.addEventListener("resize", () => {
    resizeCanvasWithAspect();
    setTimeout(updatePlaneSize, 100);
  });
}

// 16:9 アスペクト比を維持してキャンバスをリサイズ
function resizeCanvasWithAspect() {
  if (!app) return;

  const targetAspect = 16 / 9;
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  const containerAspect = containerWidth / containerHeight;

  let canvasWidth, canvasHeight;

  if (containerAspect > targetAspect) {
    // ウィンドウが横長 → 高さに合わせる（左右に黒帯）
    canvasHeight = containerHeight;
    canvasWidth = Math.floor(containerHeight * targetAspect);
  } else {
    // ウィンドウが縦長 → 幅に合わせる（上下に黒帯）
    canvasWidth = containerWidth;
    canvasHeight = Math.floor(containerWidth / targetAspect);
  }

  const canvas = app.graphicsDevice.canvas;
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';
  canvas.style.position = 'absolute';
  canvas.style.left = Math.floor((containerWidth - canvasWidth) / 2) + 'px';
  canvas.style.top = Math.floor((containerHeight - canvasHeight) / 2) + 'px';

  // PlayCanvas の内部解像度も更新
  app.resizeCanvas(canvasWidth, canvasHeight);

  console.log(`Output: Canvas resized to ${canvasWidth}x${canvasHeight} (window: ${containerWidth}x${containerHeight})`);
}

function updatePlaneSize() {
  if (!planeA || !planeB || !camera) {
    console.log('updatePlaneSize: missing entities', { planeA: !!planeA, planeB: !!planeB, camera: !!camera });
    return;
  }

  const orthoHeight = camera.camera.orthoHeight;
  const screenHeight = orthoHeight * 2;
  const screenAspect = camera.camera.aspectRatio;
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

  console.log('Output updatePlaneSize (Cover):', width.toFixed(2), 'x', height.toFixed(2), 'Screen Aspect:', screenAspect.toFixed(2), 'Video Aspect:', videoAspect.toFixed(2));
}

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "f") toggleFullscreen();
    // デバッグオーバーレイ: Ctrl+Shift+D
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
      e.preventDefault();
      showDebugOverlay = !showDebugOverlay;
      if (debugOverlay) {
        debugOverlay.style.display = showDebugOverlay ? 'block' : 'none';
      }
    }
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

init();

// デバッグ用グローバル
window.outputVideoManager = () => videoManager;
window.getOutputApp = () => app;
window.getCurrentChannels = () => ({ A: currentChannelA, B: currentChannelB });
