/**
 * WB VJ - Mixer Core
 * VizMix v0.7.0
 */

import { getAllShaderInfo, getCustomVideoInfo } from "./videoManager.js";
import { bpmState, serializeBpmState } from "./bpm.js";
import { serializeEffectsState } from "./effects.js";

export const state = {
  crossfade: 0.5,
  channelA: { source: null, videoIndex: 0, shaderIndex: 0 },
  channelB: { source: null, videoIndex: 1, shaderIndex: 0 },
};

const CHANNEL_NAME = "wb-vj-sync";
let broadcastChannel = null;
let outputWindowRef = null;

/**
 * Output Windowの参照を設定（postMessage + Transferable用）
 */
export function setOutputWindow(win) {
  outputWindowRef = win;
}

export function initBroadcast(onMessage) {
  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  if (onMessage) {
    broadcastChannel.onmessage = (event) => onMessage(event.data);
  }
  return broadcastChannel;
}

export function broadcastState() {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "state",
      state: { ...state },
      bpm: serializeBpmState(),
      effects: serializeEffectsState()
    });
  }
}

export function broadcastEffectsState() {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "effects",
      effects: serializeEffectsState()
    });
  }
}

export function broadcastBpmState() {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "bpm",
      bpm: serializeBpmState()
    });
  }
}

export function broadcastBeat(beatCount) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "beat",
      beatCount: beatCount,
      bpm: bpmState.bpm
    });
  }
}

export function broadcastAutoSwitch() {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "auto-switch"
    });
  }
}

// 設定リセット時にOutput Windowに通知
export function broadcastReset() {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "reset"
    });
    console.log("Broadcast reset to Output");
  }
}

export function setCrossfade(value) {
  state.crossfade = Math.max(0, Math.min(1, value));
  broadcastState();
}

export function setChannelSource(channel, sourceType, index) {
  const ch = channel === "A" ? state.channelA : state.channelB;
  ch.source = sourceType;
  if (sourceType === "video") ch.videoIndex = index;
  else if (sourceType === "shader") ch.shaderIndex = index;
  broadcastState();
}

export function getMixLevels() {
  return { a: 1 - state.crossfade, b: state.crossfade };
}

// Bank切替専用メッセージ（確実にOutput側に届ける）
export function broadcastBankSwitch(channel, sourceType, index) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "bank-switch",
      channel,
      sourceType,
      index,
    });
    console.log(`Broadcast bank-switch: [${channel}] ${sourceType} ${index + 1}`);
  }
}

export function broadcastVideoFile(channel, index, arrayBuffer, mimeType, fileName) {
  const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(1);

  // 優先: postMessage + Transferable（ゼロコピー転送）
  if (outputWindowRef && !outputWindowRef.closed) {
    try {
      outputWindowRef.postMessage({
        type: "video-file",
        channel,
        index,
        data: arrayBuffer,
        mimeType,
        fileName,
      }, '*', [arrayBuffer]); // Transferable: ArrayBufferはゼロコピーで移動
      console.log(`[Transferable] Video file: ${fileName} -> [${channel}] bank ${index + 1} (${sizeMB}MB)`);
      return;
    } catch (e) {
      console.warn('postMessage transfer failed, falling back to BroadcastChannel:', e);
    }
  }

  // フォールバック: BroadcastChannel（構造化クローン = メモリ2倍）
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "video-file",
      channel,
      index,
      data: arrayBuffer,
      mimeType,
      fileName,
    });
    console.log(`[BroadcastChannel fallback] Video file: ${fileName} -> [${channel}] bank ${index + 1} (${sizeMB}MB)`);
  }
}

export function broadcastShaderFile(channel, index, shaderCode, fileName) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "shader-file",
      channel: channel,
      index: index,
      code: shaderCode,
      fileName: fileName,
    });
    console.log(`Broadcast shader file: ${fileName} to [${channel}] bank ${index + 1}`);
  }
}

// 全てのシェーダー情報を送信（Output Window起動時用）
export function broadcastAllShaders() {
  if (!broadcastChannel) return;

  console.log("Broadcasting all shader info...");

  const allShaders = getAllShaderInfo();

  for (const channel of ['A', 'B']) {
    for (const shader of allShaders[channel]) {
      broadcastChannel.postMessage({
        type: "shader-file",
        channel: channel,
        index: shader.index,
        code: shader.code,
        fileName: shader.name,
      });
      console.log(`Broadcast shader for [${channel}] bank ${shader.index + 1}: ${shader.name}`);
    }
  }
}

// カスタム映像を全てOutput Windowに再送（再接続時用）
export async function transferAllCustomVideos() {
  const customVideos = getCustomVideoInfo();
  const totalCount = customVideos.A.length + customVideos.B.length;

  if (totalCount === 0) {
    console.log("[Re-sync] No custom videos to transfer");
    return 0;
  }

  console.log(`[Re-sync] Transferring ${totalCount} custom video(s)...`);
  let transferred = 0;

  for (const channel of ['A', 'B']) {
    for (const video of customVideos[channel]) {
      try {
        const response = await fetch(video.url);
        const arrayBuffer = await response.arrayBuffer();
        const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(1);

        if (outputWindowRef && !outputWindowRef.closed) {
          outputWindowRef.postMessage({
            type: "video-file",
            channel,
            index: video.index,
            data: arrayBuffer,
            mimeType: video.mimeType,
            fileName: video.fileName,
          }, '*', [arrayBuffer]);
          transferred++;
          console.log(`[Re-sync Transferable] ${video.fileName} -> [${channel}] bank ${video.index + 1} (${sizeMB}MB)`);
        } else if (broadcastChannel) {
          broadcastChannel.postMessage({
            type: "video-file",
            channel,
            index: video.index,
            data: arrayBuffer,
            mimeType: video.mimeType,
            fileName: video.fileName,
          });
          transferred++;
          console.log(`[Re-sync BroadcastChannel] ${video.fileName} -> [${channel}] bank ${video.index + 1} (${sizeMB}MB)`);
        }
      } catch (e) {
        console.warn(`[Re-sync] Failed to transfer ${video.fileName}:`, e);
      }
    }
  }

  console.log(`[Re-sync] Completed: ${transferred}/${totalCount} custom video(s) transferred`);
  return transferred;
}
