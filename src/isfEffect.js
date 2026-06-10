/**
 * VizMix - ISF Effect Runner
 *
 * 入力画像(inputImage)を1パスで加工するエフェクト用 ISF を扱う。
 * SPEC_WB_VJ.md の ISF 規約に準拠:
 *   - void main() + gl_FragColor
 *   - TIME / RENDERSIZE / isf_FragNormCoord
 *   - inputImage (INPUT image), IMG_THIS_PIXEL / IMG_NORM_PIXEL / IMG_PIXEL マクロ
 *
 * 素材用 ISF と同じ形式なので、wb-shader-factory・自作 ISF・AI生成シェーダーを
 * そのままエフェクトに転用できる。実装は PlayCanvas pc.Shader (GLSL ES1.00) を使用。
 */

import * as pc from "playcanvas";

const FULLSCREEN_VERT = /* glsl */ `
attribute vec2 aPosition;
varying vec2 isf_FragNormCoord;

void main() {
  isf_FragNormCoord = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// ISF 互換マクロ + 標準 uniform。各エフェクト ISF 本体の前に付与する。
const ISF_PREFIX = /* glsl */ `
precision highp float;

varying vec2 isf_FragNormCoord;
uniform vec2 RENDERSIZE;
uniform float TIME;
uniform sampler2D inputImage;

#define IMG_NORM_PIXEL(img, nc) texture2D(img, nc)
#define IMG_THIS_PIXEL(img) texture2D(img, isf_FragNormCoord)
#define IMG_THIS_NORM_PIXEL(img) texture2D(img, isf_FragNormCoord)
#define IMG_PIXEL(img, pc) texture2D(img, (pc) / RENDERSIZE)
`;

/** ISF の TYPE → GLSL uniform 宣言 */
function uniformDecl(input) {
  switch (input.TYPE) {
    case "float":
    case "long":
    case "bool":
      return `uniform float ${input.NAME};`;
    case "color":
      return `uniform vec4 ${input.NAME};`;
    case "point2D":
      return `uniform vec2 ${input.NAME};`;
    case "image":
      return input.NAME === "inputImage" ? "" : `uniform sampler2D ${input.NAME};`;
    default:
      return "";
  }
}

export class ISFEffect {
  /**
   * @param {string} name      エフェクト名 (effectsState のキーに対応)
   * @param {string} source    ISF ソース (ヘッダ + 本体)
   */
  constructor(name, source) {
    this.name = name;
    this.source = source;
    this.header = null;     // パースした JSON ヘッダ
    this.inputs = [];       // image 以外の INPUT (パラメータ)
    this.shader = null;
    this.compiled = false;
    this.error = null;
  }

  /** ISF ヘッダ /*{...}*​/ を解析 */
  parseHeader() {
    const m = this.source.match(/\/\*\s*(\{[\s\S]*?\})\s*\*\//);
    if (m) {
      try {
        this.header = JSON.parse(m[1]);
      } catch (e) {
        this.header = { INPUTS: [] };
        console.warn(`[ISF:${this.name}] header JSON parse failed, using empty:`, e.message);
      }
    } else {
      this.header = { INPUTS: [] };
    }
    this.inputs = (this.header.INPUTS || []).filter((i) => i.TYPE !== "image");
    return this.header;
  }

  /** ISF 本体 (ヘッダコメントを除いた GLSL) */
  body() {
    return this.source.replace(/\/\*\s*\{[\s\S]*?\}\s*\*\//, "");
  }

  compile(device) {
    this.parseHeader();
    const decls = (this.header.INPUTS || []).map(uniformDecl).filter(Boolean).join("\n");
    const frag = `${ISF_PREFIX}\n${decls}\n${this.body()}`;
    try {
      this.shader = new pc.Shader(device, {
        name: `isf-${this.name}`,
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vshader: FULLSCREEN_VERT,
        fshader: frag,
      });
      this.compiled = true;
    } catch (e) {
      this.error = e.message || String(e);
      this.compiled = false;
      console.error(`[ISF:${this.name}] compile failed:`, this.error);
    }
    return this.compiled;
  }

  /** INPUT のデフォルト値マップ */
  defaultParams() {
    const p = {};
    for (const inp of this.inputs) {
      if (inp.DEFAULT !== undefined) p[inp.NAME] = inp.DEFAULT;
    }
    return p;
  }

  /**
   * 1パス描画: inputTexture を加工して outputRT (null=canvas) へ出力。
   * @param {pc.GraphicsDevice} device
   * @param {pc.VertexBuffer} quadVB    フルスクリーンクワッド
   * @param {pc.Texture} inputTexture
   * @param {pc.RenderTarget|null} outputRT
   * @param {number} width
   * @param {number} height
   * @param {Object} params   { paramName: value } (float / [r,g,b,a] / [x,y])
   * @param {number} time     秒
   */
  render(device, quadVB, inputTexture, outputRT, width, height, params, time) {
    if (!this.compiled || !this.shader) return false;

    device.setRenderTarget(outputRT);
    device.updateBegin();
    // RT/canvas のサイズで viewport を明示 (前段の viewport を引き継がない)
    device.setViewport(0, 0, width, height);
    device.setScissor(0, 0, width, height);

    const scope = device.scope;
    device.setShader(this.shader);
    scope.resolve("inputImage").setValue(inputTexture);
    scope.resolve("RENDERSIZE").setValue([width, height]);
    scope.resolve("TIME").setValue(time);

    for (const inp of this.inputs) {
      const v = params && params[inp.NAME] !== undefined ? params[inp.NAME] : inp.DEFAULT;
      if (v === undefined) continue;
      scope.resolve(inp.NAME).setValue(v);
    }

    device.setBlendState(pc.BlendState.NOBLEND);
    device.setCullMode(pc.CULLFACE_NONE);
    device.setDepthState(pc.DepthState.NODEPTH);
    device.setVertexBuffer(quadVB, 0);
    device.draw({ type: pc.PRIMITIVE_TRIANGLES, base: 0, count: 6 });

    device.updateEnd();
    device.setRenderTarget(null);
    return true;
  }

  destroy() {
    if (this.shader) {
      this.shader.destroy();
      this.shader = null;
    }
    this.compiled = false;
  }
}
