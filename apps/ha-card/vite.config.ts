import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    minify: true,

    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "home-voice-agent.js",
    },

    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
