import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Generate build version from timestamp
const BUILD_VERSION = Date.now().toString(36);
const BUILD_TIME = new Date().toISOString();

// Plugin to generate version.json for cache-busting checks
function versionPlugin(version: string, buildTime: string): Plugin {
  return {
    name: 'version-plugin',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version,
          timestamp: buildTime,
        }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    versionPlugin(BUILD_VERSION, BUILD_TIME),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false, // Disable auto-registration - we use our custom sw-v6.js
      includeAssets: ["app-icon.png", "favicon.ico"],
      manifest: {
        name: "TraderCafé",
        short_name: "TraderCafé",
        description: "Track your trades, analyze performance, and grow as a trader",
        theme_color: "#080a0f",
        background_color: "#080a0f",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/app-icon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/app-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        categories: ["finance", "productivity"],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-switch',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-avatar',
            '@radix-ui/react-accordion',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-toast',
            '@radix-ui/react-separator',
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-slot',
          ],
          'vendor-charts': ['recharts'],
          'vendor-grid': ['react-grid-layout'],
          'vendor-motion': ['framer-motion'],
          'vendor-dates': ['date-fns'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
