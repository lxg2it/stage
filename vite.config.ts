import { defineConfig } from "vite";

export default defineConfig({
  // The viewer ships a worker and a 2.3 MB WASM binary that it locates with
  // `new URL(..., import.meta.url)`. Vite resolves those correctly only when the
  // package is left alone, so it is kept out of dependency pre-bundling.
  optimizeDeps: { exclude: ["@huggingface/usd-web-viewer"] },
  build: {
    target: "es2022",
    // The WASM binary is emitted as an asset from inside the package; it must not
    // be inlined as base64 (it would be 3 MB of string in the bundle).
    assetsInlineLimit: 0,
  },
});
