/**
 * WB VJ - Mixer Core
 * VizMix v0.6.0
 */

import { getAllShaderInfo } from "./videoManager.js";
import { bpmState, serializeBpmState } from "./bpm.js";
import { serializeEffectsState } from "./effects.js";

export const state = {
  crossfade: 0.5,
  channelA: { source: null, videoIndex: 0, shaderIndex: 0 },
  channelB: { source: null, videoIndex: 0, shaderIndex: 0 },
};

const CHANNEL_NAME = "wb-vj-sync";
let broadcastChannel = null;

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

export function broadcastVideoFile(channel, index, arrayBuffer, mimeType, fileName) {
  if (broadcastChannel) {
    const uint8Array = new Uint8Array(arrayBuffer);
    broadcastChannel.postMessage({
      type: "video-file",
      channel: channel,
      index: index,
      data: Array.from(uint8Array),
      mimeType: mimeType,
      fileName: fileName,
    });
    console.log(`Broadcast video file: ${fileName} to [${channel}] bank ${index + 1}`);
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
