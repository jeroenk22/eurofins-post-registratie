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
        name: "Post aanmelden app",
        short_name: "Post aanmelden",
        description: "Post aanmelden",
        theme_color: "#003883",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        launch_handler: {
          client_mode: "navigate-existing",
        },
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
        // HTML wordt niet geprecached zodat elke navigatie langs de Netlify
        // edge function gaat (IP-filter). JS/CSS/assets blijven wel gecached.
        // NetworkFirst voor navigatie: bij online → edge function beslist;
        // bij offline → valt terug op gecachede HTML (werkt als filter uitstaat).
        // Geen networkTimeoutSeconds: de SW wacht altijd op het netwerk.
        // Dit voorkomt dat een 403 wordt omzeild door een cache-fallback
        // wanneer de edge function trager reageert dan de vorige timeout (3s).
        globPatterns: ["**/*.{js,css,ico,png,svg}"],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }: { request: Request }) =>
              request.mode === "navigate",
            handler: "NetworkFirst" as const,
            options: {
              cacheName: "navigation-cache",
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
