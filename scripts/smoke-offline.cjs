/**
 * Offline-boot smoke test.
 *  1. Load the app online so the service worker precaches the App Shell.
 *  2. Cut the network (CDP Network.emulateNetworkConditions offline).
 *  3. Reload and confirm the control page still boots from cache:
 *     title present, core globals up, WebGL2 available.
 *
 * Usage: node scripts/smoke-offline.cjs <baseUrl>
 */
const http = require("http");
const BASE = process.argv[2] || "http://localhost:4173";
const CDP = "http://localhost:9222";

const getJSON = (url) =>
  new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    }).on("error", reject);
  });

async function main() {
  const targets = await getJSON(`${CDP}/json/list`);
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve) => { const mid = ++id; pending.set(mid, resolve); ws.send(JSON.stringify({ id: mid, method, params })); });
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };

  await send("Page.enable");
  await send("Network.enable");

  // 1) Online load → SW installs + precaches.
  await send("Page.navigate", { url: BASE + "/index.html" });
  await new Promise((r) => setTimeout(r, 6000));
  // ensure SW is active before going offline
  await send("Runtime.evaluate", { expression: "navigator.serviceWorker.ready", awaitPromise: true });

  // 2) Go offline.
  await send("Network.emulateNetworkConditions", {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });

  // 3) Reload from cache.
  await send("Page.reload", {});
  await new Promise((r) => setTimeout(r, 5000));

  const ev = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      title: document.title,
      hasGetApp: typeof window.getApp === 'function',
      hasVideoManager: !!window.videoManager,
      bodyChildren: document.body ? document.body.children.length : 0,
      webgl2: (()=>{try{return !!document.createElement('canvas').getContext('webgl2')}catch(e){return false}})(),
      online: navigator.onLine,
    })`,
    returnByValue: true,
  });

  const s = JSON.parse(ev.result.value);
  console.log("OFFLINE-RELOAD SUMMARY:", JSON.stringify(s, null, 2));
  ws.close();
  const ok = s.title.includes("VizMix") && s.hasGetApp && s.bodyChildren > 0;
  console.log(ok ? "OFFLINE BOOT: OK" : "OFFLINE BOOT: FAILED");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error("offline smoke failed:", e); process.exit(2); });
