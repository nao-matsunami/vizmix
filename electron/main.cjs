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

function createControlWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "VizMix",
    backgroundColor: "#000000",
    webPreferences: sharedWebPreferences,
  });

  // 出力ウィンドウ（window.open('./output.html')）を新規 BrowserWindow として開く。
  // 同origin（dev: localhost:3000 / prod: file://）は内部ウィンドウ、
  // それ以外の外部URLは既定ブラウザへ委譲する。
  win.webContents.setWindowOpenHandler(({ url }) => {
    const isInternal = isDev
      ? url.startsWith(DEV_URL)
      : url.startsWith("file://");
    if (!isInternal) {
      shell.openExternal(url);
      return { action: "deny" };
    }
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
