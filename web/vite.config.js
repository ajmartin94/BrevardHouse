import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // GEN-1: installable PWA; precache the app shell, runtime-cache the guide
    // APIs (checklists/manual/emergency/things) so they read offline.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Martin Brevard House',
        short_name: 'Brevard House',
        description: 'Family hub for the Martin Brevard House — stays, checklists, projects, and the house guide.',
        theme_color: '#453324',
        background_color: '#f6f1e7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // PHO-1: receive photos from the OS share sheet (installed PWA)
        share_target: {
          action: '/api/share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'photos', accept: ['image/*'] }] },
        },
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\/(checklists|manual|emergency|things|guest)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'guide-api', networkTimeoutSeconds: 3, expiration: { maxEntries: 40, maxAgeSeconds: 30 * 24 * 3600 } },
          },
          {
            urlPattern: /^\/uploads\//,
            handler: 'CacheFirst',
            options: { cacheName: 'uploads', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:4545',
      '/uploads': 'http://localhost:4545',
    },
  },
});
