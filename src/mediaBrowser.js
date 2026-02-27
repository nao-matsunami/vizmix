/**
 * MediaBrowser - Resolume-style media browser for VizMix
 * Displays video/shader files from selected folder with thumbnails
 * Supports drag & drop to Bank buttons
 */

import { generateVideoThumbnail, generateISFThumbnail } from './thumbnail.js';

const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];
const SUPPORTED_SHADER_EXTENSIONS = ['.glsl', '.frag', '.fs'];

export class MediaBrowser {
  constructor(channel, container) {
    this.channel = channel; // 'A' or 'B'
    this.container = container;
    this.currentDirHandle = null;
    this.files = [];
    this.viewMode = 'grid'; // 'grid' | 'list'
    this.thumbnailCache = new Map();
    this.fileCache = new Map(); // Cache File objects for drag & drop
    this.blobUrlCache = new Map(); // Cache Blob URLs for drag & drop
    this.pngHandles = new Map(); // Cache PNG sidecar handles (lowercase name → handle)

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();

    // Check File System Access API support
    if (!('showDirectoryPicker' in window)) {
      this.showUnsupportedMessage();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="media-browser-header">
        <span class="media-browser-title">Files</span>
        <button class="folder-select-btn" title="Select Folder">
          <span class="folder-icon">&#128193;</span>
        </button>
      </div>
      <div class="media-browser-toolbar">
        <select class="folder-dropdown">
          <option value="">-- Select Folder --</option>
        </select>
        <div class="view-toggle">
          <button class="view-btn active" data-view="grid" title="Grid View">&#9638;</button>
          <button class="view-btn" data-view="list" title="List View">&#9776;</button>
        </div>
      </div>
      <div class="media-list grid-view"></div>
      <div class="media-status"></div>
    `;

    this.folderBtn = this.container.querySelector('.folder-select-btn');
    this.folderDropdown = this.container.querySelector('.folder-dropdown');
    this.viewBtns = this.container.querySelectorAll('.view-btn');
    this.mediaList = this.container.querySelector('.media-list');
    this.statusEl = this.container.querySelector('.media-status');
  }

  bindEvents() {
    // Folder select button
    this.folderBtn.addEventListener('click', () => this.selectFolder());

    // Folder dropdown change
    this.folderDropdown.addEventListener('change', (e) => {
      if (e.target.value === 'select-new') {
        this.selectFolder();
      }
    });

    // View toggle
    this.viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.dataset.view;
        this.updateViewMode();
      });
    });
  }

  showUnsupportedMessage() {
    this.folderBtn.disabled = true;
    this.statusEl.textContent = 'Folder access not supported in this browser';
    this.statusEl.classList.add('error');
  }

  async selectFolder() {
    try {
      const dirHandle = await window.showDirectoryPicker();
      this.currentDirHandle = dirHandle;

      // Update dropdown
      const option = document.createElement('option');
      option.value = dirHandle.name;
      option.textContent = dirHandle.name;
      option.selected = true;

      // Remove duplicate if exists
      const existing = Array.from(this.folderDropdown.options).find(
        opt => opt.value === dirHandle.name
      );
      if (!existing) {
        this.folderDropdown.insertBefore(option, this.folderDropdown.lastChild);
      } else {
        existing.selected = true;
      }

      await this.loadFiles();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Folder selection failed:', err);
        this.statusEl.textContent = 'Failed to open folder';
      }
    }
  }

  async loadFiles() {
    if (!this.currentDirHandle) return;

    this.files = [];
    this.pngHandles = new Map();
    this.mediaList.innerHTML = '<div class="loading">Loading...</div>';

    try {
      for await (const entry of this.currentDirHandle.values()) {
        if (entry.kind !== 'file') continue;

        const name = entry.name.toLowerCase();
        const isVideo = SUPPORTED_VIDEO_EXTENSIONS.some(ext => name.endsWith(ext));
        const isShader = SUPPORTED_SHADER_EXTENSIONS.some(ext => name.endsWith(ext));

        if (isVideo || isShader) {
          this.files.push({
            handle: entry,
            name: entry.name,
            type: isVideo ? 'video' : 'shader'
          });
        } else if (name.endsWith('.png')) {
          this.pngHandles.set(name, entry);
        }
      }

      // Sort by name
      this.files.sort((a, b) => a.name.localeCompare(b.name));

      this.statusEl.textContent = `${this.files.length} files`;
      this.renderFileList();
      this.generateThumbnails();
    } catch (err) {
      console.error('Failed to load files:', err);
      this.statusEl.textContent = 'Failed to load files';
      this.mediaList.innerHTML = '';
    }
  }

  formatResolution(file) {
    if (!file.width || !file.height) return '';
    const is4K = file.width > 1920 || file.height > 1080;
    const label = `${file.width}x${file.height}`;
    const cls = is4K ? 'media-resolution is-4k' : 'media-resolution';
    return `<span class="${cls}">${label}</span>`;
  }

  renderFileList() {
    this.mediaList.innerHTML = '';

    if (this.files.length === 0) {
      this.mediaList.innerHTML = '<div class="no-files">No media files found</div>';
      return;
    }

    this.files.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = `media-item ${file.type}`;
      item.dataset.index = index;
      item.draggable = true;

      const resInfo = this.formatResolution(file);

      if (this.viewMode === 'grid') {
        item.innerHTML = `
          <div class="media-thumb"></div>
          ${resInfo}
          <div class="media-name">${this.truncateName(file.name)}</div>
        `;
      } else {
        item.innerHTML = `
          <div class="media-thumb-small"></div>
          <div class="media-info">
            <div class="media-name">${file.name}</div>
            <div class="media-type">${file.type.toUpperCase()} ${resInfo}</div>
          </div>
        `;
      }

      // Apply cached thumbnail
      const cached = this.thumbnailCache.get(file.name);
      if (cached) {
        const thumb = item.querySelector('.media-thumb, .media-thumb-small');
        thumb.style.backgroundImage = `url(${cached})`;
      }

      // Drag events
      item.addEventListener('dragstart', (e) => this.handleDragStart(e, file));
      item.addEventListener('dragend', (e) => this.handleDragEnd(e));

      this.mediaList.appendChild(item);
    });
  }

  truncateName(name) {
    const maxLen = 12;
    if (name.length <= maxLen) return name;
    const ext = name.slice(name.lastIndexOf('.'));
    const base = name.slice(0, name.lastIndexOf('.'));
    return base.slice(0, maxLen - ext.length - 2) + '..' + ext;
  }

  updateViewMode() {
    this.mediaList.classList.toggle('grid-view', this.viewMode === 'grid');
    this.mediaList.classList.toggle('list-view', this.viewMode === 'list');
    this.renderFileList();
  }

  async probeVideoResolution(blobUrl) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
        video.src = '';
        video.remove();
      };
      video.onerror = () => {
        resolve(null);
        video.remove();
      };
      video.src = blobUrl;
    });
  }

  async generateThumbnails() {
    for (const file of this.files) {
      if (this.blobUrlCache.has(file.name)) continue;

      try {
        // Cache the File object and create Blob URL for drag & drop
        const fileData = await file.handle.getFile();
        this.fileCache.set(file.name, fileData);

        // Create and cache Blob URL (keep it for drag & drop)
        const blobUrl = URL.createObjectURL(fileData);
        this.blobUrlCache.set(file.name, blobUrl);
        console.log(`[MediaBrowser ${this.channel}] Cached: ${file.name} -> ${blobUrl}`);

        if (file.type !== 'video') {
          if (file.name.toLowerCase().endsWith('.fs')) {
            await this.generateISFThumb(file, fileData);
          }
          continue;
        }

        // Probe video resolution
        const resolution = await this.probeVideoResolution(blobUrl);
        if (resolution) {
          file.width = resolution.width;
          file.height = resolution.height;
          const is4K = resolution.width > 1920 || resolution.height > 1080;
          if (is4K) {
            console.warn(`[MediaBrowser ${this.channel}] 4K video detected: ${file.name} (${resolution.width}x${resolution.height})`);
          }
        }

        // Generate thumbnail (use same blob URL)
        const thumbnail = await generateVideoThumbnail(blobUrl);
        this.thumbnailCache.set(file.name, thumbnail);

        // Update displayed thumbnail and resolution
        const index = this.files.indexOf(file);
        const item = this.mediaList.querySelector(`[data-index="${index}"]`);
        if (item) {
          const thumb = item.querySelector('.media-thumb, .media-thumb-small');
          if (thumb) {
            thumb.style.backgroundImage = `url(${thumbnail})`;
          }
          // Update resolution display
          const existingRes = item.querySelector('.media-resolution');
          if (!existingRes && resolution) {
            const resEl = document.createElement('span');
            const is4K = resolution.width > 1920 || resolution.height > 1080;
            resEl.className = `media-resolution${is4K ? ' is-4k' : ''}`;
            resEl.textContent = `${resolution.width}x${resolution.height}`;
            if (this.viewMode === 'grid') {
              item.insertBefore(resEl, item.querySelector('.media-name'));
            } else {
              const typeEl = item.querySelector('.media-type');
              if (typeEl) typeEl.appendChild(document.createTextNode(' ')), typeEl.appendChild(resEl);
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to generate thumbnail for ${file.name}:`, err);
      }
    }
  }

  async generateISFThumb(file, fileData) {
    // サイドカーPNG（同名.png）を優先、なければWebGLで動的生成
    const baseName = file.name.slice(0, file.name.lastIndexOf('.')).toLowerCase();
    const pngHandle = this.pngHandles.get(baseName + '.png');

    let thumbnail;
    if (pngHandle) {
      const pngFile = await pngHandle.getFile();
      thumbnail = URL.createObjectURL(pngFile);
      console.log(`[MediaBrowser ${this.channel}] ISF sidecar PNG: ${file.name}`);
    } else {
      const shaderSource = await fileData.text();
      thumbnail = await generateISFThumbnail(shaderSource);
      console.log(`[MediaBrowser ${this.channel}] ISF dynamic thumb: ${file.name}`);
    }

    this.thumbnailCache.set(file.name, thumbnail);
    const index = this.files.indexOf(file);
    const item = this.mediaList.querySelector(`[data-index="${index}"]`);
    if (item) {
      const thumb = item.querySelector('.media-thumb, .media-thumb-small');
      if (thumb) thumb.style.backgroundImage = `url(${thumbnail})`;
    }
  }

  handleDragStart(e, file) {
    console.log(`[MediaBrowser ${this.channel}] dragstart: ${file.name}`);
    e.target.classList.add('dragging');

    // Get cached blob URL
    const blobUrl = this.blobUrlCache.get(file.name);
    const fileData = this.fileCache.get(file.name);
    if (!blobUrl || !fileData) {
      console.warn(`[MediaBrowser ${this.channel}] File not cached yet: ${file.name}`);
      e.preventDefault();
      return;
    }

    // Set up DataTransfer with custom data type
    e.dataTransfer.effectAllowed = 'copy';

    // Use custom MIME type for VizMix media browser
    const mediaData = JSON.stringify({
      name: file.name,
      type: fileData.type || (file.type === 'video' ? 'video/mp4' : 'text/plain'),
      mediaType: file.type, // 'video' or 'shader'
      blobUrl: blobUrl
    });
    e.dataTransfer.setData('application/vizmix-media', mediaData);
    e.dataTransfer.setData('text/plain', file.name);
    console.log(`[MediaBrowser ${this.channel}] setData: ${mediaData}`);

    // Set drag image
    const thumb = e.target.querySelector('.media-thumb, .media-thumb-small');
    if (thumb && thumb.style.backgroundImage) {
      const img = new Image();
      img.src = thumb.style.backgroundImage.slice(5, -2);
      e.dataTransfer.setDragImage(img, 30, 20);
    }
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
  }
}

/**
 * Initialize media browsers for both channels
 */
export function initMediaBrowsers() {
  const containerA = document.getElementById('mediaBrowserA');
  const containerB = document.getElementById('mediaBrowserB');

  const browsers = {};

  if (containerA) {
    browsers.A = new MediaBrowser('A', containerA);
  }
  if (containerB) {
    browsers.B = new MediaBrowser('B', containerB);
  }

  return browsers;
}
