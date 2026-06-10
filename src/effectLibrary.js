/**
 * VizMix - Built-in Effect ISF Library
 *
 * 組み込みエフェクトの ISF ソース (正規 ISF 形式)。Step 1 では信頼性のため
 * インライン文字列で保持する (外部 ISF / AI生成 ISF の読込は Month 2 スコープ)。
 * いずれも inputImage を1パスで加工する。GLSL ES1.00。
 */

// ── ADJUST / COLOR ────────────────────────────────────────────────────────────

const BRIGHTNESS = `/*{
  "DESCRIPTION": "Brightness (multiplicative)", "CATEGORY": "ADJUST",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":-1.0,"MAX":1.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  c.rgb *= (1.0 + amount);
  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`;

const CONTRAST = `/*{
  "DESCRIPTION": "Contrast", "CATEGORY": "ADJUST",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":-1.0,"MAX":1.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  c.rgb = (c.rgb - 0.5) * (1.0 + amount) + 0.5;
  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`;

const SATURATE = `/*{
  "DESCRIPTION": "Saturation", "CATEGORY": "COLOR",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":1.0,"MIN":0.0,"MAX":2.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(clamp(mix(vec3(l), c.rgb, amount), 0.0, 1.0), c.a);
}`;

const HUE_ROTATE = `/*{
  "DESCRIPTION": "Hue Rotate (degrees)", "CATEGORY": "COLOR",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":360.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float a = radians(amount);
  vec3 yiq = mat3(0.299, 0.596, 0.211,
                  0.587, -0.274, -0.523,
                  0.114, -0.322, 0.312) * c.rgb;
  float hyp = length(yiq.yz);
  float ph = atan(yiq.z, yiq.y) + a;
  yiq.y = hyp * cos(ph);
  yiq.z = hyp * sin(ph);
  vec3 rgb = mat3(1.0, 1.0, 1.0,
                  0.956, -0.272, -1.106,
                  0.621, -0.647, 1.703) * yiq;
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`;

const GRAYSCALE = `/*{
  "DESCRIPTION": "Grayscale", "CATEGORY": "COLOR",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float g = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(mix(c.rgb, vec3(g), amount), c.a);
}`;

const SEPIA = `/*{
  "DESCRIPTION": "Sepia", "CATEGORY": "COLOR",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec3 s = vec3(
    dot(c.rgb, vec3(0.393, 0.769, 0.189)),
    dot(c.rgb, vec3(0.349, 0.686, 0.168)),
    dot(c.rgb, vec3(0.272, 0.534, 0.131)));
  gl_FragColor = vec4(mix(c.rgb, s, amount), c.a);
}`;

const INVERT = `/*{
  "DESCRIPTION": "Invert", "CATEGORY": "COLOR",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  gl_FragColor = vec4(mix(c.rgb, 1.0 - c.rgb, amount), c.a);
}`;

// ── BLUR ──────────────────────────────────────────────────────────────────────

const BLUR = `/*{
  "DESCRIPTION": "Box-ish Blur (9x9 weighted)", "CATEGORY": "BLUR",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0} ]
}*/
void main() {
  vec2 px = 1.0 / RENDERSIZE;
  float r = amount * 4.0;
  vec4 sum = vec4(0.0);
  float tot = 0.0;
  for (float x = -4.0; x <= 4.0; x += 1.0) {
    for (float y = -4.0; y <= 4.0; y += 1.0) {
      float w = 1.0 - length(vec2(x, y)) / 5.66;
      if (w > 0.0) {
        sum += IMG_NORM_PIXEL(inputImage, isf_FragNormCoord + vec2(x, y) * px * r) * w;
        tot += w;
      }
    }
  }
  gl_FragColor = sum / tot;
}`;

// ── GLITCH (CSSにできない系) ───────────────────────────────────────────────────

const RGB_SHIFT = `/*{
  "DESCRIPTION": "RGB Shift", "CATEGORY": "GLITCH",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0} ]
}*/
void main() {
  vec2 uv = isf_FragNormCoord;
  float s = amount * 0.02;
  float r = IMG_NORM_PIXEL(inputImage, vec2(uv.x + s, uv.y)).r;
  vec4 g = IMG_THIS_PIXEL(inputImage);
  float b = IMG_NORM_PIXEL(inputImage, vec2(uv.x - s, uv.y)).b;
  gl_FragColor = vec4(r, g.g, b, g.a);
}`;

const GLITCH = `/*{
  "DESCRIPTION": "Glitch (horizontal slice displacement)", "CATEGORY": "GLITCH",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0} ]
}*/
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 uv = isf_FragNormCoord;
  float row = floor(uv.y * 24.0);
  float active = step(0.7, hash(row * 1.7 + floor(TIME * 8.0)));
  float offset = (hash(row + floor(TIME * 12.0)) - 0.5) * amount * 0.3 * active;
  uv.x = fract(uv.x + offset);
  gl_FragColor = IMG_NORM_PIXEL(inputImage, uv);
}`;

const RGB_MULTIPLY = `/*{
  "DESCRIPTION": "RGB Multiply (tint)", "CATEGORY": "GLITCH",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"tint","TYPE":"color","DEFAULT":[1.0,0.0,0.0,1.0]} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec3 tinted = c.rgb * tint.rgb;
  gl_FragColor = vec4(mix(c.rgb, tinted, amount), c.a);
}`;

// 登録名 → ISF ソース。MasterEffectChain.registerEffect で全部コンパイルする。
export const EFFECT_ISF = {
  brightness: BRIGHTNESS,
  contrast: CONTRAST,
  saturate: SATURATE,
  hueRotate: HUE_ROTATE,
  grayscale: GRAYSCALE,
  sepia: SEPIA,
  invert: INVERT,
  blur: BLUR,
  rgbShift: RGB_SHIFT,
  glitch: GLITCH,
  rgbMultiply: RGB_MULTIPLY,
};

// チェーン適用順 (色調整 → ブラー → グリッチ系を最後に重ねる)
export const EFFECT_ORDER = [
  "brightness", "contrast", "saturate", "hueRotate",
  "grayscale", "sepia", "invert",
  "blur", "rgbShift", "glitch", "rgbMultiply",
];

/** hex色 (#RRGGBB) → [r,g,b,a] 0..1 */
function hexToVec4(hex) {
  const h = (hex || "#FF0000").replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b, 1.0];
}

/**
 * getEffectParams() の出力から、有効なエフェクトの適用順チェーンを構築。
 * @returns {Array<{name, params}>}
 */
export function buildActiveChain(p) {
  const chain = [];
  const add = (name, params) => chain.push({ name, params });

  // EFFECT_ORDER に沿って中立値でない物だけ積む
  if (p.brightness !== 0) add("brightness", { amount: p.brightness });
  if (p.contrast !== 0) add("contrast", { amount: p.contrast });
  if (p.saturate !== undefined && p.saturate !== 1) add("saturate", { amount: p.saturate });
  if (p.hueRotate) add("hueRotate", { amount: p.hueRotate });
  if (p.grayscale > 0) add("grayscale", { amount: p.grayscale });
  if (p.sepia > 0) add("sepia", { amount: p.sepia });
  if (p.invert > 0.5) add("invert", { amount: 1.0 });
  if (p.blur > 0) add("blur", { amount: p.blur });
  if (p.rgbShift > 0) add("rgbShift", { amount: p.rgbShift });
  if (p.glitch > 0) add("glitch", { amount: p.glitch });
  if (p.rgbMultiply > 0) add("rgbMultiply", { amount: p.rgbMultiply, tint: hexToVec4(p.rgbMultiplyColor) });

  return chain;
}
