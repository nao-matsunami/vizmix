/**
 * VizMix - Master Effect Chain
 *
 * マスター出力に ISF エフェクトパスを挿す基盤。
 *   [scene(A/B compose)] → [Master FBO] → [ISF chain] → [Output Canvas] → captureStream
 *
 * PlayCanvas カメラの renderTarget を Master FBO に向け、postrender で
 * Master FBO を起点に有効エフェクト ISF を ping-pong で順に適用し、
 * 最終パスを canvas (backbuffer) に描く。エフェクトが canvas 画素に焼かれるため
 * captureStream がそのまま拾い、出力ウィンドウにも反映される。
 */

import * as pc from "playcanvas";
import { ISFEffect } from "./isfEffect.js";

// 無エフェクト時 / 最終ブリット用のパススルー ISF
const PASSTHROUGH_ISF = `/*{ "DESCRIPTION": "passthrough", "INPUTS": [ {"NAME":"inputImage","TYPE":"image"} ] }*/
void main() {
  gl_FragColor = IMG_THIS_PIXEL(inputImage);
}`;

function makeFBO(device, name, width, height) {
  const texture = new pc.Texture(device, {
    name,
    width,
    height,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  const renderTarget = new pc.RenderTarget({ name: name + "-rt", colorBuffer: texture, depth: true });
  return { texture, renderTarget };
}

export class MasterEffectChain {
  constructor(device) {
    this.device = device;
    this.width = 0;
    this.height = 0;
    this.master = null;   // カメラの描画先 (シーン)
    this.ping = null;     // チェーン中間 A
    this.pong = null;     // チェーン中間 B
    this.final = null;    // チェーン最終出力 (出力プレーンが表示)
    this.quadVB = null;
    this.effects = {};    // name -> ISFEffect
    this.passthrough = null;
    this.initialized = false;
  }

  init(width, height) {
    this.width = width;
    this.height = height;
    this.quadVB = this._quad();
    this.master = makeFBO(this.device, "masterFBO", width, height);
    this.ping = makeFBO(this.device, "fxPing", width, height);
    this.pong = makeFBO(this.device, "fxPong", width, height);
    this.final = makeFBO(this.device, "fxFinal", width, height);
    this.passthrough = new ISFEffect("passthrough", PASSTHROUGH_ISF);
    this.passthrough.compile(this.device);
    this.initialized = true;
    console.log(`MasterEffectChain initialized (${width}x${height})`);
    return this;
  }

  _quad() {
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    return new pc.VertexBuffer(
      this.device,
      new pc.VertexFormat(this.device, [
        { semantic: pc.SEMANTIC_POSITION, components: 2, type: pc.TYPE_FLOAT32 },
      ]),
      6,
      { data: positions }
    );
  }

  /** カメラの renderTarget に設定する RT (シーンはここに描かれる) */
  getMasterRenderTarget() {
    return this.master ? this.master.renderTarget : null;
  }

  /** チェーン最終出力テクスチャ (出力プレーンの emissiveMap に使う) */
  getOutputTexture() {
    return this.final ? this.final.texture : null;
  }

  /** エフェクト ISF を登録 (コンパイル)。成功可否を返す。 */
  registerEffect(name, source) {
    const fx = new ISFEffect(name, source);
    const ok = fx.compile(this.device);
    this.effects[name] = fx;
    return ok;
  }

  getEffect(name) {
    return this.effects[name] || null;
  }

  /**
   * Master FBO を起点に有効エフェクトを順に適用し canvas へ出力。
   * @param {Array<{name:string, params:Object}>} activeEffects 適用順
   * @param {number} time 秒
   */
  apply(activeEffects, time) {
    if (!this.initialized) return;
    const device = this.device;
    const w = this.width, h = this.height;

    const chain = (activeEffects || []).filter((e) => {
      const fx = this.effects[e.name];
      return fx && fx.compiled;
    });

    // 最終出力は final FBO。出力プレーン(別カメラ)が canvas に表示する。
    // (PlayCanvas 2.x では postrender からの backbuffer 直接描画は表示されないため)
    const finalRT = this.final.renderTarget;

    // 無エフェクト: master をそのまま final にブリット
    if (chain.length === 0) {
      this.passthrough.render(device, this.quadVB, this.master.texture, finalRT, w, h, {}, time);
      return;
    }

    let srcTex = this.master.texture;
    let writePing = true;
    for (let i = 0; i < chain.length; i++) {
      const isLast = i === chain.length - 1;
      const fx = this.effects[chain[i].name];
      const outRT = isLast ? finalRT : (writePing ? this.ping.renderTarget : this.pong.renderTarget);
      fx.render(device, this.quadVB, srcTex, outRT, w, h, chain[i].params || {}, time);
      if (!isLast) {
        srcTex = writePing ? this.ping.texture : this.pong.texture;
        writePing = !writePing;
      }
    }
  }

  resize(width, height) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    for (const fbo of [this.master, this.ping, this.pong, this.final]) {
      fbo.renderTarget.destroy();
      fbo.texture.destroy();
    }
    this.master = makeFBO(this.device, "masterFBO", width, height);
    this.ping = makeFBO(this.device, "fxPing", width, height);
    this.pong = makeFBO(this.device, "fxPong", width, height);
    this.final = makeFBO(this.device, "fxFinal", width, height);
    console.log(`MasterEffectChain resized -> ${width}x${height}`);
  }

  destroy() {
    for (const fbo of [this.master, this.ping, this.pong, this.final]) {
      if (fbo) { fbo.renderTarget.destroy(); fbo.texture.destroy(); }
    }
    this.master = this.ping = this.pong = this.final = null;
    if (this.quadVB) { this.quadVB.destroy(); this.quadVB = null; }
    for (const k in this.effects) this.effects[k].destroy();
    this.effects = {};
    if (this.passthrough) { this.passthrough.destroy(); this.passthrough = null; }
    this.initialized = false;
  }
}
