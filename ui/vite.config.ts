import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      // To add only specific polyfills, add them here. If no option is passed, adds all polyfills
      include: ["process"],
      globals: { global: true, process: true },
    }),
  ],
  resolve: {
    alias: {
      "process/": `${__dirname}/node_modules/vite-plugin-node-polyfills/shims/process/`,
    },
  },
});
