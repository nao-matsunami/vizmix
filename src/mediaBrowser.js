/**
 * MediaBrowser - Resolume-style media browser for VizMix
 * Displays video/shader files from selected folder with thumbnails
 * Supports drag & drop to Bank buttons
 */

import { generateVideoThumbnail } from './thumbnail.js';

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

      if (this.viewMode === 'grid') {
        item.innerHTML = `
          <div class="media-thumb"></div>
          <div class="media-name">${this.truncateName(file.name)}</div>
        `;
      } else {
        item.innerHTML = `
          <div class="media-thumb-small"></div>
          <div class="media-info">
            <div class="media-name">${file.name}</div>
            <div class="media-type">${file.type.toUpperCase()}</div>
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

  async generateThumbnails() {
    for (const file of this.files) {
      if (this.thumbnailCache.has(file.name)) continue;
      if (file.type !== 'video') continue;

      try {
        const fileData = await file.handle.getFile();
        const url = URL.createObjectURL(fileData);
        const thumbnail = await generateVideoThumbnail(url);
        URL.revokeObjectURL(url);

        this.thumbnailCache.set(file.name, thumbnail);

        // Update displayed thumbnail
        const index = this.files.indexOf(file);
        const item = this.mediaList.querySelector(`[data-index="${index}"]`);
        if (item) {
          const thumb = item.querySelector('.media-thumb, .media-thumb-small');
          if (thumb) {
            thumb.style.backgroundImage = `url(${thumbnail})`;
          }
        }
      } catch (err) {
        console.warn(`Failed to generate thumbnail for ${file.name}:`, err);
      }
    }
  }

  async handleDragStart(e, file) {
    e.target.classList.add('dragging');

    try {
      const fileData = await file.handle.getFile();

      // Create a DataTransfer with the file
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', file.name);

      // Store file data for drop handling
      e.dataTransfer.items.add(fileData);

      // Set drag image
      const thumb = e.target.querySelector('.media-thumb, .media-thumb-small');
      if (thumb && thumb.style.backgroundImage) {
        const img = new Image();
        img.src = thumb.style.backgroundImage.slice(5, -2);
        e.dataTransfer.setDragImage(img, 30, 20);
      }
    } catch (err) {
      console.error('Drag start failed:', err);
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
