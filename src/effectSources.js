/**
 * VizMix - Built-in Effect ISF Sources
 *
 * 組み込みエフェクトの ISF ソース (正規 ISF 形式)。**文字列そのものが唯一の真実**で、
 * パラメータ(名前/型/既定/レンジ)もカテゴリもここのヘッダから導出する。
 * 二重定義を避けるため、このファイルには文字列以外を置かない。
 * 契約は docs/ISF_CONTRACT.md を参照。
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

export {
  BRIGHTNESS,
  CONTRAST,
  SATURATE,
  HUE_ROTATE,
  GRAYSCALE,
  SEPIA,
  INVERT,
  BLUR,
  RGB_SHIFT,
  GLITCH,
  RGB_MULTIPLY,
};
