# VizMix v1.0 一括実装指示書（Claude Code用）

## 概要

VizMix v0.8.1 → v1.0 に向けて、以下の機能を**すべて順番に実装**してください。
各機能を実装したら動作確認（lint/ビルドエラーなし）を確認してから次へ進むこと。
最後にまとめてビルドしてください。

**現在のバージョン**: v0.8.1
**ターゲット**: v1.0.0
**重要**: レイアウト/デザインの調整は不要。機能が動くことを最優先。見た目は後で調整する。

---

## 実装順序

### TASK-1: ダブルクリックでBankアサイン（難易度: 低）

**仕様**:
- メディアブラウザのサムネイルをダブルクリックすると、現在選択中のBank（アクティブなBankボタン）にその映像をアサインする
- Channel A側で選択中のBankがあればそこに、Channel B側で選択中があればそこにアサイン
- どちらも選択されていない場合は、Channel Aの現在アクティブなBankにアサイン
- アサイン後、サムネイルがBankボタンに反映されること

**実装ポイント**:
- メディアブラウザのサムネイル要素に `dblclick` イベントを追加
- 既存のドラッグ&ドロップアサインと同じロジックを呼び出す
- 4Kブロックのチェックも同様に適用すること

---

### TASK-2: チャンネルディマー（難易度: 中）

**仕様**:
- Channel A / Channel B それぞれに独立した縦フェーダー（ディマー）を追加
- 範囲: 0%（真っ暗）〜 100%（フル表示）
- デフォルト: 100%
- クロスフェーダーとは独立して動作する
- 最終出力 = クロスフェーダーのミックス結果 × 各チャンネルのディマー値

**実装ポイント**:
- UIは `<input type="range">` の縦配置（`orient: vertical` または CSS transform: rotate）
- Channel Aプレビューの左側、Channel Bプレビューの右側に配置
- ミキシングのシェーダーまたはJS側で、各チャンネルのopacityにディマー値を乗算
- ディマー値は 0.0〜1.0 のfloat

**ミキシングロジック**:
```
channelA_output = channelA_texture × dimmerA
channelB_output = channelB_texture × dimmerB
final_output = mix(channelA_output, channelB_output, crossfaderValue)
```

---

### TASK-3: グリッチ系エフェクト追加（難易度: 中）

**仕様**:
既存のEffectsパネル（Invert/Grayscale/Sepia/Blur/Brightness/Contrast）に以下を追加:

1. **Glitch** — 水平方向のラインずらし（RGBシフト + 水平スライス）
   - パラメータ: Amount（0〜100%）
   - 0%でエフェクトなし

2. **RGB Shift** — R/G/Bチャンネルをそれぞれオフセット
   - パラメータ: Amount（0〜100%）
   - 0%でエフェクトなし

3. **RGB Multiply**（RGB乗算）— 映像に単色を乗算
   - パラメータ: Amount（0〜100%）+ Color（デフォルト: 赤 #FF0000）
   - モノクロ映像に色を載せて単色で出す用途
   - カラーピッカーまたはプリセットボタン（R/G/B/Cyan/Magenta/Yellow）

**実装ポイント**:
- 既存のエフェクトシステム（ポストプロセスシェーダー）に追加
- Effects パネルの既存カテゴリ構造に合わせる
  - 「Glitch」カテゴリを新設するか、既存カテゴリに追加するかは既存コードに合わせる
- GLSL フラグメントシェーダーで実装
- 各エフェクトのON/OFFとAmountスライダーをUIに追加

**Glitch シェーダー参考**:
```glsl
// 水平スライスずらし
float offset = sin(uv.y * 50.0 + time * 10.0) * amount * 0.1;
vec2 glitchUV = vec2(uv.x + offset, uv.y);
```

**RGB Shift シェーダー参考**:
```glsl
float shift = amount * 0.02;
float r = texture2D(source, uv + vec2(shift, 0.0)).r;
float g = texture2D(source, uv).g;
float b = texture2D(source, uv - vec2(shift, 0.0)).b;
gl_FragColor = vec4(r, g, b, 1.0);
```

**RGB Multiply シェーダー参考**:
```glsl
vec3 color = texture2D(source, uv).rgb;
vec3 tinted = color * multiplyColor;
gl_FragColor = vec4(mix(color, tinted, amount), 1.0);
```

---

### TASK-4: BPMフラッシュ（難易度: 中）

**仕様**:
- BPMに合わせて白いフラッシュ（白ベタ）を映像の上にオーバーレイ表示
- ON/OFFボタンで有効化
- フラッシュパターン選択:
  - 1/1（1拍ごと）
  - 1/2（2拍ごと）
  - 1/4（4拍ごと）※デフォルト
  - 1/8（8拍ごと）
- フラッシュの持続時間: 1フレーム〜数フレーム（短いパルス）
- 既存のBPMシステム（bpmManager）のビート情報を使用

**実装ポイント**:
- BPMセクションの近くにUIを配置（ON/OFFボタン + パターンセレクタ）
- フラッシュはポストプロセスとして、最終出力にadditive blendで白を重ねる
- bpmManager の beatCount や currentBeat を参照してタイミングを決定
- フラッシュのopacityは 0→1→0 の短いパルス（50ms程度で減衰）

**ロジック**:
```javascript
// bpmManager のビートイベントを監視
// beatCount % divisor === 0 のときにフラッシュ発火
// divisor: 1/1=1, 1/2=2, 1/4=4, 1/8=8
onBeat(beatCount) {
  if (flashEnabled && beatCount % flashDivisor === 0) {
    flashOpacity = 1.0;
  }
}

// 毎フレーム減衰
update(dt) {
  flashOpacity = Math.max(0, flashOpacity - dt * 20); // 約50msで消える
}
```

---

### TASK-5: 再生コントロール（難易度: 中）

**仕様**:
- 各チャンネル（A/B）の映像に対して:
  - 再生/一時停止ボタン
  - シークバー（現在位置の表示 + ドラッグで移動）
- 既存のSpeed コントロールの近くに配置

**実装ポイント**:
- HTMLVideoElement の `play()`, `pause()`, `currentTime`, `duration` を使用
- シークバーは `<input type="range">` で `min=0`, `max=duration`, `step=0.1`
- 再生中はシークバーが自動で進む（requestAnimationFrame or setIntervalで更新）
- シークバードラッグ中は自動更新を停止
- ISFシェーダーの場合はシークバー非表示（時間ベースなので意味がない）

---

### TASK-6: MIDIラーン（難易度: 高）

**仕様**:
- 任意のUIパラメータにMIDIコントローラーのノブ/フェーダー/ボタンを自由に割り当てられる機能
- 操作フロー:
  1. 「MIDI Learn」ボタンをクリック → ラーンモードに入る
  2. 割り当てたいUI要素（スライダー、ボタン等）をクリック
  3. MIDIコントローラーのノブ/フェーダー/ボタンを操作
  4. そのMIDI CC番号（またはNote番号）が自動的にそのパラメータにマッピングされる
  5. 「MIDI Learn」ボタンを再度クリックでラーンモード終了

- マッピングはlocalStorageに保存し、次回起動時に復元
- マッピングのクリア機能（個別 or 全クリア）

**実装ポイント**:
- 既存のMIDI入力システムを拡張
- ラーンモード中は全UIのクリッカブル要素にハイライト表示
- マッピングデータ構造:
```javascript
// { midiChannel, ccNumber, noteNumber } → { targetType, targetId, min, max }
const midiMappings = {
  "cc-0-1": { target: "crossfader", min: 0, max: 1 },
  "cc-0-7": { target: "dimmerA", min: 0, max: 1 },
  "note-0-60": { target: "bankA-1", type: "trigger" },
};
```
- 既存の固定マッピングとの併存（ラーンマッピングが優先）

---

### TASK-7: メディアブラウザ表示エリア拡大（難易度: 低）

**仕様**:
- メディアブラウザ（ファイルサムネイルグリッド）の表示エリアを拡大
- 現在の高さを約1.5〜2倍にする
- サムネイルサイズは変更しない（数が多く表示されるようになる）
- スクロールの必要性を減らす

**実装ポイント**:
- CSSの `max-height` または `height` を調整
- 他のUIセクション（Bank、Effects等）との配置バランスは後で調整するのでまず広げる

---

## 最終作業

### バージョン更新
- version.js → 1.0.0
- 全HTMLファイルの "v0.8.1" → "v1.0.0" に更新
- バージョン履歴追加:
  "1.0.0": "Channel dimmers, double-click assign, glitch/RGB effects, BPM flash, playback controls, MIDI learn, media browser expansion"

### ビルド
```
npm run build
```

ビルドエラーがないことを確認して完了を報告してください。
各TASK の実装結果（成功/失敗/スキップ）をサマリーとして出力してください。

---

## 注意事項

- 既存機能を壊さないこと（エフェクト、クロスフェーダー、Bank切替、Webcam、ISFシェーダー等）
- パフォーマンスを著しく劣化させないこと（30FPS以上を維持）
- レイアウト/デザインは最小限でOK。機能が動くことを最優先
- エラーが発生したTASKはスキップして次へ進むこと。スキップした理由を記録
- 実装前に既存コードの構造を確認し、既存のパターンに従うこと
