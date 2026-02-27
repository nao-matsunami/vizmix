/**
 * VizMix - Effects Manager
 * v0.7.0
 */

// エフェクト状態
export const effectsState = {
  invert: { enabled: false },
  grayscale: { enabled: false, amount: 0 },   // 0-100
  sepia: { enabled: false, amount: 0 },       // 0-100
  blur: { amount: 0 },                         // 0-100
  brightness: { amount: 0 },                   // -100 to +100
  contrast: { amount: 0 },                     // -100 to +100
  glitch: { amount: 0 },                       // 0-100
  rgbShift: { amount: 0 },                     // 0-100
  rgbMultiply: { amount: 0, color: '#FF0000' }, // 0-100, hex color
};

// トグル（Invert）
export function toggleInvert() {
  effectsState.invert.enabled = !effectsState.invert.enabled;
  return effectsState.invert.enabled;
}

// トグル（Grayscale）- ONにすると amount を 100 に
export function toggleGrayscale() {
  effectsState.grayscale.enabled = !effectsState.grayscale.enabled;
  if (effectsState.grayscale.enabled && effectsState.grayscale.amount === 0) {
    effectsState.grayscale.amount = 100;
  }
  return effectsState.grayscale.enabled;
}

// トグル（Sepia）- ONにすると amount を 100 に
export function toggleSepia() {
  effectsState.sepia.enabled = !effectsState.sepia.enabled;
  if (effectsState.sepia.enabled && effectsState.sepia.amount === 0) {
    effectsState.sepia.amount = 100;
  }
  return effectsState.sepia.enabled;
}

// スライダー設定
export function setGrayscaleAmount(value) {
  effectsState.grayscale.amount = Math.max(0, Math.min(100, value));
  return effectsState.grayscale.amount;
}

export function setSepiaAmount(value) {
  effectsState.sepia.amount = Math.max(0, Math.min(100, value));
  return effectsState.sepia.amount;
}

export function setBlurAmount(value) {
  effectsState.blur.amount = Math.max(0, Math.min(100, value));
  return effectsState.blur.amount;
}

export function setBrightnessAmount(value) {
  effectsState.brightness.amount = Math.max(-100, Math.min(100, value));
  return effectsState.brightness.amount;
}

export function setContrastAmount(value) {
  effectsState.contrast.amount = Math.max(-100, Math.min(100, value));
  return effectsState.contrast.amount;
}

export function setGlitchAmount(value) {
  effectsState.glitch.amount = Math.max(0, Math.min(100, value));
  return effectsState.glitch.amount;
}

export function setRgbShiftAmount(value) {
  effectsState.rgbShift.amount = Math.max(0, Math.min(100, value));
  return effectsState.rgbShift.amount;
}

export function setRgbMultiplyAmount(value) {
  effectsState.rgbMultiply.amount = Math.max(0, Math.min(100, value));
  return effectsState.rgbMultiply.amount;
}

export function setRgbMultiplyColor(color) {
  effectsState.rgbMultiply.color = color;
  return effectsState.rgbMultiply.color;
}

// リセット
export function resetEffect(effectName) {
  switch (effectName) {
    case 'invert':
      effectsState.invert.enabled = false;
      break;
    case 'grayscale':
      effectsState.grayscale.enabled = false;
      effectsState.grayscale.amount = 0;
      break;
    case 'sepia':
      effectsState.sepia.enabled = false;
      effectsState.sepia.amount = 0;
      break;
    case 'blur':
      effectsState.blur.amount = 0;
      break;
    case 'brightness':
      effectsState.brightness.amount = 0;
      break;
    case 'contrast':
      effectsState.contrast.amount = 0;
      break;
    case 'glitch':
      effectsState.glitch.amount = 0;
      break;
    case 'rgbShift':
      effectsState.rgbShift.amount = 0;
      break;
    case 'rgbMultiply':
      effectsState.rgbMultiply.amount = 0;
      effectsState.rgbMultiply.color = '#FF0000';
      break;
  }
}

export function resetAllEffects() {
  effectsState.invert.enabled = false;
  effectsState.grayscale.enabled = false;
  effectsState.grayscale.amount = 0;
  effectsState.sepia.enabled = false;
  effectsState.sepia.amount = 0;
  effectsState.blur.amount = 0;
  effectsState.brightness.amount = 0;
  effectsState.contrast.amount = 0;
  effectsState.glitch.amount = 0;
  effectsState.rgbShift.amount = 0;
  effectsState.rgbMultiply.amount = 0;
  effectsState.rgbMultiply.color = '#FF0000';
}

// エフェクトパラメータをシェーダー用に取得
export function getEffectParams() {
  return {
    invert: effectsState.invert.enabled ? 1.0 : 0.0,
    grayscale: effectsState.grayscale.enabled ? effectsState.grayscale.amount / 100 : 0.0,
    sepia: effectsState.sepia.enabled ? effectsState.sepia.amount / 100 : 0.0,
    blur: effectsState.blur.amount / 100,
    brightness: effectsState.brightness.amount / 100,
    contrast: effectsState.contrast.amount / 100,
    glitch: effectsState.glitch.amount / 100,
    rgbShift: effectsState.rgbShift.amount / 100,
    rgbMultiply: effectsState.rgbMultiply.amount / 100,
    rgbMultiplyColor: effectsState.rgbMultiply.color,
  };
}

// BroadcastChannel用にシリアライズ
export function serializeEffectsState() {
  return { ...effectsState };
}

// Output Window用にデシリアライズ
export function deserializeEffectsState(data) {
  if (data.invert !== undefined) effectsState.invert = data.invert;
  if (data.grayscale !== undefined) effectsState.grayscale = data.grayscale;
  if (data.sepia !== undefined) effectsState.sepia = data.sepia;
  if (data.blur !== undefined) effectsState.blur = data.blur;
  if (data.brightness !== undefined) effectsState.brightness = data.brightness;
  if (data.contrast !== undefined) effectsState.contrast = data.contrast;
}
