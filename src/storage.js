/**
 * VizMix - Storage Manager
 * v0.3.0
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
