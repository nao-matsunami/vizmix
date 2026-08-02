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

// ── NOISE (batch1 から畳み込み) ────────────────────────────────────────────────

const POSTERIZE = `/*{
  "DESCRIPTION": "Posterize (tone quantize)", "CATEGORY": "NOISE",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"levels","TYPE":"float","DEFAULT":4.0,"MIN":2.0,"MAX":16.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float L = max(2.0, floor(levels));
  // floor(c*L)/(L-1) で levels=2 のとき真の黒/白2値に振り切る (白が白のまま残る)
  vec3 q = clamp(floor(c.rgb * L) / (L - 1.0), 0.0, 1.0);
  gl_FragColor = vec4(mix(c.rgb, q, amount), c.a);
}`;

const SCANLINES = `/*{
  "DESCRIPTION": "Scan Lines (Bad TV)", "CATEGORY": "NOISE",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"lineFreq","TYPE":"float","DEFAULT":300.0,"MIN":100.0,"MAX":800.0},
              {"NAME":"rollSpeed","TYPE":"float","DEFAULT":2.0,"MIN":0.0,"MAX":20.0} ]
}*/
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 uv = isf_FragNormCoord;
  // 崩れた信号: 行ごとの弱い横ずれ
  float jrow = floor(uv.y * 80.0);
  float jitter = (hash(jrow + floor(TIME * 10.0)) - 0.5) * 0.01 * amount;
  vec4 c = IMG_NORM_PIXEL(inputImage, vec2(fract(uv.x + jitter), uv.y));
  // 走査線 (sin) + 縦ローリング
  float scan = 0.5 + 0.5 * sin(uv.y * lineFreq + TIME * rollSpeed);
  float dark = 1.0 - amount * 0.5 * scan;
  c.rgb *= dark;
  gl_FragColor = c;
}`;

const NOISE = `/*{
  "DESCRIPTION": "Noise (Film Grain)", "CATEGORY": "NOISE",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"mono","TYPE":"float","DEFAULT":1.0,"MIN":0.0,"MAX":1.0} ]
}*/
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = isf_FragNormCoord;
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float t = fract(TIME);
  vec3 n;
  if (mono > 0.5) {
    n = vec3(hash2(uv + t) - 0.5);
  } else {
    n = vec3(
      hash2(uv + t),
      hash2(uv + t + 13.0),
      hash2(uv + t + 27.0)) - 0.5;
  }
  c.rgb += n * amount;
  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`;

// ── DESTROY (デジタル破壊系) ──────────────────────────────────────────────────

const CHROMATIC = `/*{
  "DESCRIPTION": "Chromatic Aberration (radial RGB split)", "CATEGORY": "DESTROY",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"falloff","TYPE":"float","DEFAULT":1.5,"MIN":0.2,"MAX":4.0} ]
}*/
void main() {
  vec2 uv = isf_FragNormCoord;
  vec4 base = IMG_THIS_PIXEL(inputImage);
  if (amount <= 0.0) { gl_FragColor = base; return; }
  // 画面中心からの距離で増幅する = 周辺ほど激しく割れる
  vec2 d = uv - vec2(0.5);
  float r = clamp(length(d) * 2.0, 0.0, 1.4142);
  float k = amount * 0.08 * pow(r, falloff);
  vec2 dir = r > 0.0001 ? normalize(d) : vec2(0.0);
  float cr = IMG_NORM_PIXEL(inputImage, clamp(uv + dir * k, 0.0, 1.0)).r;
  float cb = IMG_NORM_PIXEL(inputImage, clamp(uv - dir * k, 0.0, 1.0)).b;
  gl_FragColor = vec4(cr, base.g, cb, base.a);
}`;

const PIXEL_SORT = `/*{
  "DESCRIPTION": "Pixel Sort (pseudo, brightness smear)", "CATEGORY": "DESTROY",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"threshold","TYPE":"float","DEFAULT":0.55,"MIN":0.0,"MAX":1.0},
              {"NAME":"reach","TYPE":"float","DEFAULT":90.0,"MIN":4.0,"MAX":320.0} ]
}*/
void main() {
  vec2 uv = isf_FragNormCoord;
  vec4 src = IMG_THIS_PIXEL(inputImage);
  if (amount <= 0.0) { gl_FragColor = src; return; }
  // 真のソートは1パスで組めないので「左方向で最も明るい画素を引き延ばす」近似。
  // 明部が右へ流れる、ピクセルソート特有の縞になる。
  float px = 1.0 / RENDERSIZE.x;
  vec4 best = src;
  float bestL = dot(src.rgb, vec3(0.299, 0.587, 0.114));
  for (float i = 1.0; i <= 24.0; i += 1.0) {
    vec2 s = vec2(uv.x - reach * px * (i / 24.0), uv.y);
    if (s.x < 0.0) break;
    vec4 c = IMG_NORM_PIXEL(inputImage, s);
    float L = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    if (L > threshold && L > bestL) { bestL = L; best = c; }
  }
  gl_FragColor = vec4(mix(src.rgb, best.rgb, amount), src.a);
}`;

const BLOCK_GLITCH = `/*{
  "DESCRIPTION": "Block Glitch (datamosh-ish)", "CATEGORY": "DESTROY",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"blockSize","TYPE":"float","DEFAULT":48.0,"MIN":8.0,"MAX":220.0} ]
}*/
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = isf_FragNormCoord;
  if (amount <= 0.0) { gl_FragColor = IMG_THIS_PIXEL(inputImage); return; }
  vec2 grid = RENDERSIZE / max(8.0, blockSize);
  vec2 cell = floor(uv * grid);
  float t = floor(TIME * 6.0);
  float h = hash21(cell + t);
  // amount で「壊れるブロックの割合」が増える
  float act = step(1.0 - amount * 0.7, h);
  vec2 off = (vec2(hash21(cell + t + 7.0), hash21(cell + t + 17.0)) - 0.5) * amount * 0.28 * act;
  vec2 suv = fract(uv + off);
  vec4 c = IMG_NORM_PIXEL(inputImage, suv);
  // ブロックごとに色チャンネルもずらす = 圧縮ノイズっぽさ
  float ch = (hash21(cell + t + 31.0) - 0.5) * amount * 0.05 * act;
  c.r = IMG_NORM_PIXEL(inputImage, fract(suv + vec2(ch, 0.0))).r;
  c.b = IMG_NORM_PIXEL(inputImage, fract(suv - vec2(ch, 0.0))).b;
  gl_FragColor = c;
}`;

const BITCRUSH = `/*{
  "DESCRIPTION": "Bitcrush (per-channel quantize + dither)", "CATEGORY": "DESTROY",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"levels","TYPE":"float","DEFAULT":6.0,"MIN":2.0,"MAX":24.0},
              {"NAME":"dither","TYPE":"float","DEFAULT":0.35,"MIN":0.0,"MAX":1.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  if (amount <= 0.0) { gl_FragColor = c; return; }
  // Posterize と違い R/G/B で段数を変える = 色が転ぶ (ビットクラッシュ感)
  vec3 L = vec3(max(2.0, floor(levels)),
                max(2.0, floor(levels * 0.7)),
                max(2.0, floor(levels * 0.45)));
  vec2 p = floor(isf_FragNormCoord * RENDERSIZE);
  float b = mod(p.x, 4.0) + mod(p.y, 4.0) * 4.0;
  float d = (fract(sin(b * 12.9898) * 43758.5453) - 0.5) * dither;
  vec3 q = clamp(floor((c.rgb + d / L) * L) / (L - 1.0), 0.0, 1.0);
  gl_FragColor = vec4(mix(c.rgb, q, amount), c.a);
}`;

const CRT = `/*{
  "DESCRIPTION": "CRT (barrel + RGB stripe + scanline + vignette)", "CATEGORY": "DESTROY",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"curvature","TYPE":"float","DEFAULT":0.5,"MIN":0.0,"MAX":1.0},
              {"NAME":"scanIntensity","TYPE":"float","DEFAULT":0.6,"MIN":0.0,"MAX":1.0} ]
}*/
void main() {
  vec2 uv = isf_FragNormCoord;
  if (amount <= 0.0) { gl_FragColor = IMG_THIS_PIXEL(inputImage); return; }
  // 画面湾曲
  vec2 c2 = uv * 2.0 - 1.0;
  float r2 = dot(c2, c2);
  vec2 buv = (c2 * (1.0 + curvature * amount * 0.30 * r2)) * 0.5 + 0.5;
  vec4 col;
  if (buv.x < 0.0 || buv.x > 1.0 || buv.y < 0.0 || buv.y > 1.0) {
    col = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    col = IMG_NORM_PIXEL(inputImage, buv);
  }
  // RGB ストライプ (シャドウマスク)
  float sx = mod(floor(buv.x * RENDERSIZE.x), 3.0);
  vec3 stripe = vec3(sx < 0.5 ? 1.0 : 0.72,
                     (sx > 0.5 && sx < 1.5) ? 1.0 : 0.72,
                     sx > 1.5 ? 1.0 : 0.72);
  col.rgb *= mix(vec3(1.0), stripe, amount);
  // 走査線
  float scan = 0.5 + 0.5 * sin(buv.y * RENDERSIZE.y * 3.14159265);
  col.rgb *= 1.0 - scanIntensity * amount * 0.32 * scan;
  // ビネット
  col.rgb *= mix(1.0, clamp(1.0 - r2 * 0.22, 0.0, 1.0), amount);
  // ストライプ+走査線+ビネットの乗算で全体が沈むので、その分だけ持ち上げる
  // (これが無いと amount=1 で暗くなりすぎて「ただ暗い映像」になる)
  col.rgb = clamp(col.rgb * mix(1.0, 1.45, amount), 0.0, 1.0);
  gl_FragColor = col;
}`;

const SLICE_SHIFT = `/*{
  "DESCRIPTION": "Slice Shift (horizontal band displacement)", "CATEGORY": "DESTROY",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"sliceCount","TYPE":"float","DEFAULT":28.0,"MIN":4.0,"MAX":160.0},
              {"NAME":"maxShift","TYPE":"float","DEFAULT":0.35,"MIN":0.0,"MAX":1.0} ]
}*/
float hashf(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 uv = isf_FragNormCoord;
  if (amount <= 0.0) { gl_FragColor = IMG_THIS_PIXEL(inputImage); return; }
  float n = max(2.0, floor(sliceCount));
  float row = floor(uv.y * n);
  float t = floor(TIME * 9.0);
  float h = hashf(row * 3.7 + t);
  float act = step(1.0 - amount * 0.85, fract(h * 7.3));
  float sh = (h - 0.5) * maxShift * amount * act;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, vec2(fract(uv.x + sh), uv.y));
}`;

// ── WARP (有機的歪み系) ───────────────────────────────────────────────────────

const WAVE = `/*{
  "DESCRIPTION": "Wave / Ripple (sine UV distortion)", "CATEGORY": "WARP",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"frequency","TYPE":"float","DEFAULT":12.0,"MIN":1.0,"MAX":60.0},
              {"NAME":"speed","TYPE":"float","DEFAULT":1.5,"MIN":0.0,"MAX":8.0} ]
}*/
void main() {
  vec2 uv = isf_FragNormCoord;
  if (amount <= 0.0) { gl_FragColor = IMG_THIS_PIXEL(inputImage); return; }
  float a = amount * 0.05;
  uv.x += sin(uv.y * frequency + TIME * speed) * a;
  uv.y += cos(uv.x * frequency * 0.7 + TIME * speed * 0.8) * a;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, clamp(uv, 0.0, 1.0));
}`;

const KALEIDOSCOPE = `/*{
  "DESCRIPTION": "Kaleidoscope (polar mirror repeat)", "CATEGORY": "WARP",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"segments","TYPE":"float","DEFAULT":6.0,"MIN":2.0,"MAX":24.0},
              {"NAME":"rotation","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":360.0},
              {"NAME":"zoom","TYPE":"float","DEFAULT":1.0,"MIN":0.2,"MAX":3.0} ]
}*/
// 0..1 の外へ出た座標を鏡像で折り返す。
// clamp で潰すと画像の縁の色が扇状に伸びて「黒い星」になり、万華鏡に見えない。
float mirror1(float x) {
  x = mod(abs(x), 2.0);
  return x > 1.0 ? 2.0 - x : x;
}
void main() {
  vec2 uv = isf_FragNormCoord;
  vec4 base = IMG_THIS_PIXEL(inputImage);
  if (amount <= 0.0) { gl_FragColor = base; return; }
  float aspect = RENDERSIZE.x / RENDERSIZE.y;
  vec2 p = uv - 0.5;
  p.x *= aspect;
  float r = length(p) * max(0.2, zoom);
  float a = atan(p.y, p.x) + radians(rotation);
  float seg = 6.28318530718 / max(2.0, floor(segments));
  // 楔の中へ畳んでから鏡像に折る (min(a, seg-a) が三角波 = 継ぎ目が鏡像になる)
  a = mod(a, seg);
  a = min(a, seg - a);
  vec2 q = vec2(cos(a), sin(a)) * r;
  q.x /= aspect;
  vec2 suv = q + 0.5;
  suv = vec2(mirror1(suv.x), mirror1(suv.y));
  vec4 k = IMG_NORM_PIXEL(inputImage, suv);
  gl_FragColor = vec4(mix(base.rgb, k.rgb, amount), base.a);
}`;

const MOSAIC = `/*{
  "DESCRIPTION": "Mosaic / Dots (cell quantize)", "CATEGORY": "WARP",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0},
              {"NAME":"cellSize","TYPE":"float","DEFAULT":24.0,"MIN":2.0,"MAX":160.0},
              {"NAME":"dots","TYPE":"float","DEFAULT":0.0,"MIN":0.0,"MAX":1.0} ]
}*/
void main() {
  vec2 uv = isf_FragNormCoord;
  vec4 base = IMG_THIS_PIXEL(inputImage);
  if (amount <= 0.0) { gl_FragColor = base; return; }
  vec2 grid = RENDERSIZE / max(2.0, cellSize);
  vec2 cell = floor(uv * grid);
  vec2 center = (cell + 0.5) / grid;
  vec4 c = IMG_NORM_PIXEL(inputImage, center);
  // dots: セル内の円マスク。輝度が高いほど円が大きい = ハーフトーン風
  vec2 f = fract(uv * grid) - 0.5;
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float radius = 0.15 + 0.35 * lum;
  float mask = 1.0 - smoothstep(radius - 0.05, radius + 0.05, length(f));
  vec3 dotted = c.rgb * mask;
  vec3 outc = mix(c.rgb, dotted, dots);
  gl_FragColor = vec4(mix(base.rgb, outc, amount), base.a);
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
  POSTERIZE,
  SCANLINES,
  NOISE,
  CHROMATIC,
  PIXEL_SORT,
  BLOCK_GLITCH,
  BITCRUSH,
  CRT,
  SLICE_SHIFT,
  WAVE,
  KALEIDOSCOPE,
  MOSAIC,
};
