/**
 * VizMix - Electron main process (mac版・未署名 PoC)
 *
 * 役割:
 *  - Control画面（dist/index.html）を BrowserWindow で読み込む
 *  - 出力ウィンドウ（output.html）を window.open 経由で同origin・同webPreferencesの
 *    新規 BrowserWindow として開く（setWindowOpenHandler）
 *
 * 設計上の最重要ポイント（事前調査の結論）:
 *  v1.0 の出力同期は「Control が e.source / outputWindow.document を直接操作して
 *  captureStream の MediaStream を子ウィンドウの <video>.srcObject に接続する」方式。
 *  これが成立するには、output ウィンドウが
 *    1. window.open で開かれ window.opener が Control を指していること
 *    2. Control と同origin（file://）かつ同レンダラプロセスでDOM相互アクセスできること
 *  が必要。setWindowOpenHandler で action:'allow' を返すと Electron は
 *  nativeWindowOpen 相当で同origin window を開き、これらが満たされる。
 *
 * セキュリティ: contextIsolation:true / nodeIntegration:false（v1.0は純ブラウザJSのため緩和不要）
 */

const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

// 開発モード判定（ELECTRON_DEV=1 で Vite devサーバを読む）
const isDev = process.env.ELECTRON_DEV === "1";
const DEV_URL = "http://localhost:3000";

// control / output 共通の webPreferences
const sharedWebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  // captureStream を確実に取得するため backgrounding を抑止
  backgroundThrottling: false,
};

// マニュアル（public/manual/index.html）をアプリ内の専用ウィンドウで開く。
// ディレクトリURL（.../manual/）は file:// では index 解決されないため index.html を明示。
// パッケージ版では app.asar 内のため loadFile（Electronのfileプロトコル）で読む。
function openManualWindow() {
  const manual = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "VizMix - Manual",
    backgroundColor: "#ffffff",
    webPreferences: sharedWebPreferences,
  });

  // 言語選択ページのリンクは `en/` `ja/` というディレクトリ形式。
  // Vite dev も file:// も末尾スラッシュの index 解決をしないため 404 になる。
  // ディレクトリ遷移を index.html に書き換えてから読み込む（dev/packaged 共通）。
  manual.webContents.on("will-navigate", (e, target) => {
    let u;
    try {
      u = new URL(target);
    } catch {
      return;
    }
    if (u.pathname.endsWith("/")) {
      e.preventDefault();
      u.pathname += "index.html";
      manual.loadURL(u.href);
    }
  });

  if (isDev) {
    manual.loadURL(`${DEV_URL}/manual/index.html`);
  } else {
    manual.loadFile(path.join(__dirname, "..", "dist", "manual", "index.html"));
  }
}

function createControlWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "VizMix",
    backgroundColor: "#000000",
    webPreferences: sharedWebPreferences,
  });

  // window.open / target=_blank で開かれるURLを内容で振り分ける。
  //   1) public/manual/ 配下      → アプリ内の専用マニュアルウィンドウ
  //   2) output.html              → 出力ウィンドウ（captureStream/opener ハンドシェイク維持）
  //   3) それ以外の外部URL(http等) → 既定ブラウザ
  // （旧実装は file:// を一律「出力ウィンドウ」扱いし、マニュアルまで巻き込んでいた）
  win.webContents.setWindowOpenHandler(({ url }) => {
    // 1) マニュアル: asar 同梱のため外部ブラウザでは file:// を読めない。
    //    アプリ内ウィンドウで index.html を明示ロードする。
    if (/\/manual(\/|$|\?|#)/.test(url)) {
      openManualWindow();
      return { action: "deny" };
    }

    // 2) 出力ウィンドウ: v1.0 の同期アーキ（e.source/opener の DOM 操作 +
    //    captureStream）が成立するよう、同origin・同webPreferencesで開く。挙動は不変。
    if (/output\.html(\?|#|$)/.test(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 720,
          title: "VizMix - Output",
          backgroundColor: "#000000",
          webPreferences: sharedWebPreferences,
        },
      };
    }

    // 3) その他（外部http/https 等）→ 既定ブラウザへ委譲
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  createControlWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
