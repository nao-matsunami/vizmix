import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// PWA (installable / offline App Shell) is OFF by default.
// The free web build (antymark.com/VizMix/) and the Electron buy-version must
// NOT ship it. Enable only for the future limited / Patreon build:
//     VIZMIX_PWA=1 npm run build
// __PWA__ is injected below; when false, the guarded dynamic import of
// src/pwa.js in main.js is tree-shaken out entirely (no SW, no virtual module).
const PWA_ENABLED = process.env.VIZMIX_PWA === "1";

export default defineConfig({
  base: "./",
  root: ".",
  publicDir: "public",
  appType: "mpa",
  define: {
    __PWA__: JSON.stringify(PWA_ENABLED),
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        control: "index.html",
        output: "output.html",
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  plugins: PWA_ENABLED
    ? [
        VitePWA({
      // Update is user-initiated only (no surprise reloads during a live set).
      // src/pwa.js registers the worker and drives the update prompt.
      registerType: "prompt",
      injectRegister: false,
      // Served under a subpath (antymark.com/VizMix/); relative paths keep it portable.
      manifest: {
        name: "VizMix - Browser VJ",
        short_name: "VizMix",
        description: "Browser-based VJ software. Mix, crossfade and effect video in your browser.",
        lang: "ja",
        start_url: "./?source=pwa",
        scope: "./",
        display: "standalone",
        background_color: "#141414",
        theme_color: "#141414",
        // orientation intentionally unset — VJ use spans both portrait and landscape.
        icons: [
          { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App Shell only: HTML/JS/CSS/GLSL shaders/icons. Video stays out (see globIgnores).
        globPatterns: ["**/*.{js,css,html,glsl,svg,png,ico,woff2,wasm,json}"],
        // Never precache user-facing media — that is what blows up storage.
        globIgnores: ["**/*.mp4", "**/*.webm", "**/*.mov"],
        // playcanvas bundles into a chunk larger than the 2 MiB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // MPA: index.html and output.html are both precached and served at their own
        // URLs offline. No SPA-style catch-all fallback (it would hijack output.html).
        navigateFallback: null,
        // Anything not precached (videos, blob: URLs, external media, GA) falls through
        // to the network untouched — no runtimeCaching rules on purpose.
      },
      // SW stays off during `vite dev` so HMR / the normal dev loop is untouched.
      // Exercise the worker against the real artifact via `npm run build && npm run preview`.
      devOptions: {
        enabled: false,
        type: "module",
      },
        }),
      ]
    : [],
});
