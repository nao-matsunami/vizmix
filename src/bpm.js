/**
 * WB VJ - BPM Management Module
 * VizMix v0.2.0
 */

// BPM状態
export const bpmState = {
  bpm: 120,
  isPlaying: true,
  beatCount: 0,        // 0-3 (4拍)
  lastBeatTime: 0,
  autoSwitch: false,
  switchInterval: 4,   // 何拍ごとに切替 (1/2/4/8/16)
};

// Tap tempo用
const tapTimes = [];
const MAX_TAP_SAMPLES = 6;
const TAP_TIMEOUT = 2000; // 2秒以上間隔が空いたらリセット

// コールバック
let onBeatCallback = null;
let onSwitchCallback = null;

// ループ制御
let animationId = null;
let beatsSinceSwitch = 0;

/**
 * BPMを設定 (40-200の範囲)
 */
export function setBPM(value) {
  const newBpm = Math.max(40, Math.min(200, Math.round(value)));
  if (bpmState.bpm !== newBpm) {
    bpmState.bpm = newBpm;
    console.log(`BPM set to ${newBpm}`);
  }
  return bpmState.bpm;
}

/**
 * Tap tempo
 */
export function tap() {
  const now = performance.now();

  // 前回のタップから2秒以上経過していたらリセット
  if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT) {
    tapTimes.length = 0;
  }

  // 極端に短い間隔（100ms未満 = 600BPM以上）は無視（二重タップ防止）
  if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] < 100) {
    return bpmState.bpm;
  }

  tapTimes.push(now);

  // 最大サンプル数を超えたら古いものを削除
  if (tapTimes.length > MAX_TAP_SAMPLES) {
    tapTimes.shift();
  }

  // 2回以上タップしたらBPMを計算
  if (tapTimes.length >= 2) {
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) {
      const interval = tapTimes[i] - tapTimes[i - 1];
      // 150ms-2000ms の範囲のみ使用（30-400 BPM相当）
      if (interval >= 150 && interval <= 2000) {
        intervals.push(interval);
      }
    }

    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      let newBpm = Math.round(60000 / avgInterval);
      // 範囲制限 40-200
      newBpm = Math.max(40, Math.min(200, newBpm));
      bpmState.bpm = newBpm;
    }
  }

  return bpmState.bpm;
}

/**
 * Tap tempoをリセット
 */
export function resetTap() {
  tapTimes.length = 0;
}

/**
 * 再生/停止
 */
export function togglePlay() {
  bpmState.isPlaying = !bpmState.isPlaying;
  if (bpmState.isPlaying) {
    bpmState.lastBeatTime = performance.now();
  }
  return bpmState.isPlaying;
}

/**
 * Auto switchを設定
 */
export function setAutoSwitch(enabled) {
  bpmState.autoSwitch = enabled;
  beatsSinceSwitch = 0;
  return bpmState.autoSwitch;
}

/**
 * Switch intervalを設定 (1/2/4/8/16拍)
 */
export function setSwitchInterval(beats) {
  const validIntervals = [1, 2, 4, 8, 16];
  if (validIntervals.includes(beats)) {
    bpmState.switchInterval = beats;
    beatsSinceSwitch = 0;
    console.log(`Switch interval set to ${beats} beats`);
  }
  return bpmState.switchInterval;
}

/**
 * ビートループを開始
 */
export function startBeatLoop(onBeat, onSwitch) {
  onBeatCallback = onBeat;
  onSwitchCallback = onSwitch;
  bpmState.lastBeatTime = performance.now();

  function loop() {
    if (!bpmState.isPlaying) {
      animationId = requestAnimationFrame(loop);
      return;
    }

    const now = performance.now();
    const beatInterval = 60000 / bpmState.bpm; // 1拍の長さ(ms)

    // ビートが進んだかチェック
    if (now - bpmState.lastBeatTime >= beatInterval) {
      bpmState.lastBeatTime = now;
      bpmState.beatCount = (bpmState.beatCount + 1) % 4;
      beatsSinceSwitch++;

      // ビートコールバック
      if (onBeatCallback) {
        onBeatCallback(bpmState.beatCount);
      }

      // Auto switch判定
      if (bpmState.autoSwitch && beatsSinceSwitch >= bpmState.switchInterval) {
        beatsSinceSwitch = 0;
        if (onSwitchCallback) {
          onSwitchCallback();
        }
      }
    }

    animationId = requestAnimationFrame(loop);
  }

  loop();
}

/**
 * ビートループを停止
 */
export function stopBeatLoop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/**
 * 現在のビート進行度を取得 (0.0-1.0)
 */
export function getBeatProgress() {
  if (!bpmState.isPlaying) return 0;

  const now = performance.now();
  const beatInterval = 60000 / bpmState.bpm;
  const elapsed = now - bpmState.lastBeatTime;
  return Math.min(1, elapsed / beatInterval);
}

/**
 * 状態をシリアライズ (BroadcastChannel用)
 */
export function serializeBpmState() {
  return {
    bpm: bpmState.bpm,
    isPlaying: bpmState.isPlaying,
    beatCount: bpmState.beatCount,
    autoSwitch: bpmState.autoSwitch,
    switchInterval: bpmState.switchInterval,
  };
}

/**
 * 状態を復元 (Output Window用)
 */
export function deserializeBpmState(data) {
  if (data.bpm !== undefined) bpmState.bpm = data.bpm;
  if (data.isPlaying !== undefined) bpmState.isPlaying = data.isPlaying;
  if (data.beatCount !== undefined) bpmState.beatCount = data.beatCount;
  if (data.autoSwitch !== undefined) bpmState.autoSwitch = data.autoSwitch;
  if (data.switchInterval !== undefined) bpmState.switchInterval = data.switchInterval;
}
