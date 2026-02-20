/**
 * VizMix - Effect Shader
 * Post-processing effects for master output
 * v0.7.0
 */

// エフェクトフラグメントシェーダー
export const effectFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
uniform float uInvert;
uniform float uGrayscale;
uniform float uSepia;
uniform float uBlur;
uniform float uBrightness;
uniform float uContrast;
uniform vec2 uResolution;

varying vec2 vUv;

// ブラー用のサンプリング
vec4 blur(sampler2D tex, vec2 uv, vec2 resolution, float amount) {
  vec4 color = vec4(0.0);
  float total = 0.0;
  float blurSize = amount * 10.0 / resolution.x;

  for (float x = -4.0; x <= 4.0; x += 1.0) {
    for (float y = -4.0; y <= 4.0; y += 1.0) {
      vec2 offset = vec2(x, y) * blurSize;
      float weight = 1.0 - length(vec2(x, y)) / 5.66; // sqrt(32)
      if (weight > 0.0) {
        color += texture2D(tex, uv + offset) * weight;
        total += weight;
      }
    }
  }

  return color / total;
}

void main() {
  vec2 uv = vUv;

  // ブラー
  vec4 color;
  if (uBlur > 0.001) {
    color = blur(uTexture, uv, uResolution, uBlur);
  } else {
    color = texture2D(uTexture, uv);
  }

  // 明度
  color.rgb += uBrightness;

  // コントラスト
  color.rgb = (color.rgb - 0.5) * (1.0 + uContrast) + 0.5;

  // グレースケール
  if (uGrayscale > 0.001) {
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(gray), uGrayscale);
  }

  // セピア
  if (uSepia > 0.001) {
    vec3 sepiaColor = vec3(
      dot(color.rgb, vec3(0.393, 0.769, 0.189)),
      dot(color.rgb, vec3(0.349, 0.686, 0.168)),
      dot(color.rgb, vec3(0.272, 0.534, 0.131))
    );
    color.rgb = mix(color.rgb, sepiaColor, uSepia);
  }

  // 反転
  if (uInvert > 0.5) {
    color.rgb = 1.0 - color.rgb;
  }

  // クランプ
  color.rgb = clamp(color.rgb, 0.0, 1.0);

  gl_FragColor = color;
}
`;

export const effectVertexShader = /* glsl */ `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
