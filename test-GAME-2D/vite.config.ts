import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Vite sert uniquement à builder le front (npm run build).
// Le serveur Node (server.js) sert ensuite le contenu de dist/.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:5175",
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: true,
    minify: false
  }
});
