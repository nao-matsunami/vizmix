/**
 * VizMix PWA client glue.
 *
 * Responsibilities (all additive — must never break the core app):
 *  - Register the service worker (App Shell offline cache).
 *  - Show a *manual* update prompt when a new version is waiting.
 *    Never auto-reloads: a surprise reload mid-set would be an accident.
 *  - Show a discreet offline banner (new media can't be fetched; already
 *    loaded / IndexedDB media still works).
 *  - Offer an install button via beforeinstallprompt, or iOS "Add to Home
 *    Screen" instructions where that event is unavailable.
 *
 * Everything is wrapped so a failure here can never take down the VJ app.
 */
import { registerSW } from "virtual:pwa-register";

const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

function isIOS() {
  const ua = window.navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch.
  const iPadOS = ua.includes("Macintosh") && "ontouchend" in document;
  return iOSDevice || iPadOS;
}

/* ---------- minimal styles, injected once ---------- */
function injectStyles() {
  if (document.getElementById("pwa-style")) return;
  const css = `
  .pwa-toast-wrap{position:fixed;right:16px;bottom:16px;z-index:2147483000;
    display:flex;flex-direction:column;gap:8px;align-items:flex-end;
    font-family:"Segoe UI",sans-serif;pointer-events:none}
  .pwa-toast{pointer-events:auto;background:#2a2a2a;color:#fff;border:1px solid #444;
    border-radius:8px;padding:10px 14px;box-shadow:0 4px 16px rgba(0,0,0,.4);
    font-size:13px;display:flex;gap:12px;align-items:center;max-width:320px}
  .pwa-toast button{background:#0066cc;border:none;color:#fff;padding:6px 12px;
    border-radius:5px;cursor:pointer;font-size:13px;white-space:nowrap}
  .pwa-toast button:hover{background:#0077ee}
  .pwa-toast button.pwa-ghost{background:transparent;color:#aaa;padding:6px 6px}
  .pwa-toast button.pwa-ghost:hover{color:#fff}
  .pwa-offline{position:fixed;left:50%;top:0;transform:translateX(-50%);
    z-index:2147483000;background:#5a3a00;color:#ffd699;border:1px solid #7a5a20;
    border-top:none;border-radius:0 0 8px 8px;padding:5px 14px;font-size:12px;
    font-family:"Segoe UI",sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)}
  `;
  const el = document.createElement("style");
  el.id = "pwa-style";
  el.textContent = css;
  document.head.appendChild(el);
}

function toastWrap() {
  let w = document.getElementById("pwa-toast-wrap");
  if (!w) {
    w = document.createElement("div");
    w.id = "pwa-toast-wrap";
    w.className = "pwa-toast-wrap";
    document.body.appendChild(w);
  }
  return w;
}

/* ---------- offline indicator ---------- */
function setupOfflineIndicator() {
  let banner = null;
  const render = () => {
    if (navigator.onLine) {
      if (banner) {
        banner.remove();
        banner = null;
      }
      return;
    }
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "pwa-offline";
      banner.textContent =
        "オフライン：素材の新規ネット読込は不可（読込済み素材は使用可）";
      document.body.appendChild(banner);
    }
  };
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  render();
}

/* ---------- install prompt ---------- */
function setupInstall() {
  if (isStandalone) return; // already installed — no install UI

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallToast();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    const t = document.getElementById("pwa-install-toast");
    if (t) t.remove();
  });

  function showInstallToast() {
    if (document.getElementById("pwa-install-toast")) return;
    const t = document.createElement("div");
    t.id = "pwa-install-toast";
    t.className = "pwa-toast";
    const label = document.createElement("span");
    label.textContent = "VizMix をインストールできます";
    const install = document.createElement("button");
    install.textContent = "インストール";
    install.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (_) {}
      deferredPrompt = null;
      t.remove();
    };
    const dismiss = document.createElement("button");
    dismiss.className = "pwa-ghost";
    dismiss.textContent = "✕";
    dismiss.onclick = () => t.remove();
    t.append(label, install, dismiss);
    toastWrap().appendChild(t);
  }

  // iOS Safari has no beforeinstallprompt — show manual instructions instead.
  if (isIOS()) {
    const t = document.createElement("div");
    t.id = "pwa-ios-toast";
    t.className = "pwa-toast";
    const label = document.createElement("span");
    label.innerHTML =
      'ホーム画面に追加：<b>共有</b>ボタン → <b>「ホーム画面に追加」</b>';
    const dismiss = document.createElement("button");
    dismiss.className = "pwa-ghost";
    dismiss.textContent = "✕";
    dismiss.onclick = () => t.remove();
    t.append(label, dismiss);
    toastWrap().appendChild(t);
  }
}

/* ---------- update prompt (manual, never auto) ---------- */
function setupUpdate() {
  const updateSW = registerSW({
    onNeedRefresh() {
      const t = document.createElement("div");
      t.id = "pwa-update-toast";
      t.className = "pwa-toast";
      const label = document.createElement("span");
      label.textContent = "新しいバージョンがあります";
      const update = document.createElement("button");
      update.textContent = "更新";
      update.onclick = () => {
        update.disabled = true;
        // skipWaiting + reload — only on this explicit user action.
        updateSW(true);
      };
      const later = document.createElement("button");
      later.className = "pwa-ghost";
      later.textContent = "後で";
      later.onclick = () => t.remove();
      t.append(label, update, later);
      toastWrap().appendChild(t);
    },
    onRegisterError(err) {
      console.warn("[PWA] SW registration failed:", err);
    },
  });
}

export function initPWA() {
  try {
    injectStyles();
    setupOfflineIndicator();
    setupInstall();
    setupUpdate();
  } catch (err) {
    // Never let PWA glue break the app.
    console.warn("[PWA] init skipped:", err);
  }
}
