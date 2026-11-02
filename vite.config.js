import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { isServerSupabaseKey } from "./src/utils/supabaseCredentials.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (isServerSupabaseKey(env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error("VITE_SUPABASE_ANON_KEY contém uma chave administrativa. Use a chave pública anon/publishable; chaves service_role/secret devem existir apenas no servidor.");
  }
  return {
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["echarts", "echarts-for-react"],
          motion: ["framer-motion"],
          supabase: ["@supabase/supabase-js"],
          ui: ["lucide-react"],
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.js",
    globals: true,
  },
  };
});
