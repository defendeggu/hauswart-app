import { readFileSync } from "node:fs";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

// GitHub Pages liefert keine eigenen HTTP-Header aus, darum steht die
// Content-Security-Policy als meta-Tag im ausgelieferten HTML. Keine
// Fremd-Skripte, keine Analytics; connect-src erlaubt nur Supabase.
// Nur im Build: der Dev-Server spielt CSS als Inline-Style ein, das die
// strenge style-src sonst blockieren würde.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const cspPlugin: Plugin = {
  name: "hauswart-csp",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
      injectTo: "head-prepend",
    },
  ],
};

// Der Basis-Pfad ist eine Build-Variable, weil die App später von
// https://defendeggu.github.io/hauswart-app/ auf eine eigene Domain
// (Basis-Pfad "/") umzieht. Siehe docs/PLAN.md Abschnitt 10.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const basePath = env.VITE_BASE_PATH ?? "/hauswart-app/";

  return {
    base: command === "build" ? basePath : "/",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      cspPlugin,
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          id: "hauswart-app",
          name: "Hauswart-App",
          short_name: "Hauswart",
          description: "Stundenerfassung und Abrechnung für das Hauswart-Team",
          lang: "de-CH",
          start_url: ".",
          scope: ".",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#0f766e",
          icons: [
            {
              src: "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
          // PDF- und Excel-Bibliotheken braucht nur der Admin-Bereich (online);
          // nicht auf jedes Handy vorausladen.
          globIgnores: [
            "**/jspdf*.js",
            "**/html2canvas*.js",
            "**/purify*.js",
            "**/index.es-*.js",
            "**/browser-*.js",
          ],
        },
      }),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
