/**
 * VizMix - Webcam Manager
 * v0.8.0
 */

export class WebcamManager {
  constructor() {
    this.streams = { A: null, B: null };
    this.videos = { A: null, B: null };
    this.devices = [];
    this.activeDevices = { A: null, B: null };
    this.onDevicesUpdated = null;
  }

  /**
   * Initialize webcam manager and enumerate devices
   */
  async init() {
    // Create video elements for each channel
    this.videos.A = this.createVideoElement('webcam-video-A');
    this.videos.B = this.createVideoElement('webcam-video-B');

    // Get initial device list
    await this.updateDeviceList();

    // Listen for device changes (camera plugged/unplugged)
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      console.log('[Webcam] Device change detected');
      await this.updateDeviceList();
      if (this.onDevicesUpdated) {
        this.onDevicesUpdated(this.devices);
      }
    });

    console.log('[Webcam] Manager initialized');
    return this.devices;
  }

  /**
   * Create a video element for webcam stream
   */
  createVideoElement(id) {
    const video = document.createElement('video');
    video.id = id;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);
    return video;
  }

  /**
   * Update the list of available video input devices
   */
  async updateDeviceList() {
    try {
      // Request permission first to get device labels
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        // Permission denied or no camera - continue with limited info
        console.warn('[Webcam] Could not get permission for device labels');
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      this.devices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          groupId: device.groupId
        }));

      console.log('[Webcam] Available cameras:', this.devices);
      return this.devices;
    } catch (err) {
      console.error('[Webcam] Failed to enumerate devices:', err);
      return [];
    }
  }

  /**
   * Start webcam for a channel
   * @param {string} channel - 'A' or 'B'
   * @param {string} deviceId - Camera device ID (optional, uses default if not specified)
   */
  async start(channel, deviceId = null) {
    // Stop existing stream for this channel
    this.stop(channel);

    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      }

      console.log(`[Webcam] Starting camera for channel ${channel}:`, deviceId || 'default');

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.streams[channel] = stream;
      this.activeDevices[channel] = deviceId || stream.getVideoTracks()[0].getSettings().deviceId;

      const video = this.videos[channel];
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      console.log(`[Webcam] Channel ${channel} started: ${settings.width}x${settings.height} @ ${track.label}`);

      return {
        success: true,
        video: video,
        width: settings.width,
        height: settings.height,
        label: track.label
      };
    } catch (err) {
      console.error(`[Webcam] Failed to start camera for channel ${channel}:`, err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Stop webcam for a channel
   * @param {string} channel - 'A' or 'B'
   */
  stop(channel) {
    if (this.streams[channel]) {
      this.streams[channel].getTracks().forEach(track => track.stop());
      this.streams[channel] = null;
      this.activeDevices[channel] = null;

      const video = this.videos[channel];
      video.srcObject = null;

      console.log(`[Webcam] Channel ${channel} stopped`);
    }
  }

  /**
   * Get video element for a channel
   * @param {string} channel - 'A' or 'B'
   */
  getVideo(channel) {
    return this.videos[channel];
  }

  /**
   * Check if webcam is active for a channel
   * @param {string} channel - 'A' or 'B'
   */
  isActive(channel) {
    return this.streams[channel] !== null;
  }

  /**
   * Get current device ID for a channel
   * @param {string} channel - 'A' or 'B'
   */
  getActiveDevice(channel) {
    return this.activeDevices[channel];
  }

  /**
   * Check if getUserMedia is supported
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Check if running in secure context (HTTPS or localhost)
   */
  static isSecureContext() {
    return window.isSecureContext;
  }
}

// Singleton instance
let webcamManagerInstance = null;

export function getWebcamManager() {
  if (!webcamManagerInstance) {
    webcamManagerInstance = new WebcamManager();
  }
  return webcamManagerInstance;
}

export async function initWebcam() {
  if (!WebcamManager.isSupported()) {
    console.warn('[Webcam] getUserMedia not supported');
    return null;
  }

  if (!WebcamManager.isSecureContext()) {
    console.warn('[Webcam] Not in secure context (HTTPS or localhost required)');
    return null;
  }

  const manager = getWebcamManager();
  await manager.init();
  return manager;
}
