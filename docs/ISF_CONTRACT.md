# VizMix ISF 契約

エフェクト用シェーダーの受け入れ形式。`src/isfEffect.js` の実装がこの契約の実体で、
本書はそれを1枚にまとめたもの。旧 `SPEC_WB_VJ.md` はリポジトリに存在しないため、
以後はこのファイルを参照する。

## 1. 形式

GLSL ES 1.00。`void main()` + `gl_FragColor` を書く（Shadertoy の `mainImage` **ではない**）。

```glsl
/*{
  "DESCRIPTION": "Brightness (multiplicative)",
  "CATEGORY": "ADJUST",
  "INPUTS": [
    {"NAME":"inputImage","TYPE":"image"},
    {"NAME":"amount","TYPE":"float","DEFAULT":0.0,"MIN":-1.0,"MAX":1.0}
  ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  c.rgb *= (1.0 + amount);
  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}
```

## 2. 供給されるもの

`src/isfEffect.js` の `ISF_PREFIX` が本体の前に自動で付く。**自分で宣言してはいけない**
（二重宣言でコンパイルが落ちる）。

| 名前 | 型 | 意味 |
|---|---|---|
| `isf_FragNormCoord` | `varying vec2` | 正規化座標 0..1 |
| `RENDERSIZE` | `uniform vec2` | 描画先の解像度 (px) |
| `TIME` | `uniform float` | 秒 |
| `inputImage` | `uniform sampler2D` | 入力画像（前段の出力） |
| `precision highp float;` | — | 既に宣言済み |

マクロ:

| マクロ | 展開 |
|---|---|
| `IMG_THIS_PIXEL(img)` | `texture2D(img, isf_FragNormCoord)` |
| `IMG_THIS_NORM_PIXEL(img)` | 同上 |
| `IMG_NORM_PIXEL(img, nc)` | `texture2D(img, nc)` — 正規化座標で任意サンプル |
| `IMG_PIXEL(img, pc)` | `texture2D(img, (pc) / RENDERSIZE)` — ピクセル座標 |

`#pragma include` は**未対応**。必要な関数は本体に直接書く。

## 3. INPUTS の仕様

`INPUTS` の各要素が uniform 宣言とUIの両方を決める。**ここが唯一の真実**で、
パラメータ名・既定値・レンジを他の場所に書いてはいけない。

| TYPE | GLSL | UI |
|---|---|---|
| `float` / `long` / `bool` | `uniform float` | スライダ |
| `color` | `uniform vec4` | カラーピッカー + プリセット |
| `point2D` | `uniform vec2` | （UI未実装） |
| `image` | `uniform sampler2D` | — |

- `NAME` が uniform 名になる。
- `inputImage` という名前の `image` は `ISF_PREFIX` 側で宣言されるので、宣言は重複しない。
- `DEFAULT` / `MIN` / `MAX` は**シェーダーの単位**で書く（例: 0..1）。UI の 0〜100% 表示は
  レジストリの `factor` が担当する（次節）。

### エフェクトは inputImage を加工すること

`inputImage` を読まないシェーダー（生成系）は、エフェクトとして使うと**映像を塗り潰す**。
wb-shader-factory の素材シェーダー333本は全部このタイプなので、エフェクトには転用できない。
素材として使う経路は別（`src/shaderRenderer.js` は Shadertoy 規約で、こことは別契約）。

## 4. レジストリへの登録

エフェクト1本を足す手順は **2ファイルだけ**。

**1) `src/effectSources.js` に ISF を書いて export する**

```js
const POSTERIZE = `/*{
  "DESCRIPTION": "Posterize", "CATEGORY": "GLITCH",
  "INPUTS": [ {"NAME":"inputImage","TYPE":"image"},
              {"NAME":"levels","TYPE":"float","DEFAULT":8.0,"MIN":2.0,"MAX":32.0} ]
}*/
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  gl_FragColor = vec4(floor(c.rgb * levels) / levels, c.a);
}`;

export { ..., POSTERIZE };
```

**2) `src/effectRegistry.js` の `EFFECT_REGISTRY` に1エントリ足す**

```js
{ id: "posterize", label: "Posterize", category: "Glitch", shortcut: "F12",
  type: "continuous", uiRank: 3, isf: S.POSTERIZE,
  ui: { levels: { label: "Levels", factor: 1, unit: "" } } },
```

これだけで、状態・一覧UI・パラメータパネル・チェーン適用・ショートカット・
MIDI ハンドラ・MIDI learn ターゲット・シリアライズが**全部自動で生える**。
`effects.js` / `effectsUI.js` / `keyboard.js` / `index.html` / `main.js` は触らない。

### エントリのフィールド

| フィールド | 必須 | 意味 |
|---|---|---|
| `id` | ✅ | 内部キー。状態・チェーン・`data-effect` 属性に使う |
| `label` | ✅ | UI 表示名 |
| `category` | ✅ | 一覧の見出し。既定の並びは `Color` / `Adjust` / `Blur` / `Warp` / `Destroy` / `Glitch` / `Noise`（`CATEGORY_ORDER`）。無い名前も末尾に出る |
| `shortcut` | | F系キー。toggle は ON/OFF、continuous は既定値へリセット |
| `type` | ✅ | `toggle` / `toggle-amount` / `continuous`（下表） |
| `uiRank` | | 同カテゴリ内の表示順（既定 0）。**適用順とは別** |
| `isf` | ✅ | ISF 文字列 |
| `ui` | | 表示だけの上書き。`{ <INPUT名>: { label, factor, unit, stateKey } }` |

`type` の違い:

| type | 状態 | 適用条件 | UI |
|---|---|---|---|
| `toggle` | `{enabled}` | `enabled` | ON/OFF のみ。ON で全パラメータを MAX に振る |
| `toggle-amount` | `{enabled, ...params}` | `enabled` かつ代表パラメータが既定値以外 | ON/OFF + スライダ。ON 時に量が既定値なら全開にする |
| `continuous` | `{...params}` | 代表パラメータが既定値以外 | スライダのみ |

「代表パラメータ」= 最初の float。RGB Multiply が色だけ変えても適用されないのはこの規則による。

`ui` の上書き:

| キー | 既定 | 用途 |
|---|---|---|
| `label` | color は `Color`、他は `Amount` | パラメータ表示名（例: `Radius` / `Angle`） |
| `factor` | float は `100`、color は `1` | ISF値 → UI値 の倍率。0..1 を 0〜100% で見せるため |
| `unit` | `factor===100` なら `%` | UI の単位表記 |
| `stateKey` | INPUT 名 | 状態・保存に使うキー（保存データの後方互換用） |

## 5. 適用順

`EFFECT_REGISTRY` の**配列順がチェーン適用順**（色調整 → ブラー → グリッチ系）。
`masterEffect.js` が ping-pong FBO で順に1パスずつ適用し、最終パスを final FBO に描く。
一覧の表示順は `category` + `uiRank` で別に決まる。

## 6. 適用箇所

エフェクトは**マスター出力段のみ**に掛かる。チャンネル(A/B)個別のエフェクトは無い。

```
planeA/planeB 合成 → [masterFBO] → ISF チェーン(ping/pong) → [final FBO]
  → 出力カメラが canvasMaster に描画 → captureStream → 出力ウィンドウ / wb-projection
```

エフェクトは canvas の画素に焼き込まれるため、`captureStream` 経由の出力にもそのまま乗る
（出力側で CSS フィルタを再適用する必要はない）。

## 7. 現在のカテゴリ構成

| カテゴリ | 性格 | 収録 |
|---|---|---|
| Color / Adjust | 土台の色調整 | Invert, Grayscale, Sepia, Saturate, Hue Rotate, Brightness, Contrast |
| Blur | ぼかし | Blur |
| Warp | 有機的な歪み | Wave, Kaleidoscope, Mosaic |
| Destroy | デジタル破壊 | Slice Shift, Block Glitch, Chromatic Ab., Bitcrush, Pixel Sort, CRT |
| Glitch | 既存グリッチ | Glitch, RGB Shift, RGB Multiply |
| Noise | 画面 / 粒子 | Posterize, Scan Lines, Noise |

適用順は「色調整 → 量子化 → ブラー → Warp → Destroy → Glitch → 画面/粒子」。
画面系(Scan Lines / CRT)と粒子(Noise)を最後に置くのは、それらが「映像を見せる装置」の
表現で、前段の加工全体に乗るべきだから。
