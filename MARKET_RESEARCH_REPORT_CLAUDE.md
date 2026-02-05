# VizMix Market Research Report
## Browser-Based VJ Software & Assets Market Analysis

**作成日**: 2025年12月27日
**作成者**: Claude Code (Market Research Agent)
**対象プロジェクト**: ebay_project / VizMix

---

## Executive Summary

ブラウザベースVJソフトウェア市場は急速に発展しており、WebGL/WebGPU技術の進化により、従来のネイティブアプリケーションに匹敵するパフォーマンスが実現可能になっている。本レポートでは、海外・国内の競合分析、素材トレンド、ビジネスモデル、そしてVizMixへの戦略提案を行う。

---

## 1. 競合調査：ブラウザ型VJソフト

### 1.1 海外勢の分析

| ツール名 | 技術スタック | 価格モデル | 主要機能 | ターゲット |
|---------|-------------|-----------|---------|-----------|
| **[VISUALZ](https://www.visualzstudio.com/)** | WebGL, Web Audio, WebRTC | Freemium ($4-9/月 or $48/年) | オーディオ反応、モバイルコントローラー、FanCam | DJ/VJ/アーティスト全般 |
| **[Hydra](https://hydra.ojack.xyz/)** | JavaScript→WebGL | 無料・OSS | ライブコーディング、アナログシンセ風API、マルチウィンドウ共有 | コード志向アーティスト |
| **[cables.gl](https://cables.gl/)** | WebGL, Node-based | 無料・OSS (2024年8月〜) | ノードベース、3D/VR対応、MIDI | ビジュアルプログラマー |
| **[modV](https://github.com/2xAA/modV)** | Electron, WebGL, Vue | 無料・OSS | モジュラー構造、ISF対応、NDI出力 | 中級〜上級VJ |
| **[hedron](https://github.com/nudibranchrecords/hedron)** | Three.js | 無料・OSS | MIDI入力、3Dシーンレイヤリング | 3Dビジュアル志向 |
| **[VDO.Ninja](https://vdo.ninja/)** | WebRTC | 無料 | P2P映像転送、NDI出力（Vingester経由） | 配信者/リモート連携 |

#### 海外勢の特徴的な機能

1. **VISUALZ**
   - モバイルデバイスをコントローラーとして使用可能
   - FanCam機能：観客のセルフィーをリアルタイム投影
   - OBSへの直接出力対応

2. **Hydra**
   - アナログモジュラーシンセ風の構文設計
   - 4つの独立出力バッファ（o0〜o3）
   - WebRTCによるウィンドウ間共有
   - Three.js、Tone.js、P5.jsとの統合可能

3. **cables.gl**
   - 2024年8月にMITライセンスでOSS化
   - オフライン版（スタンドアロン）も提供
   - ノードベースで低コード/ノーコード対応

### 1.2 日本勢の分析

| ツール名 | 技術スタック | 価格モデル | 主要機能 | ターゲット |
|---------|-------------|-----------|---------|-----------|
| **[SynapseRack](https://synapserack.com/)** | Unity | ¥12,000 (無料版あり) | レイヤー合成、マスキング、マッピング、HAP対応 | 日本のVJコミュニティ |
| **WebVJ** | HTML/JS | 無料 | ブラウザ完結、緊急時対応向け | アニクラVJ/初心者 |
| **簡易VJツール** | HTML/JS | 無料 | 最小構成、OBS連携 | 超初心者/緊急用途 |

#### SynapseRackの詳細分析

**開発者**: Saina Key (椎名カンタ)

**主要機能**:
- 4レイヤー＋2グループレイヤー（無料版）
- クロスフェードループ
- Beat Sync機能
- MIDI対応（nanoKONTROL2、Launch Control XL）
- Spout Browser機能（v0.3.1〜）
- HAP/DXVコーデック対応

**無料Webアプリ**: ブラウザで手軽にVJ体験可能

### 1.3 外部連携機能の比較

| ツール | MIDI | OSC | Spout/Syphon | NDI |
|-------|------|-----|--------------|-----|
| VISUALZ | ○ | - | - | - |
| Hydra | ○ (WebMIDI) | - | - | - |
| cables.gl | ○ | - | - | - |
| modV | ○ | - | - | ○ |
| SynapseRack | ○ | - | ○ (Spout) | - |
| VDO.Ninja | - | - | - | ○ (Vingester経由) |

---

## 2. 素材（Assets）のトレンド分析

### 2.1 プラットフォーム別市場規模

#### Gumroad
- VJ loops: **1,375製品**
- VJ clip: **753製品**
- VJ pack: **450製品**
- 主要フォーマット: MOV (824), MP4 (718)

#### BOOTH
- 3Dモデルカテゴリ取扱高: **58億円超**（2024年、前年比187%成長）
- VJ素材は「検索すれば多数見つかる」が、VRChat関連が圧倒的

### 2.2 視覚的トレンド分析

| スタイル | 人気度 | 主な用途 | 特徴 |
|---------|-------|---------|------|
| **幾何学 (Geometric)** | ★★★★★ | テクノ、EDM全般 | シンプルで汎用性高い |
| **ライン (Lines)** | ★★★★☆ | ミニマル、グリッチ | エレガント、明るいアクセント |
| **グリッチ** | ★★★★★ | テクノ、アンダーグラウンド | 「不滅のトレンド」とされる |
| **ノイズ** | ★★★★☆ | アンビエント、実験的 | 視覚的テクスチャとして |
| **グリッド** | ★★★☆☆ | レトロ、サイバー | 80年代風リバイバル |

### 2.3 線の太さ（Line Thickness）の使い分け

| 線の種類 | 用途 | 雰囲気 |
|---------|------|-------|
| **極細線 (Hairline)** | ミニマル、高級感 | 繊細、現代的、洗練 |
| **細線** | 幾何学、グリッド | クリーン、テクニカル |
| **中太線** | ダイナミック、アクション | エネルギッシュ |
| **太線** | グラフィティ、ストリート | 大胆、インパクト |

> **市場のギャップ**: 極細線（Hairline）の幾何学素材は供給が少なく、差別化ポイントとなり得る

### 2.4 ファイルフォーマット需要

| フォーマット | プロ需要 | ブラウザ対応 | 特徴 |
|-------------|---------|-------------|------|
| **HAP/HAP Q/HAP Alpha** | ★★★★★ | ✗ | GPU高速デコード、Resolume標準 |
| **DXV3** | ★★★★☆ | ✗ | Resolume専用、高効率 |
| **MOV (ProRes)** | ★★★★☆ | △ | 高品質、ファイル大 |
| **MP4 (H.264)** | ★★★☆☆ | ○ | 汎用性高い |
| **WebM (VP9/AV1)** | ★★☆☆☆ | ○ | 透過対応、ブラウザネイティブ |

---

## 3. ビジネスモデルとブランディングの解析

### 3.1 収益モデル比較

| モデル | 代表例 | 特徴 | 向いている規模 |
|-------|-------|------|--------------|
| **永続ライセンス** | Resolume (€299-€799), VDMX ($199) | 一度の購入、アップグレード有料 | 確立されたプロダクト |
| **サブスクリプション** | VISUALZ ($4-9/月) | 継続収益、低い初期障壁 | 成長中のサービス |
| **Freemium** | SynapseRack (無料版＋¥12,000) | 無料で認知獲得、機能制限で誘導 | 新規参入者 |
| **完全無料/OSS** | Hydra, cables.gl, modV | コミュニティ形成、寄付/スポンサー | 開発者主導 |
| **素材ストア連携** | Resolume | 本体＋素材販売の複合収益 | プラットフォーム型 |

### 3.2 Resolumeの「DXVトラップ」

Resolumeユーザーは独自コーデック（DXV）に依存し、エコシステムにロックインされる傾向がある。これにより:
- 毎年のアップグレード料金が実質的なサブスク化
- Black Friday割引が50%→35%に縮小
- 他ソフトへの移行コストが高い

### 3.3 プロ向け vs アマチュア向けブランディング

| 要素 | プロ向け | アマチュア向け |
|------|---------|--------------|
| **UIカラー** | ダーク、モノクロ基調 | カラフル、親しみやすい |
| **ロゴ** | シンプル、幾何学的 | 遊び心、イラスト風 |
| **用語** | 専門用語そのまま | わかりやすい言い換え |
| **デモ動画** | テクニカル、ショーケース | チュートリアル、親しみやすさ |
| **価格** | プレミアム（€300+） | 低価格/無料 |
| **Night Mode** | 必須（現場での光反射防止） | オプション |

#### DJVJ（CREMA Studio）のUI設計事例

- **デフォルトNight Mode**: 夜間環境での使用を想定
- **Day Mode**: 明るい環境対応で使い分け可能
- **ターゲット**: アマチュア〜セミプロを明確に意識

---

## 4. ebay_projectへの適用提案

### 4.1 「極細線の幾何学素材（WAV同梱）」の差別化戦略

#### 現状の市場ポジション分析

```
        高価格
           │
   Resolume素材 ●    ● LIME ART GROUP
           │
           │        ● VJ Loops Farm
   ────────┼────────────────────────
           │    ？ ← あなたの素材
           │ ● BOOTH日本素材
           │
        低価格

   汎用的 ─────────── 特化型
```

#### 推奨差別化ポイント

| 要素 | 戦略 |
|------|------|
| **視覚スタイル** | 極細線＋日本的ミニマリズム（和モダン） |
| **音声連動** | WAV同梱による「素材＋BPM情報」のセット販売 |
| **フォーマット** | HAP + WebM（プロ＆ブラウザ両対応） |
| **価格帯** | $15-30（Gumroad中価格帯、BOOTH ¥2,000-5,000） |
| **ネーミング** | 「Hairline Geometry Pack」「極線 / KYOKUSEN」 |

#### ブランディング提案

1. **プロダクト名**: **KYOKUSEN** (極線)
   - 日本語のユニークさ＋意味の明確さ
   - 海外市場での差別化

2. **ターゲットメッセージ**:
   > "Precision meets minimalism. Ultra-fine geometric loops synced to BPM."

3. **販売チャネル**:
   - **Gumroad**: 海外VJ向け、英語メイン
   - **BOOTH**: 国内アニクラ/インディーVJ向け
   - **itch.io**: インディーゲーム開発者への横展開

### 4.2 VizMixに実装すべき「キラー機能」3選

海外勢に勝つための差別化機能を提案する。

---

#### Killer Feature 1: **BPM-Synced Shader Presets with WAV Bundling**

**概要**: シェーダープリセットにBPM情報を含むWAVファイルを紐付け、自動ビートシンク

**実装イメージ**:
```javascript
// シェーダープリセットのメタデータ構造
{
  "name": "Kyokusen Grid 01",
  "shader": "grid_pulse.glsl",
  "audio": "grid_pulse_120bpm.wav",
  "bpm": 120,
  "beatMarkers": [0.0, 0.5, 1.0, 1.5, ...],
  "autoSync": true
}
```

**差別化理由**:
- Hydraにはオーディオ反応はあるがプリセット＋音声のバンドルはない
- VISUALZのオーディオ反応は汎用的で、特化型プリセットではない
- 「素材を買えばすぐ使える」体験を提供

**技術的アプローチ**:
- Web Audio APIでBPM検出
- シェーダーuniformにbeat位相を注入
- プリセットマーケットプレイスへの展開可能性

---

#### Killer Feature 2: **Japanese Aesthetic Shader Library (和シェーダー)**

**概要**: 日本的美学に特化したシェーダーライブラリ

**コンセプト**:
| シェーダー名 | 特徴 |
|------------|------|
| **枯山水 (Karesansui)** | 砂紋パターン、禅的ミニマル |
| **格子 (Koushi)** | 障子/襖の幾何学 |
| **波紋 (Hamon)** | 水面リップル、極細線 |
| **組紐 (Kumihimo)** | 編み込みパターン |
| **霞 (Kasumi)** | ノイズベースの霧 |

**差別化理由**:
- 海外ツールは「西洋的サイケデリック」か「テック・グリッチ」に偏向
- 日本発ツールとしてのアイデンティティ確立
- アニクラ/和風イベントでの強い需要

**技術的アプローチ**:
- Shadertoyからの移植ではなく、オリジナル開発
- 日本の伝統柄をGLSLで再解釈
- 「和シェーダーコンテスト」などのコミュニティ形成

---

#### Killer Feature 3: **Zero-Latency Mobile Controller with Haptic Feedback**

**概要**: スマートフォンをハプティック（振動）フィードバック付きコントローラーとして使用

**実装イメージ**:
```
[PC Browser: VizMix]  ←─ WebRTC ─→  [Mobile: Controller App]
        ↓                                    ↓
   映像出力                           触覚フィードバック
                                      (ビートに合わせて振動)
```

**差別化理由**:
- VISUALZにもモバイルコントローラーはあるが、ハプティックは未対応
- DJがターンテーブルに触覚を持つように、VJにも「触れる」体験を
- 専用ハードウェア不要（スマホで完結）

**技術的アプローチ**:
- Vibration API（ほとんどのモバイルブラウザ対応）
- WebRTCで低遅延通信
- タッチジェスチャーでクロスフェーダー/エフェクト操作

---

## 5. 競合優位性マトリクス

VizMixが目指すべきポジショニング:

```
              コード志向
                 │
        Hydra ●  │  ● cables.gl
                 │
                 │
   ──────────────┼──────────────
                 │
      VizMix ◎  │  ● VISUALZ
      (目標)    │
                 │  ● SynapseRack
                 │
              GUI志向

   日本特化 ────────── グローバル汎用
```

**VizMixの目標ポジション**:
- GUI志向（コード不要）
- 日本市場を足がかりにグローバル展開
- 「和」を差別化要素に

---

## 6. アクションプラン

### Phase 1: 素材販売（即時〜1ヶ月）
- [ ] KYOKUSEN Vol.1（極細線幾何学10ループ＋WAV）をGumroad/BOOTHで販売開始
- [ ] 価格: $19.99 / ¥2,980
- [ ] HAP + WebM + MP4の3フォーマット同梱

### Phase 2: VizMix機能強化（1〜3ヶ月）
- [ ] BPM-Synced Shader Presetsの実装
- [ ] 和シェーダー5種の開発
- [ ] モバイルコントローラーのプロトタイプ

### Phase 3: コミュニティ形成（3〜6ヶ月）
- [ ] 「VizMix Shader Contest」開催
- [ ] Discord/Slackコミュニティ立ち上げ
- [ ] アニクラ/テクノイベントでの実地テスト

---

## 7. 参考リソース

### 海外VJツール
- [VISUALZ](https://www.visualzstudio.com/)
- [Hydra](https://hydra.ojack.xyz/)
- [cables.gl](https://cables.gl/)
- [modV](https://github.com/2xAA/modV)
- [VDO.Ninja](https://vdo.ninja/)

### 日本VJツール
- [SynapseRack](https://synapserack.com/)

### 素材マーケット
- [Gumroad VJ Loops](https://gumroad.com/?tags=vj+loops)
- [BOOTH VJ素材](https://booth.pm/)
- [VJ Loops Farm](https://vjloopsfarm.com/)
- [LIME ART GROUP](https://limeartgroup.com/)

### 記事・チュートリアル
- [VJ UNION - New Wave of VJing](https://vjun.io/vdmo/the-new-wave-of-vjing-8-projects-pushing-live-visuals-forward-l1f)
- [CDM - cables.gl Open Source](https://cdm.link/2024/08/cables-gl-open-offline/)
- [Resolume vs VDMX 比較](https://projectileobjects.com/2025/11/28/resolume-vs-vdmx-vs-madmapper-vs-touchdesigner-which-live-visuals-software-and-why/)

---

**Report Generated by Claude Code**
*Market Research Agent for ebay_project / VizMix*
