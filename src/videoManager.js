/**
 * WB VJ - Video Manager
 * Handles video element creation and playback with bank switching
 * Each channel has its own independent 8 banks
 */

import * as pc from "playcanvas";
import { ShaderSource } from "./shaderRenderer.js";

// チャンネル別のバンク管理
// Channel A: サンプル動画 001-008
// Channel B: サンプル動画 009-016
const BANKS = {
  A: {
    videoSources: [
      "./samples/P01-001_Circle_color-1.0-0.1-0.1.mp4",
      "./samples/P01-002_Circle_color-0.1-0.3-1.0.mp4",
      "./samples/P01-003_Polygon_color-1.0-0.8-0.0.mp4",
      "./samples/P01-004_Polygon_color-0.3-1.0-0.3.mp4",
      "./samples/P01-005_Triangle_color-0.8-0.0-1.0.mp4",
      "./samples/P01-006_Triangle_color-0.0-1.0-1.0.mp4",
      "./samples/P01-007_Circle_color-0.5-0.0-0.5.mp4",
      "./samples/P01-008_Polygon_color-1.0-1.0-1.0.mp4",
    ],
    sourceTypes: ['video', 'video', 'video', 'video', 'video', 'video', 'video', 'video'],
    shaderCodes: [null, null, null, null, null, null, null, null],
    shaderNames: [null, null, null, null, null, null, null, null],
    shaderVersions: [0, 0, 0, 0, 0, 0, 0, 0],
  },
  B: {
    videoSources: [
      "./samples/P01-009_Circle_color-0.7-0.7-0.7.mp4",
      "./samples/P01-010_Triangle_color-0.9-0.9-0.0.mp4",
      "./samples/P01-011_12_kinetic_lines_color-1.0-1.0-1.0.mp4",
      "./samples/P01-012_13_kinetic_curves_color-0.0-1.0-1.0.mp4",
      "./samples/P01-013_12_kinetic_lines_color-0.0-1.0-0.0.mp4",
      "./samples/P01-014_13_kinetic_curves_color-1.0-0.5-0.0.mp4",
      "./samples/P01-015_12_kinetic_lines_color-1.0-0.0-0.5.mp4",
      "./samples/P01-016_Polygon_color-0.5-0.5-1.0.mp4",
    ],
    sourceTypes: ['video', 'video', 'video', 'video', 'video', 'video', 'video', 'video'],
    shaderCodes: [null, null, null, null, null, null, null, null],
    shaderNames: [null, null, null, null, null, null, null, null],
    shaderVersions: [0, 0, 0, 0, 0, 0, 0, 0],
  }
};

// 外部から動画ソースを設定
export function setVideoSource(channel, index, url) {
  const bank = BANKS[channel];
  if (!bank || index < 0 || index >= 8) return;
  
  bank.videoSources[index] = url;
  bank.sourceTypes[index] = 'video';
  bank.shaderCodes[index] = null;
  bank.shaderNames[index] = null;
  console.log(`[${channel}] Bank ${index + 1}: Video source updated to: ${url}`);
}

export function getVideoSource(channel, index) {
  const bank = BANKS[channel];
  if (!bank || index < 0 || index >= 8) return null;
  return bank.videoSources[index];
}

// シェーダーソースを設定
export function setShaderSource(channel, index, shaderCode, name = null) {
  const bank = BANKS[channel];
  if (!bank || index < 0 || index >= 8) return;
  
  bank.sourceTypes[index] = 'shader';
  bank.shaderCodes[index] = shaderCode;
  bank.shaderNames[index] = name || `shader_${index + 1}`;
  bank.shaderVersions[index]++;
  
  console.log(`[${channel}] Bank ${index + 1}: Shader saved (${shaderCode?.length || 0} chars), name: ${bank.shaderNames[index]}, version: ${bank.shaderVersions[index]}`);
}

export function getSourceType(channel, index) {
  const bank = BANKS[channel];
  if (!bank || index < 0 || index >= 8) return 'video';
  return bank.sourceTypes[index];
}

export function getShaderCode(channel, index) {
  const bank = BANKS[channel];
  if (!bank || index < 0 || index >= 8) return null;
  return bank.shaderCodes[index];
}

export function getShaderName(channel, index) {
  const bank = BANKS[channel];
  if (!bank || index < 0 || index >= 8) return null;
  return bank.shaderNames[index];
}

export function getShaderVersion(channel, index) {
  const bank = BANKS[channel];
  if (!bank || index < 0 || index >= 8) return 0;
  return bank.shaderVersions[index];
}

// デバッグ用：現在の状態を出力
export function debugBankStatus() {
  console.log("=== Bank Status ===");
  for (const ch of ['A', 'B']) {
    console.log(`--- Channel ${ch} ---`);
    const bank = BANKS[ch];
    for (let i = 0; i < 8; i++) {
      const type = bank.sourceTypes[i];
      if (type === 'shader') {
        console.log(`  Bank ${i + 1}: SHADER "${bank.shaderNames[i]}" v${bank.shaderVersions[i]} (${bank.shaderCodes[i]?.length || 0} chars)`);
      } else {
        console.log(`  Bank ${i + 1}: VIDEO "${bank.videoSources[i]}"`);
      }
    }
  }
}

// 全シェーダー情報を取得（Output Window同期用）
export function getAllShaderInfo() {
  const result = { A: [], B: [] };
  for (const ch of ['A', 'B']) {
    const bank = BANKS[ch];
    for (let i = 0; i < 8; i++) {
      if (bank.sourceTypes[i] === 'shader' && bank.shaderCodes[i]) {
        result[ch].push({
          index: i,
          code: bank.shaderCodes[i],
          name: bank.shaderNames[i],
        });
      }
    }
  }
  return result;
}

class VideoChannel {
  constructor(name) {
    this.name = name;
    this.video = null;
    this.texture = null;
    this.videoTexture = null;
    this.currentIndex = -1;
    this.device = null;
    this.currentSourceType = 'video';
    this.shaderSource = null;
    this.currentShaderVersion = -1;
    this.playbackState = 'play';
    this.reverseRAF = null;
  }

  async init(device, initialIndex = 0) {
    this.device = device;

    // Create video element
    this.video = document.createElement("video");
    this.video.id = `video-${this.name}`;
    this.video.loop = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.crossOrigin = "anonymous";
    this.video.preload = "auto";
    this.video.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;";
    document.body.appendChild(this.video);

    // Event listeners
    this.video.addEventListener("pause", () => {
      if (!document.hidden && this.currentSourceType === 'video' && this.playbackState === 'play') {
        this.video.play().catch(() => {});
      }
    });

    this.video.addEventListener("ended", () => {
      this.video.currentTime = 0;
      this.video.play().catch(() => {});
    });

    // Load initial video
    await this.loadVideo(initialIndex);
    this.currentIndex = initialIndex;

    return this;
  }

  async loadVideo(index) {
    const src = getVideoSource(this.name, index);
    if (!src) {
      console.warn(`[${this.name}] Invalid video index: ${index}`);
      return;
    }

    console.log(`[${this.name}] Loading video ${index + 1} (${src})`);

    this.video.src = src;

    await new Promise((resolve, reject) => {
      this.video.onloadedmetadata = resolve;
      this.video.onerror = (e) => {
        console.error(`Failed to load video: ${src}`, e);
        reject(e);
      };
    });

    if (!this.videoTexture) {
      this.videoTexture = new pc.Texture(this.device, {
        name: `videoTexture-${this.name}`,
        width: this.video.videoWidth,
        height: this.video.videoHeight,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
    }

    try {
      await this.video.play();
      console.log(`[${this.name}] Playing video ${index + 1}`);
    } catch (e) {
      console.warn(`[${this.name}] Autoplay blocked`);
    }
  }

  setSource(index) {
    const sourceType = getSourceType(this.name, index);
    const shaderVersion = getShaderVersion(this.name, index);

    console.log(`[${this.name}] setSource(${index}) -> type: ${sourceType}, currentIndex: ${this.currentIndex}`);

    if (sourceType === 'shader') {
      const shaderCode = getShaderCode(this.name, index);
      const shaderName = getShaderName(this.name, index);
      
      if (!shaderCode) {
        console.error(`[${this.name}] No shader code found for bank ${index + 1}`);
        return;
      }
      
      // 同じバンク＆同じバージョンならスキップ
      if (this.currentIndex === index && 
          this.currentSourceType === 'shader' && 
          this.currentShaderVersion === shaderVersion &&
          this.shaderSource) {
        console.log(`[${this.name}] Already using bank ${index + 1} v${shaderVersion}, skipping`);
        return;
      }
      
      this.currentSourceType = 'shader';
      this.currentIndex = index;
      this.currentShaderVersion = shaderVersion;
      
      try {
        console.log(`[${this.name}] Creating shader instance for bank ${index + 1}`);
        const newShader = new ShaderSource(this.device);
        newShader.loadFromCode(shaderCode);
        newShader.name = shaderName || `shader_${index + 1}`;
        
        this.shaderSource = newShader;
        console.log(`[${this.name}] Created shader: ${shaderName} (${shaderCode.length} chars)`);
      } catch (e) {
        console.error(`[${this.name}] Failed to create shader:`, e);
        return;
      }
      
      if (this.video) this.video.pause();
      console.log(`[${this.name}] Switched to shader ${index + 1}`);
    } else {
      // 同じ動画ならスキップ
      if (this.currentIndex === index && this.currentSourceType === 'video') {
        console.log(`[${this.name}] Already using video ${index + 1}, skipping`);
        return;
      }
      
      this.currentSourceType = 'video';
      this.currentIndex = index;
      this.shaderSource = null;
      this.currentShaderVersion = -1;
      
      this.loadVideo(index).catch(console.error);
      console.log(`[${this.name}] Switched to video ${index + 1}`);
    }
  }

  invalidateShaderCache(index) {
    if (this.currentIndex === index && this.currentSourceType === 'shader') {
      const newVersion = getShaderVersion(this.name, index);
      if (this.currentShaderVersion !== newVersion) {
        console.log(`[${this.name}] Shader version changed for bank ${index + 1}, will reload`);
        this.currentShaderVersion = -1;
      }
    }
  }

  update() {
    if (this.currentSourceType === 'shader' && this.shaderSource) {
      this.shaderSource.render();
      this.texture = this.shaderSource.getTexture();
    } else if (this.video && this.videoTexture && this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
      this.videoTexture.setSource(this.video);
      this.texture = this.videoTexture;
      if (this.video.paused && !document.hidden && this.playbackState === 'play') {
        this.video.play().catch(() => {});
      }
    }
  }

  play() {
    if (this.video && this.currentSourceType === 'video') {
      this.video.play();
    }
  }

  pause() {
    if (this.video) this.video.pause();
  }

  setPlaybackState(state) {
    if (this.currentSourceType === 'shader') return;

    this.playbackState = state;

    if (state === 'reverse') {
      this.video.pause();
      this.startReverse();
    } else {
      this.stopReverse();
      if (state === 'play') {
        this.video.play().catch(() => {});
      } else if (state === 'pause') {
        this.video.pause();
      }
    }
  }

  setPlaybackRate(rate) {
    if (this.video) {
      this.video.playbackRate = Math.max(0.25, Math.min(2, rate));
    }
  }

  startReverse() {
    if (this.reverseRAF) return;

    let lastTime = performance.now();

    const step = (now) => {
      if (this.playbackState !== 'reverse') return;

      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const rate = this.video.playbackRate || 1;
      this.video.currentTime -= delta * rate;

      if (this.video.currentTime <= 0) {
        this.video.currentTime = this.video.duration - 0.1;
      }

      this.reverseRAF = requestAnimationFrame(step);
    };

    this.reverseRAF = requestAnimationFrame(step);
  }

  stopReverse() {
    if (this.reverseRAF) {
      cancelAnimationFrame(this.reverseRAF);
      this.reverseRAF = null;
    }
  }

  get isReady() {
    if (this.currentSourceType === 'shader') {
      return this.shaderSource && this.shaderSource.initialized;
    }
    return this.video && this.videoTexture && this.video.readyState >= this.video.HAVE_CURRENT_DATA;
  }
}

export class VideoManager {
  constructor() {
    this.channelA = new VideoChannel("A");
    this.channelB = new VideoChannel("B");
    this.initialized = false;
  }

  async init(device) {
    await Promise.all([
      this.channelA.init(device, 0),
      this.channelB.init(device, 1)
    ]);
    this.initialized = true;
    console.log("VideoManager initialized (independent banks per channel)");
    return this;
  }

  setChannelSource(channel, index) {
    console.log(`VideoManager: setChannelSource(${channel}, ${index})`);
    if (channel === "A") {
      this.channelA.setSource(index);
    } else if (channel === "B") {
      this.channelB.setSource(index);
    }
  }

  invalidateShaderCache(channel, index) {
    if (channel === "A") {
      this.channelA.invalidateShaderCache(index);
    } else if (channel === "B") {
      this.channelB.invalidateShaderCache(index);
    }
  }

  update() {
    if (!this.initialized) return;
    this.channelA.update();
    this.channelB.update();
  }

  getTextureA() {
    return this.channelA.texture;
  }

  getTextureB() {
    return this.channelB.texture;
  }

  playAll() {
    this.channelA.play();
    this.channelB.play();
  }

  get isReady() {
    return this.channelA.isReady && this.channelB.isReady;
  }
}

export const videoManager = new VideoManager();

// デバッグ用にグローバルに公開
window.debugBankStatus = debugBankStatus;
