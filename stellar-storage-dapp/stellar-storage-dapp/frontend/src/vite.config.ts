import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // ── Path aliases (mirrors tsconfig.json paths) ──────────────────────────
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
    },
  },

  // ── Node polyfills required by @stellar/stellar-sdk ─────────────────────
  // The Stellar SDK uses Node built-ins (Buffer, process, etc.)
  // Vite runs in the browser, so we shim them here.
  define: {
    global: "globalThis",
    "process.env": {},
  },

  optimizeDeps: {
    include: ["@stellar/stellar-sdk", "@stellar/freighter-api"],
    esbuildOptions: {
      // Allow esbuild to handle CommonJS modules in the Stellar SDK
      target: "es2020",
      define: {
        global: "globalThis",
      },
    },
  },

  build: {
    target: "es2020",
    // Warn if any chunk exceeds 600 kB (Stellar SDK is large)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split Stellar SDK into its own chunk for better caching
        manualChunks: {
          "stellar-sdk": ["@stellar/stellar-sdk"],
          "freighter": ["@stellar/freighter-api"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },

  server: {
    port: 5173,
    open: true,
  },
});