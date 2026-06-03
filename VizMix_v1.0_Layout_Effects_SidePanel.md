# VizMix v1.0 レイアウト調整指示書 — エフェクトパネル右サイドパネル化

## 概要

現在ページ下部にあるEffectsパネルを、右サイドパネルに移動する。
パネルは開閉トグル可能で、閉じるとメインエリアが全幅に広がる。

**目的**: エフェクト操作中にプレビュー映像が常に見えるようにする（プロVJからのフィードバック対応）

---

## 変更前の構成

```
┌─────────────────────────────────────────────────────┐
│  [Preview A]    [Master Output]    [Preview B]      │
│  (...中略...)                                        │
│  [Media Browser]                                     │
├─────────────────────────────────────────────────────┤
│  Effects ← 下にあってプレビューが見えない            │
└─────────────────────────────────────────────────────┘
```

## 変更後の構成

### パネル開（デフォルト）

```
┌──────────────────────────────────────┬──────────────┐
│                                      │ [FX ✕]      │
│  [Preview A]  [Master]  [Preview B]  │              │
│                                      │  ▸ Color     │
│  [DimA] A ═══●═══ B [DimB]          │  INV GRY SEP │
│                                      │              │
│  BPM [120] [TAP] [Flash]            │  ▸ Adjust    │
│                                      │  Brt [═══]   │
│  [Bank A]          [Bank B]          │  Cnt [═══]   │
│                                      │              │
│  [Media Browser]                     │  ▸ Blur      │
│                                      │  Blur [═══]  │
│                                      │              │
│                                      │  ▸ Glitch    │
│                                      │  Glt [═══]   │
│                                      │  RGB [═══]   │
│                                      │  Mul [═══]🎨 │
└──────────────────────────────────────┴──────────────┘
```

### パネル閉

```
┌────────────────────────────────────────────────[FX]──┐
│                                                      │
│  [Preview A]    [Master Output]    [Preview B]       │
│                                                      │
│  [DimA] A ═══════════●═══════════ B [DimB]           │
│                                                      │
│  BPM [120] [TAP] [Flash]                            │
│                                                      │
│  [Bank A]                    [Bank B]                │
│                                                      │
│  [Media Browser]                                     │
└──────────────────────────────────────────────────────┘
```

---

## 実装手順

### Step 1: HTMLの構造変更（index.html）

既存のEffectsセクションを現在の位置から切り取り、新しいサイドパネル構造に移動する。

```html
<!-- メインコンテナを flexbox に変更 -->
<div id="app-container" style="display: flex; width: 100%; height: 100vh;">

  <!-- 左: メインエリア（既存のコンテンツすべて） -->
  <div id="main-area" style="flex: 1; overflow-y: auto;">
    <!-- 既存の Preview, Crossfader, BPM, Banks, Media Browser -->
    <!-- ※ Effectsセクションはここから削除 -->
  </div>

  <!-- 右: エフェクトサイドパネル -->
  <div id="fx-side-panel" class="fx-panel-open">
    <div id="fx-panel-header">
      <span class="fx-panel-title">EFFECTS</span>
      <button id="fx-panel-close" title="Close Effects Panel">✕</button>
    </div>
    <div id="fx-panel-content">
      <!-- 既存のEffectsの中身をここに移動 -->
      <!-- カテゴリ（Color, Adjust, Blur, Glitch）はそのまま維持 -->
    </div>
  </div>

  <!-- パネル閉時のトグルボタン（パネル外に配置） -->
  <button id="fx-panel-toggle" class="fx-toggle-hidden" title="Open Effects Panel">FX</button>

</div>
```

### Step 2: CSS

```css
/* ===== Effects Side Panel ===== */

#app-container {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

#main-area {
  flex: 1;
  overflow-y: auto;
  transition: flex 0.3s ease;
}

/* --- サイドパネル本体 --- */
#fx-side-panel {
  width: 260px;
  min-width: 260px;
  background: #1a1a2e;       /* 既存の暗い背景に合わせる */
  border-left: 1px solid #333;
  overflow-y: auto;
  transition: width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease;
  display: flex;
  flex-direction: column;
}

#fx-side-panel.fx-panel-closed {
  width: 0;
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

/* --- パネルヘッダー --- */
#fx-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  background: #16213e;
  position: sticky;
  top: 0;
  z-index: 10;
}

.fx-panel-title {
  color: #e94560;            /* VizMixのアクセントカラーに合わせる */
  font-weight: bold;
  font-size: 14px;
  letter-spacing: 1px;
}

#fx-panel-close {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

#fx-panel-close:hover {
  background: #333;
  color: #fff;
}

/* --- パネルコンテンツ --- */
#fx-panel-content {
  padding: 8px;
  flex: 1;
  overflow-y: auto;
}

/* エフェクトのスライダーをサイドパネル幅に合わせる */
#fx-panel-content input[type="range"] {
  width: 100%;
}

/* エフェクトカテゴリの配置を縦積みに調整 */
#fx-panel-content .effect-category {
  margin-bottom: 12px;
}

#fx-panel-content .effect-row {
  display: flex;
  flex-direction: column;  /* サイドパネル内は縦積み */
  gap: 4px;
  margin-bottom: 6px;
}

#fx-panel-content .effect-row label {
  font-size: 11px;
}

/* --- トグルボタン（パネル閉時に表示） --- */
#fx-panel-toggle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  background: #e94560;
  color: #fff;
  border: none;
  padding: 12px 6px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px 0 0 4px;
  z-index: 100;
  letter-spacing: 2px;
  transition: opacity 0.3s ease;
}

#fx-panel-toggle.fx-toggle-hidden {
  opacity: 0;
  pointer-events: none;
}

#fx-panel-toggle:hover {
  background: #c73e54;
}
```

### Step 3: JavaScript（開閉トグルロジック）

```javascript
// Effects Side Panel Toggle
function initFxSidePanel() {
  const panel = document.getElementById('fx-side-panel');
  const closeBtn = document.getElementById('fx-panel-close');
  const toggleBtn = document.getElementById('fx-panel-toggle');

  if (!panel || !closeBtn || !toggleBtn) return;

  // 閉じる
  closeBtn.addEventListener('click', () => {
    panel.classList.add('fx-panel-closed');
    toggleBtn.classList.remove('fx-toggle-hidden');
  });

  // 開く
  toggleBtn.addEventListener('click', () => {
    panel.classList.remove('fx-panel-closed');
    toggleBtn.classList.add('fx-toggle-hidden');
  });

  // キーボードショートカット: Eキーでトグル（既存ショートカットと競合しないか確認）
  document.addEventListener('keydown', (e) => {
    // 入力フォーカス中は無視
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    
    if (e.key === 'e' || e.key === 'E') {
      if (panel.classList.contains('fx-panel-closed')) {
        panel.classList.remove('fx-panel-closed');
        toggleBtn.classList.add('fx-toggle-hidden');
      } else {
        panel.classList.add('fx-panel-closed');
        toggleBtn.classList.remove('fx-toggle-hidden');
      }
    }
  });

  // 状態をlocalStorageに保存/復元
  const saved = localStorage.getItem('vizmix_fx_panel_open');
  if (saved === 'false') {
    panel.classList.add('fx-panel-closed');
    toggleBtn.classList.remove('fx-toggle-hidden');
  }

  // 状態変化時に保存
  const observer = new MutationObserver(() => {
    const isOpen = !panel.classList.contains('fx-panel-closed');
    localStorage.setItem('vizmix_fx_panel_open', isOpen.toString());
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
}

// 既存の初期化処理の中で呼び出す
// initFxSidePanel();
```

### Step 4: 既存エフェクトの移植

1. 現在のEffectsセクション（HTMLブロック全体）を特定する
2. そのブロックを `#fx-panel-content` の中に移動する
3. 元の位置からは削除する
4. 既存のエフェクト制御JS（イベントリスナー、スライダー連動等）は変更不要
   - DOM要素のIDが変わらなければ、JSは自動的に動く
5. CSSだけ、横並びから縦並びに調整する

### Step 5: レスポンシブ対応（最低限）

```css
/* 画面幅が狭い場合はパネル幅を縮小 */
@media (max-width: 1200px) {
  #fx-side-panel {
    width: 220px;
    min-width: 220px;
  }
}

/* 非常に狭い場合はデフォルトで閉じる */
@media (max-width: 900px) {
  #fx-side-panel {
    width: 0;
    min-width: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }
  #fx-panel-toggle {
    opacity: 1;
    pointer-events: auto;
  }
}
```

---

## 注意事項

- **既存のエフェクト機能は一切変更しない**。HTMLの配置場所を移すだけ。
- エフェクトのIDやclass名は変更しないこと（JSのイベントリスナーが壊れる）
- 背景色・アクセントカラーは既存のVizMixデザインに合わせること
  - 既存CSSを確認して `#1a1a2e`, `#16213e`, `#e94560` 等の実際の値を使う
- キーボードショートカット `E` は既存ショートカット（F1-F9等）と競合しないか確認
  - 競合する場合は `Tab` キーまたは別のキーに変更
- TASK-3で追加した新エフェクト（Glitch, RGB Shift, RGB Multiply）も含めて全て移動
- RGB Multiplyのカラーピッカー/プリセットボタンもパネル内に収まるよう調整
- MIDIラーン（TASK-6）のハイライト機能がサイドパネル内でも動作するか確認

---

## テスト項目

- [ ] パネル開閉がスムーズにアニメーションする
- [ ] 閉じた状態でメインエリアが全幅に広がる
- [ ] 開いた状態で全エフェクトが操作可能
- [ ] エフェクトのスライダーがパネル幅に収まる
- [ ] エフェクトON/OFF（F1-F9）が引き続き動作する
- [ ] RGB Multiplyのカラー選択が動作する
- [ ] FXトグルボタンが閉時にのみ表示される
- [ ] localStorage で開閉状態が保存・復元される
- [ ] ブラウザリサイズ時にレイアウトが崩れない
- [ ] Output Window への映像出力に影響がない

---

## ビルド

実装完了後：
```
npm run build
```

エラーがないことを確認して完了報告してください。
