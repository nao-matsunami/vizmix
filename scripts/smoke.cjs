/**
 * Headless smoke test for the PWA-enabled build.
 * Drives Chrome via the DevTools Protocol (Node built-in WebSocket) to verify:
 *  - the control page boots with no uncaught JS errors / failed module loads
 *  - the service worker registers and becomes active
 *  - a WebGL2 context can be created (PlayCanvas prerequisite)
 *  - core app globals are present (window.getApp, window.videoManager)
 *
 * Usage: node scripts/smoke.cjs <baseUrl>
 */
const http = require("http");

const BASE = process.argv[2] || "http://localhost:4173";
const CDP = "http://localhost:9222";

const getJSON = (url) =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            resolve(d);
          }
        });
      })
      .on("error", reject);
  });

async function main() {
  // Connect to the existing page target (Chrome 111+ blocks GET /json/new).
  const targets = await getJSON(`${CDP}/json/list`);
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page target found");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const errors = [];
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const e = msg.params.exceptionDetails;
      errors.push("EXCEPTION: " + (e.exception?.description || e.text));
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push("console.error: " + msg.params.args.map((a) => a.value || a.description || "").join(" "));
    } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      errors.push("log: " + msg.params.entry.text);
    }
  };

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: BASE + "/index.html" });

  // Let the app boot and the SW register.
  await new Promise((r) => setTimeout(r, 7000));

  const ev = await send("Runtime.evaluate", {
    expression: `(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      const active = regs.some(r => r.active);
      let webgl2 = false;
      try { webgl2 = !!document.createElement('canvas').getContext('webgl2'); } catch(e){}
      return JSON.stringify({
        swCount: regs.length,
        swActive: active,
        webgl2,
        hasGetApp: typeof window.getApp === 'function',
        hasVideoManager: !!window.videoManager,
        title: document.title,
      });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const summary = JSON.parse(evValue(ev));
  console.log("SUMMARY:", JSON.stringify(summary, null, 2));
  console.log("ERRORS (" + errors.length + "):");
  errors.forEach((e) => console.log("  - " + e));
  ws.close();
  process.exit(errors.length === 0 && summary.swActive && summary.webgl2 ? 0 : 1);
}

function evValue(r) {
  return r.result.value;
}

main().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(2);
});
