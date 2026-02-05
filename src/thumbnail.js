/**
 * VizMix - Thumbnail Generator
 * v0.3.0
 */

/**
 * 動画からサムネールを生成
 * @param {string} videoUrl - 動画のURL
 * @returns {Promise<string>} - Base64 データURL
 */
export async function generateVideoThumbnail(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 72;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      video.remove();
      resolve(dataUrl);
    };

    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = videoUrl;
  });
}

/**
 * シェーダーからサムネールを生成
 * shaderRendererのrenderTargetからピクセルを読み取る
 */
export function generateShaderThumbnail(gl, renderTarget, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');

  // WebGLからピクセルを読み取り
  const pixels = new Uint8Array(width * height * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // ImageDataに変換（上下反転）
  const imageData = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = pixels[srcIdx];
      imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
      imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
      imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  // リサイズして描画
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0, 128, 72);

  return canvas.toDataURL('image/jpeg', 0.7);
}

/**
 * バンクボタンにサムネールを設定
 */
export function setButtonThumbnail(button, thumbnailDataUrl) {
  if (thumbnailDataUrl) {
    button.style.backgroundImage = `url(${thumbnailDataUrl})`;
    button.style.backgroundSize = 'cover';
    button.style.backgroundPosition = 'center';
    button.classList.add('has-thumbnail');
  } else {
    button.style.backgroundImage = '';
    button.classList.remove('has-thumbnail');
  }
}
