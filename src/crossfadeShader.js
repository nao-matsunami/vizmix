/**
 * WB VJ - Crossfade Shader
 * GLSL shader for mixing two video textures
 */

import * as pc from "playcanvas";

// Vertex shader - simple fullscreen quad
const vertexShader = /* glsl */ `
attribute vec2 aPosition;

varying vec2 vUv;

void main() {
    // Map from [-1, 1] to [0, 1] for UV coordinates
    vUv = aPosition * 0.5 + 0.5;
    // Flip Y for video texture
    vUv.y = 1.0 - vUv.y;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Fragment shader - crossfade mix
const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uTextureA;
uniform sampler2D uTextureB;
uniform float uCrossfade;

varying vec2 vUv;

void main() {
    vec4 colorA = texture2D(uTextureA, vUv);
    vec4 colorB = texture2D(uTextureB, vUv);

    // Linear crossfade mix: 0 = full A, 1 = full B
    gl_FragColor = mix(colorA, colorB, uCrossfade);
}
`;

export class CrossfadeRenderer {
  constructor(device) {
    this.device = device;
    this.shader = null;
    this.vertexBuffer = null;
    this.crossfade = 0.5;
    this.textureA = null;
    this.textureB = null;
  }

  init() {
    // Create shader
    const shaderDefinition = {
      name: "CrossfadeShader",
      attributes: {
        aPosition: pc.SEMANTIC_POSITION,
      },
      vshader: vertexShader,
      fshader: fragmentShader,
    };
    this.shader = new pc.Shader(this.device, shaderDefinition);
    if (!this.shader.ready) {
      console.error("Shader compilation failed");
    }
    console.log("Shader ready:", this.shader.ready);

    // Create fullscreen quad vertex buffer
    const positions = new Float32Array([
      -1,
      -1, // bottom-left
      1,
      -1, // bottom-right
      -1,
      1, // top-left
      1,
      1, // top-right
    ]);

    const vertexFormat = new pc.VertexFormat(this.device, [
      { semantic: pc.SEMANTIC_POSITION, components: 2, type: pc.TYPE_FLOAT32 },
    ]);

    this.vertexBuffer = new pc.VertexBuffer(this.device, vertexFormat, 4, {
      usage: pc.BUFFER_STATIC,
      data: positions,
    });

    console.log("CrossfadeRenderer initialized");
    return this;
  }

  setTextures(textureA, textureB) {
    this.textureA = textureA;
    this.textureB = textureB;
  }

  setCrossfade(value) {
    this.crossfade = Math.max(0, Math.min(1, value));
  }

  render() {
    console.log(
      "render called, shader:",
      !!this.shader,
      "texA:",
      !!this.textureA,
      "texB:",
      !!this.textureB
    );
    if (!this.shader || !this.textureA || !this.textureB) return;

    const device = this.device;
    const scope = device.scope;

    // Set shader uniforms
    scope.resolve("uTextureA").setValue(this.textureA);
    scope.resolve("uTextureB").setValue(this.textureB);
    scope.resolve("uCrossfade").setValue(this.crossfade);

    // Set render state
    device.setBlendState(pc.BlendState.NOBLEND);
    device.setCullMode(pc.CULLFACE_NONE);
    device.setDepthState(pc.DepthState.NODEPTH);

    // Bind shader and vertex buffer
    device.setShader(this.shader);
    device.setVertexBuffer(this.vertexBuffer, 0);

    // Draw fullscreen quad as triangle strip
    device.draw({
      type: pc.PRIMITIVE_TRISTRIP,
      base: 0,
      count: 4,
    });
  }
}
