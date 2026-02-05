/**
 * WB VJ - Shader Renderer
 * Renders GLSL shaders to textures for VJ mixing
 */

import * as pc from "playcanvas";

// Shadertoy互換のフラグメントシェーダーラッパー
const WRAPPER_FRAG_PREFIX = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;

varying vec2 vUv;
`;

const WRAPPER_FRAG_SUFFIX = `

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  mainImage(gl_FragColor, fragCoord);
}
`;

const FULLSCREEN_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export class ShaderSource {
  constructor(device) {
    this.device = device;
    this.shader = null;
    this.renderTarget = null;
    this.texture = null;
    this.vertexBuffer = null;
    this.startTime = performance.now() / 1000;
    this.resolution = [1920, 1080];  // デフォルトを16:9に変更
    this.initialized = false;
    this.shaderCode = null;
    this.name = "unnamed"; // シェーダー名（デバッグ用）
    this.renderCount = 0; // レンダリング回数（デバッグ用）
  }

  // 解像度を設定するメソッド
  setResolution(width, height) {
    if (this.resolution[0] === width && this.resolution[1] === height) return;

    this.resolution = [width, height];

    // テクスチャとレンダーターゲットを再作成
    if (this.initialized) {
      if (this.renderTarget) {
        this.renderTarget.destroy();
        this.renderTarget = null;
      }
      if (this.texture) {
        this.texture.destroy();
        this.texture = null;
      }
      this.createRenderTarget();
      console.log(`ShaderSource [${this.name}] resolution updated: ${width}x${height}`);
    }
  }

  async loadFromFile(file) {
    const code = await file.text();
    return this.loadFromCode(code);
  }

  async loadFromUrl(url) {
    const response = await fetch(url);
    const code = await response.text();
    return this.loadFromCode(code);
  }

  loadFromCode(code) {
    // playcanvas_snippet.js形式の場合、const shader = `...`; の中身を抽出
    let shaderCode = code;
    const match = code.match(/const\s+shader\s*=\s*`([\s\S]*?)`;/);
    if (match) {
      shaderCode = match[1];
    }

    this.shaderCode = shaderCode;
    this.createShader(shaderCode);
    this.createRenderTarget();
    this.createVertexBuffer();
    this.initialized = true;
    this.renderCount = 0;

    console.log("ShaderSource initialized");
    return this;
  }

  createShader(fragmentCode) {
    const fullFrag = WRAPPER_FRAG_PREFIX + fragmentCode + WRAPPER_FRAG_SUFFIX;

    const shaderDefinition = {
      attributes: {
        aPosition: pc.SEMANTIC_POSITION,
      },
      vshader: FULLSCREEN_VERT,
      fshader: fullFrag,
    };

    try {
      this.shader = new pc.Shader(this.device, shaderDefinition);
    } catch (e) {
      console.error("Shader compilation failed:", e);
      throw e;
    }
  }

  createRenderTarget() {
    this.texture = new pc.Texture(this.device, {
      name: `shaderOutput-${this.name}`,
      width: this.resolution[0],
      height: this.resolution[1],
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });

    this.renderTarget = new pc.RenderTarget({
      colorBuffer: this.texture,
      depth: false,
    });
    
    console.log(`ShaderSource [${this.name}] renderTarget created: ${this.resolution[0]}x${this.resolution[1]}`);
  }

  createVertexBuffer() {
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    this.vertexBuffer = new pc.VertexBuffer(
      this.device,
      new pc.VertexFormat(this.device, [
        { semantic: pc.SEMANTIC_POSITION, components: 2, type: pc.TYPE_FLOAT32 },
      ]),
      6,
      {
        data: positions,
      }
    );
  }

  render() {
    if (!this.initialized || !this.shader) {
      if (this.renderCount < 5) {
        console.warn(`ShaderSource [${this.name}] render() called but not initialized`);
      }
      return;
    }

    const device = this.device;
    const currentTime = performance.now() / 1000 - this.startTime;

    try {
      // Set render target
      device.setRenderTarget(this.renderTarget);
      device.updateBegin();
      device.clear({
        color: [0, 0, 0, 1],
        flags: pc.CLEARFLAG_COLOR,
      });

      // Set shader and uniforms
      device.setShader(this.shader);
      device.scope.resolve("iTime").setValue(currentTime);
      device.scope.resolve("iResolution").setValue([
        this.resolution[0],
        this.resolution[1],
        1.0,
      ]);
      device.scope.resolve("iMouse").setValue([0, 0, 0, 0]);

      // Draw fullscreen quad
      device.setVertexBuffer(this.vertexBuffer, 0);
      device.draw({
        type: pc.PRIMITIVE_TRIANGLES,
        base: 0,
        count: 6,
      });

      device.updateEnd();
      device.setRenderTarget(null);
      
      // デバッグログ（最初の5フレームだけ）
      if (this.renderCount < 5) {
        console.log(`ShaderSource [${this.name}] rendered frame ${this.renderCount}, texture: ${this.texture?.width}x${this.texture?.height}`);
      }
      this.renderCount++;
    } catch (e) {
      console.error(`ShaderSource [${this.name}] render error:`, e);
    }
  }

  getTexture() {
    return this.texture;
  }

  dispose() {
    console.log(`ShaderSource disposing: ${this.name}`);
    
    if (this.renderTarget) {
      this.renderTarget.destroy();
      this.renderTarget = null;
    }
    if (this.texture) {
      this.texture.destroy();
      this.texture = null;
    }
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }
    if (this.shader) {
      this.shader.destroy();
      this.shader = null;
    }
    
    this.initialized = false;
    this.shaderCode = null;
  }
}
