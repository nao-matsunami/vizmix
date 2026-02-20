/**
 * VizMix - Output Screen (captureStream方式)
 * Control側のPlayCanvasキャンバスをMediaStreamとして受信し<video>で表示。
 * PlayCanvas・VideoManager不要。BroadcastChannelはエフェクト同期のみ使用。
 */

import { initBroadcast } from "./mixer.js";
import { deserializeEffectsState, getEffectParams } from "./effects.js";

const video = document.getElementById('output');

// stream接続済みフラグ（リトライ停止に使用）
let streamConnected = false;

// ─── エフェクト適用 ───────────────────────────────────────────────────────────

function applyEffectsToVideo() {
  const params = getEffectParams();
  const filters = [];

  if (params.invert > 0.5)      filters.push('invert(1)');
  if (params.grayscale > 0)     filters.push(`grayscale(${params.grayscale})`);
  if (params.sepia > 0)         filters.push(`sepia(${params.sepia})`);
  if (params.blur > 0)          filters.push(`blur(${params.blur * 10}px)`);
  if (params.brightness !== 0)  filters.push(`brightness(${1 + params.brightness})`);
  if (params.contrast !== 0)    filters.push(`contrast(${1 + params.contrast})`);

  video.style.filter = filters.length > 0 ? filters.join(' ') : 'none';
}

// ─── Control → Output postMessage 受信 ───────────────────────────────────────

window.addEventListener('message', (e) => {
  if (e.data?.type === 'stream-connected') {
    streamConnected = true;
    console.log('VizMix Output: stream connected');
  }
});

// ─── BroadcastChannel メッセージ処理 ─────────────────────────────────────────

function handleMessage(data) {
  if (data.type === 'effects') {
    if (data.effects) {
      deserializeEffectsState(data.effects);
      applyEffectsToVideo();
    }
  } else if (data.type === 'reset') {
    console.log('Output: Received reset, reloading...');
    location.reload();
  }
  // video-file / shader-file / bank-switch / state は captureStream方式では不要
}

// ─── フルスクリーン ───────────────────────────────────────────────────────────

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// ─── output-ready リトライ送信 ────────────────────────────────────────────────
// Controlのリロード中に output-ready が届かない場合に備えて、
// stream-connected を受信するまで 500ms おきに再送する（最大20回 = 10秒）

function sendReadyUntilConnected(attempts = 0) {
  if (streamConnected) return;
  if (!window.opener) return;
  if (attempts >= 20) {
    console.warn('VizMix Output: stream接続待ちタイムアウト (10s)');
    return;
  }

  window.opener.postMessage({ type: 'output-ready' }, '*');
  console.log(`VizMix Output: output-ready 送信 (試行 ${attempts + 1}/20)`);
  setTimeout(() => sendReadyUntilConnected(attempts + 1), 500);
}

// ─── 初期化 ───────────────────────────────────────────────────────────────────

function init() {
  initBroadcast(handleMessage);

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f') toggleFullscreen();
  });
  document.addEventListener('dblclick', toggleFullscreen);

  if (window.opener) {
    sendReadyUntilConnected();
  } else {
    console.warn('VizMix Output: no opener (直接アクセス) - stream接続不可');
  }

  console.log('VizMix Output initialized (captureStream mode)');
}

init();
