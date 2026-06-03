# VizMix Electron化 実装指示書（mac版・未署名）

**対象**: Claude Code（実装担当 / このMac mini 上でローカル実行）
**指示者**: Claude.ai（director / orchestrator）
**対象リポジトリ**: vizmix（`/Users/nao/ai-workspace/claude/projects/vizmix`）
**前提環境**: Mac mini M4 (Apple Silicon) / Node v26 / npm 11 / Vite 6 / 既存Web版はMac上で起動確認済み

---

## 0. このドキュメントの位置づけ

【指示】本書は「VizMix v1.0 のWeb版を Electron で包み、**未署名の mac 版 .dmg が手元で起動する**」ところまでのみを扱う。以下には着手しない。

- ❌ Windows版（.exe）のビルド ← mac版完成後に別指示書で扱う
- ❌ コード署名 / 公証（notarization） ← Windows版の後に検討
- ❌ 自動アップデート機構（electron-updater等）
- ❌ 機能追加・UI改修（v1.0の挙動を一切変えない）
- ❌ BOOTH等への出品作業（director側で別途対応）

【判断】「まず手元で起動する未署名版」を最短で作り、売り物の実体を確定させることを最優先する。署名・配布の判断はその後。Naoの方針「結果が全て / まず売って反応を見る」に従う。

---

## 1. スコープ

### 1.1 やること

- [ ] Electron と electron-builder を devDependencies に追加
- [ ] メインプロセス `electron/main.js` を作成（control画面の起動）
- [ ] MPA構成（index.html = control / output.html = output）への対応
- [ ] 既存の「出力ウィンドウ起動方式」を Electron 環境で機能させる
- [ ] `package.json` に Electron 起動・ビルド用 scripts を追加
- [ ] electron-builder 設定（mac / dmg / arm64・未署名）
- [ ] 仮アイコン用意（本番アイコンは後日差し替え前提）
- [ ] `npm run dist:mac` で `.dmg` が生成され、起動・操作できることの確認

### 1.2 やらないこと

- 1.0節の❌項目すべて
- v1.0のJS/シェーダー/HTMLのロジック変更（包むだけ。中身は触らない）

---

## 2. 事前調査（実装前に必ず実施）

【指示】コードを書く前に、既存実装の以下を読んで把握すること。推測で実装せず、実コードに合わせる。

1. **output.html の開き方**: `index.html` および `src/` 配下で、output.html をどう開いているか（`window.open` / iframe / その他）を特定する。captureStream による出力同期アーキがあるため、その起動経路を壊さないことが最重要。
2. **絶対パス参照の有無**: コード内に `/` 始まりの絶対パス（`fetch('/shaders/...')` 等）があれば、`file://` 環境で壊れる候補。`base: './'` は設定済みだが、JS内のfetch等は別途要確認。
3. **ブラウザ専用API依存**: `localStorage` / IndexedDB / `navigator.mediaDevices`（webcam）/ captureStream など。Electron（Chromium同梱）でほぼ動くが、webカメラ・画面共有まわりは権限挙動が異なる場合があるため要メモ。

【判断】特に output.html の起動経路は、Electron で `window.open` がデフォルトで新規Chromeウィンドウを開く挙動になるため、ここが今回の最大の技術リスク。事前調査の結論を完了報告に含めること。

---

## 3. 実装手順（Step形式）

### Step 1: 依存追加（Day 1）

```
npm install --save-dev electron electron-builder
```

- Electron は Apple Silicon ネイティブ版が入ることを確認（`arch -arm64` 前提）
- インストール後 `npx electron --version` でバージョン確認

### Step 2: メインプロセス作成（Day 1-2）

- `electron/main.js` を新規作成
- 役割:
  - Vite のビルド成果物（`dist/index.html`）を `loadFile` で読み込む
  - 開発時は `loadURL('http://localhost:3000')` を使えるよう、環境変数（例 `ELECTRON_DEV=1`）で分岐
  - ウィンドウサイズ初期値・メニュー最小化など最低限のみ
- セキュリティ: `contextIsolation: true` を基本とする。ただしv1.0のコードが `nodeIntegration` 前提でない（純粋なブラウザJSの）ため、原則 nodeIntegration は false。もし既存コードが動かない場合のみ最小限緩和し、その旨を報告。

【判断】v1.0は素のブラウザJSなので、Node API を使っていないはず。ならば contextIsolation: true / nodeIntegration: false の安全側構成で動くはず。動かなければ事前調査3の依存が原因なので切り分けること。

### Step 3: output.html（出力ウィンドウ）対応（Day 2-3）

- 事前調査1で特定した「出力ウィンドウ起動経路」を Electron で機能させる
- `window.open('output.html')` 方式の場合:
  - メインプロセスで `setWindowOpenHandler` を実装し、output.html を新規 BrowserWindow として開く
  - 出力ウィンドウにも control と同じ webPreferences を適用
  - dist 配下の output.html を `file://` で正しく解決できること
- captureStream / BroadcastChannel による同期が Electron 内の2ウィンドウ間で機能することを確認

【検証】control画面で素材を再生 → 出力ウィンドウに同じ映像が出る、をElectron上で再現できること。

### Step 4: package.json 整備（Day 3）

- `version` を `0.5.0` → `1.0.0` に更新（実体に合わせる）
- `main` フィールドに `electron/main.js` を指定
- scripts 追加（既存の dev/build/preview は残す）:
  - `electron:dev` … Viteのdevサーバを立てつつ Electron を dev モードで起動
  - `electron:start` … dist をビルド済みの前提で Electron 起動（動作確認用）
  - `dist:mac` … `vite build` → `electron-builder --mac` の順で .dmg 生成
- electron-builder 設定（package.json の `build` キー、または `electron-builder.yml`）:
  - `appId`: 例 `com.antymark.vizmix`
  - `productName`: `VizMix`
  - `directories.output`: `release/`（dist と混ざらないよう分離）
  - `files`: dist と electron/ を含める
  - `mac.target`: `dmg`
  - `mac.arch`: `arm64`
  - 署名無効化: `mac.identity: null`（未署名を明示）

【判断】出力先を `dist/`（Viteの成果物）と分けて `release/` にするのは、ビルド成果物の衝突を避けるため。`.gitignore` に `release/` を追加すること。

### Step 5: 仮アイコン（Day 3）

- 本番アイコンは後日。今回は起動確認が目的なので仮アイコンでよい
- `.icns` 形式の仮アイコンを `build/icon.icns` 等に配置（無くてもビルドは通るが警告が出る）
- 本番アイコン差し替えはdirector側で素材用意後に対応する旨をコメントで残す

### Step 6: ビルド・起動確認（Day 4）

```
npm run dist:mac
```

- `release/` に `VizMix-1.0.0-arm64.dmg`（名称は設定依存）が生成されること
- .dmg を開き、VizMix.app を Applications にドラッグ → 起動
- 未署名のため初回は「開発元を確認できない」警告が出る → 右クリック「開く」で起動できることを確認（これは想定内・正常）

---

## 4. 受入条件（チェックリスト）

### 4.1 ビルド

- [ ] `npm run dist:mac` がエラーなく完了する
- [ ] `release/` に arm64 の .dmg が生成される
- [ ] .dmg から VizMix.app をインストールできる

### 4.2 起動・動作

- [ ] 未署名警告を回避（右クリック→開く）すれば VizMix.app が起動する
- [ ] control画面（index.html相当）が正常表示される
- [ ] 出力ウィンドウ（output.html相当）が開ける
- [ ] control→output の映像同期がWeb版と同等に動く
- [ ] 素材バンク・クロスフェーダー等のv1.0基本機能が動作する
- [ ] webcam入力が動く（権限ダイアログが出たら許可）。動かない場合はその旨を報告（今回は許容、Windows版前に対処判断）

### 4.3 リグレッション

- [ ] `npm run dev`（既存Web版）が従来どおり起動する（Electron化でWeb版を壊していない）
- [ ] Git差分が electron/ 追加・package.json更新・vite.config調整・.gitignore更新の範囲に収まる（v1.0ロジック改変なし）

---

## 5. 設計上の注意点

### 5.1 file:// とパス解決
- `base: './'` 設定済みのためHTML/CSSの相対参照は概ね問題ない
- 注意は **JS内の fetch/XHR の絶対パス**。`fetch('/shaders/01_...')` のような記述があれば相対化が必要
- public/ のアセットは dist 直下にコピーされる前提。Electronは dist をルートとして読む

### 5.2 出力ウィンドウ（最重要リスク）
- Web版の `window.open` は Electron では setWindowOpenHandler の制御下に入る
- ここを正しく繋がないと「出力ウィンドウが開かない / 真っ白」になる
- captureStream はElectron内でも有効だが、2ウィンドウ間のストリーム受け渡しが file:// 環境で機能するか実機確認必須

### 5.3 セキュリティ設定
- 原則 contextIsolation: true / nodeIntegration: false
- v1.0が純ブラウザJSなら緩和不要。緩和した場合は理由を報告

### 5.4 バージョン管理
- 実装はブランチを切って行う（例 `feature/electron-mac`）
- v1.0の動作する master を壊さないこと

---

## 6. リスクと対応

| リスク | 兆候 | 対応 |
|---|---|---|
| 出力ウィンドウが開かない | output画面が真っ白/出ない | setWindowOpenHandler の実装見直し、file://パス確認 |
| アセット読込失敗 | シェーダー/素材が出ない | JS内の絶対パスを相対化、dist構成確認 |
| webcam不動作 | 映像入力が黒 | Electronのmedia権限・getUserMedia挙動を確認（今回は許容範囲・報告のみ） |
| ビルドがarm64でなくx64 | Rosetta下で動作 | electron / electron-builder のarch指定確認 |
| 未署名警告でユーザーが起動できない | 配布後のサポート負荷 | BOOTH説明文に回避手順記載（director対応）。署名は後フェーズ |

---

## 7. 完了報告フォーマット（Claude Code → Claude.ai）

実装完了時、以下を報告：

1. 受入条件チェックリストの完了状況
2. 事前調査（第2節）の結論 — 特に output.html 起動経路と絶対パスの有無
3. `release/` に生成された .dmg のファイル名とサイズ
4. 起動・動作確認の結果（control / output / webcam の各可否）
5. 実装中に発見した問題と判断
6. Windows版（次フェーズ）に向けた引継ぎ事項

---

## 8. SSOT

参照規則:
- R0 / R0a / R0b（DR必須・順序・根拠付き）
- R1（要点のみ）/ R2（【指示】【判断】分離）/ R3（コマンドは1ブロック）/ R4（Step形式）
- R7（SSOT末尾）/ R9（未確認情報を断定しない → output.html起動経路は実コード確認に委ねる）
- CLAUDE.md（Claude=実装、Claude.ai=director）
- SPEC_WB_VJ.md（v1.0スコープのElectron配布化。機能拡張はしない）
- 戦略書（VizMix_3ヶ月戦略書.docx）Section 3.1（Electron版=Pro/買切の実体）/ Month 2 のElectron化PoC
- userMemory（結果が全て / まず売る / PoC before decision / mac版優先・未署名から / Windows版と署名は後フェーズ）
