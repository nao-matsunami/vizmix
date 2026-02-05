import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  root: ".",
  publicDir: "public",
  appType: "mpa",
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
});
