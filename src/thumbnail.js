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
 * ISFシェーダーのGLSLソースを変換（ISF固有変数を置換）
 */
function parseISFShader(source) {
  let glsl = source.replace(/\/\*\{[\s\S]*?\}\*\//m, '').trim();
  glsl = glsl.replace(/\bisf_FragNormCoord\b/g, '(gl_FragCoord.xy / uResolution)');
  glsl = glsl.replace(/\bRENDERSIZE\b/g, 'uResolution');
  glsl = glsl.replace(/\bTIME\b/g, 'uTime');
  return glsl;
}

function compileGLShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

/**
 * ISFシェーダーからサムネールを生成（512x512レンダリング→128x128縮小）
 * @param {string} shaderSource - ISFシェーダーのソースコード
 * @returns {Promise<string>} - Base64 データURL
 */
export async function generateISFThumbnail(shaderSource) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL not available');

  // ISFヘッダーからINPUTSを取得
  let isfMeta = null;
  const metaMatch = shaderSource.match(/\/\*\{([\s\S]*?)\}\*\//m);
  if (metaMatch) {
    try { isfMeta = JSON.parse('{' + metaMatch[1] + '}'); } catch(e) {}
  }

  const glslBody = parseISFShader(shaderSource);

  // INPUTSのuniform宣言を生成
  let inputUniforms = '';
  if (isfMeta && isfMeta.INPUTS) {
    const typeMap = { float:'float', bool:'bool', int:'int', color:'vec4', point2D:'vec2' };
    for (const inp of isfMeta.INPUTS) {
      const t = typeMap[inp.TYPE] || 'float';
      inputUniforms += `uniform ${t} ${inp.NAME};\n`;
    }
  }

  const vertSrc = `attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const fragSrc = `precision highp float;
uniform vec2 uResolution;
uniform float uTime;
${inputUniforms}
${glslBody}`;

  const vert = compileGLShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileGLShader(gl, gl.FRAGMENT_SHADER, fragSrc);

  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    throw new Error(`Program link error: ${info}`);
  }

  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  gl.useProgram(program);
  const aPosLoc = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, 512, 512);
  gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), 512, 512);

  // INPUTSのDEFAULT値をセット
  if (isfMeta && isfMeta.INPUTS) {
    for (const inp of isfMeta.INPUTS) {
      const loc = gl.getUniformLocation(program, inp.NAME);
      if (loc === null) continue;
      switch(inp.TYPE) {
        case 'float': gl.uniform1f(loc, inp.DEFAULT); break;
        case 'color': case 'vec4': gl.uniform4fv(loc, inp.DEFAULT); break;
        case 'vec2': case 'point2D': gl.uniform2fv(loc, inp.DEFAULT); break;
        case 'int': gl.uniform1i(loc, inp.DEFAULT); break;
        case 'bool': gl.uniform1i(loc, inp.DEFAULT ? 1 : 0); break;
      }
    }
  }

  // 最も明るいフレームを自動選択
  const testTimes = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 8.0, 10.0];
  let bestTime = 1.0, bestBrightness = -1;
  const px = new Uint8Array(512 * 512 * 4);
  const uTimeLoc = gl.getUniformLocation(program, 'uTime');
  for (const t of testTimes) {
    gl.uniform1f(uTimeLoc, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let b = 0;
    for (let i = 0; i < px.length; i += 4) b += px[i] + px[i+1] + px[i+2];
    if (b > bestBrightness) { bestBrightness = b; bestTime = t; }
  }
  gl.uniform1f(uTimeLoc, bestTime);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 128;
  thumbCanvas.height = 128;
  thumbCanvas.getContext('2d').drawImage(canvas, 0, 0, 128, 128);

  gl.deleteProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  gl.deleteBuffer(buf);

  return thumbCanvas.toDataURL('image/jpeg', 0.8);
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
