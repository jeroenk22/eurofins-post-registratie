import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Netlify zet CONTEXT: production, deploy-preview, branch-deploy of dev (netlify dev).
const APP_CONTEXT = process.env.CONTEXT ?? "lokaal";

/**
 * Een PWA die vanaf een deploy preview geïnstalleerd is, is een eigen origin en
 * staat dus naast de gewone app. Met dezelfde naam weet niemand meer welke hij
 * opent; daarom draagt alles buiten productie het PR-nummer of de context in de naam.
 * short_name staat onder het icoon en wordt rond de twaalf tekens afgekapt.
 */
function appNamen(): { name: string; short_name: string; iosTitle: string } {
  if (APP_CONTEXT === "production") {
    return { name: "Post aanmelden app", short_name: "Post aanmelden", iosTitle: "Post" };
  }
  if (APP_CONTEXT === "deploy-preview") {
    const pr = process.env.REVIEW_ID ?? "?";
    return { name: `Post aanmelden preview #${pr}`, short_name: `Preview #${pr}`, iosTitle: `Preview #${pr}` };
  }
  return { name: `Post aanmelden ${APP_CONTEXT}`, short_name: `Post ${APP_CONTEXT}`, iosTitle: `Post ${APP_CONTEXT}` };
}

const namen = appNamen();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.VITE_APP_VERSION ?? process.env.npm_package_version ?? 'dev'
    ),
    __APP_CONTEXT__: JSON.stringify(APP_CONTEXT),
  },
  plugins: [
    react(),
    {
      name: "ios-app-titel",
      transformIndexHtml: (html: string) =>
        html.replace(
          '<meta name="apple-mobile-web-app-title" content="Post" />',
          `<meta name="apple-mobile-web-app-title" content="${namen.iosTitle}" />`,
        ),
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["eurofins_agro.svg", "miedema_logo.svg"],
      manifest: {
        name: namen.name,
        short_name: namen.short_name,
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
  server: {
    host: true, // luister op 0.0.0.0 zodat de dev server bereikbaar is via lokaal IP
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
