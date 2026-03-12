import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy API calls to the gateway in dev — eliminates CORS entirely.
    // In production, set VITE_API_BASE_URL to the real backend URL.
    proxy: {
      "/register":       "http://localhost:8000",
      "/login":          "http://localhost:8000",
      "/logout":         "http://localhost:8000",
      "/users":          "http://localhost:8000",
      "/forgot-password":"http://localhost:8000",
      "/reset-password": "http://localhost:8000",
      "/sensors":        "http://localhost:8000",
      "/billings":       "http://localhost:8000",
      "/health":         "http://localhost:8000",
    },
  },
});
