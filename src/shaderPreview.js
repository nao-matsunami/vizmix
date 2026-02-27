/**
 * ShaderPreviewRenderer - 独立WebGLコンテキストによるシェーダープレビュー
 * メインのPlayCanvasパイプラインとは完全に独立して動作
 */

const VERT_SRC = `attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// ISFシェーダーのGLSL変換（thumbnail.jsのparseISFShaderと同等）
function parseISFShader(source) {
  let glsl = source.replace(/\/\*\{[\s\S]*?\}\*\//m, '').trim();
  glsl = glsl.replace(/\bisf_FragNormCoord\b/g, '(gl_FragCoord.xy / uResolution)');
  glsl = glsl.replace(/\bRENDERSIZE\b/g, 'uResolution');
  glsl = glsl.replace(/\bTIME\b/g, 'uTime');
  return glsl;
}

// Shadertoy互換GLSLのラッパー（iTime→uTime, iResolution→uResolution）
function wrapShadertoyShader(source) {
  let glsl = source;
  glsl = glsl.replace(/\biTime\b/g, 'uTime');
  glsl = glsl.replace(/\biResolution\b/g, 'vec3(uResolution, 1.0)');
  glsl = glsl.replace(/\biMouse\b/g, 'vec4(0.0)');
  return glsl + `
void main() {
  vec4 fragColor;
  mainImage(fragColor, gl_FragCoord.xy);
  gl_FragColor = fragColor;
}`;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export class ShaderPreviewRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: false,
      antialias: false,
    });
    this.program = null;
    this.buffer = null;
    this.uTimeLoc = null;
    this.uResLoc = null;
    this.active = false;

    if (this.gl) {
      // 頂点バッファ（fullscreen quad）は使い回す
      const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      this.buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    }
  }

  setShader(rawSource) {
    const gl = this.gl;
    if (!gl) return false;

    // 既存プログラムを破棄
    this._deleteProgram();

    // ISF判定: /*{ JSON }*/ ヘッダーの有無
    let isfMeta = null;
    const metaMatch = rawSource.match(/\/\*\{([\s\S]*?)\}\*\//m);
    if (metaMatch) {
      try { isfMeta = JSON.parse('{' + metaMatch[1] + '}'); } catch (e) {}
    }
    const isISF = isfMeta !== null;

    // GLSL本体を構築
    let fragBody;
    let inputUniforms = '';

    if (isISF) {
      fragBody = parseISFShader(rawSource);
      // INPUTSのuniform宣言
      if (isfMeta.INPUTS) {
        const typeMap = { float: 'float', bool: 'bool', int: 'int', color: 'vec4', point2D: 'vec2' };
        for (const inp of isfMeta.INPUTS) {
          const t = typeMap[inp.TYPE] || 'float';
          inputUniforms += `uniform ${t} ${inp.NAME};\n`;
        }
      }
    } else {
      fragBody = wrapShadertoyShader(rawSource);
    }

    const fragSrc = `precision highp float;
uniform vec2 uResolution;
uniform float uTime;
${inputUniforms}
${fragBody}`;

    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) {
      if (vert) gl.deleteShader(vert);
      if (frag) gl.deleteShader(frag);
      console.warn('[ShaderPreview] Compile failed');
      this.active = false;
      return false;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[ShaderPreview] Link failed:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      this.active = false;
      return false;
    }

    this.program = program;
    gl.useProgram(program);

    // 頂点属性セットアップ
    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    // uniform locations
    this.uTimeLoc = gl.getUniformLocation(program, 'uTime');
    this.uResLoc = gl.getUniformLocation(program, 'uResolution');

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uResLoc, this.canvas.width, this.canvas.height);

    // ISF INPUTSのDEFAULT値をセット
    if (isISF && isfMeta.INPUTS) {
      for (const inp of isfMeta.INPUTS) {
        if (inp.DEFAULT === undefined) continue;
        const loc = gl.getUniformLocation(program, inp.NAME);
        if (loc === null) continue;
        switch (inp.TYPE) {
          case 'float': gl.uniform1f(loc, inp.DEFAULT); break;
          case 'color': gl.uniform4fv(loc, inp.DEFAULT); break;
          case 'point2D': gl.uniform2fv(loc, inp.DEFAULT); break;
          case 'int': gl.uniform1i(loc, inp.DEFAULT); break;
          case 'bool': gl.uniform1i(loc, inp.DEFAULT ? 1 : 0); break;
        }
      }
    }

    this.active = true;
    return true;
  }

  render(time) {
    if (!this.active || !this.program) return;
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.program);
    gl.uniform1f(this.uTimeLoc, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    this._deleteProgram();
    if (this.buffer) {
      gl.deleteBuffer(this.buffer);
      this.buffer = null;
    }
    this.active = false;
    // WebGLコンテキストを明示的にロスさせる
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }

  _deleteProgram() {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    this.uTimeLoc = null;
    this.uResLoc = null;
    this.active = false;
  }
}
