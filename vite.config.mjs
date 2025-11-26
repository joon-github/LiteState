import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.js",
      name: "LiteReact",
      fileName: (format) => `lite-react.${format}.js`,
      formats: ["es", "umd"],
    },
    rollupOptions: {
      // If you add external dependencies later, declare them here
      external: [],
      output: {
        globals: {},
      },
    },
  },
});

