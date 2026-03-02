import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["eurofins_agro.svg", "miedema_logo.svg"],
      manifest: {
        name: "Post Registratie",
        short_name: "Post",
        description: "Registreer post voor de chauffeur",
        theme_color: "#003883",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "screenshot-mobile.jpg",
            sizes: "1080x1933",
            type: "image/jpeg",
            form_factor: "narrow",
            label: "Post aanmelden mobiel",
          },
          {
            src: "screenshot-wide.png",
            sizes: "1491x720",
            type: "image/png",
            form_factor: "wide",
            label: "Post aanmelden desktop",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
