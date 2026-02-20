/**
 * VizMix - Version Information
 */

export const APP_NAME = "VizMix";
export const APP_VERSION = "0.8.1";
export const APP_TAGLINE = "Browser-based VJ Software";
export const APP_FULL_NAME = `${APP_NAME} v${APP_VERSION}`;

export const VERSION_HISTORY = {
  "0.1.0": "Basic features (A/B channels, crossfade, bank switching, GLSL support)",
  "0.2.0": "BPM features (tap tempo, auto-switch, beat indicators)",
  "0.3.0": "Thumbnail display, settings save/restore",
  "0.4.0": "Keyboard shortcuts",
  "0.5.0": "MIDI controller support",
  "0.5.1": "Bug fixes (Output Window sync, default thumbnails, manual icon)",
  "0.6.0": "Effects (Invert, Grayscale, Sepia, Blur, Brightness, Contrast)",
  "0.7.0": "Media Browser (folder selection, thumbnail grid/list, drag & drop)",
  "0.8.0": "Webcam input (multi-camera, per-channel Media/Cam switch)",
  "0.8.1": "Output captureStream architecture, resolution selector, 4K block, sync fixes",
};

export function printVersion() {
  console.log(`%c${APP_FULL_NAME}`, 'color: #00ff88; font-size: 16px; font-weight: bold;');
  console.log('%cBrowser-based VJ Software', 'color: #888; font-size: 12px;');
}

export function getVersionInfo() {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    fullName: APP_FULL_NAME,
    history: VERSION_HISTORY,
  };
}
