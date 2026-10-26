import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import catalog from './src/catalog.json' with { type: 'json' }

const BASE = '/pwa/' // GitHub Pages subpath (plan §15.6)
const OPEN_EXT = [
  '.nii',
  '.gz',
  '.mz3',
  '.gii',
  '.nvd',
  '.mgh',
  '.mgz',
  '.nrrd',
  '.trk',
  '.tck',
  '.trx',
  '.jcon',
  '.obj',
  '.ply',
  '.stl',
  '.vtk',
]

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // never reload over unsaved work (plan §6)
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MRIvue',
        short_name: 'MRIvue',
        description: 'Desktop-style viewer for brain volumes and meshes',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        display_override: ['window-controls-overlay'],
        background_color: '#1e1e1e',
        theme_color: '#1e1e1e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          // MRIcroGL's icon (team artwork, rendered from its SVG). Not 'maskable': it has no safe-zone padding.
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        file_handlers: [{ action: BASE, accept: { 'application/octet-stream': OPEN_EXT } }],
        launch_handler: { client_mode: 'focus-existing' },
      } as Record<string, unknown>,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,jcon,mz3,gz,woff2,wasm,txt}'], // txt: llms.txt
        globIgnores: ['samples/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Regex, not a function: workbox serializes matchers without their closure.
            urlPattern: /\/pwa\/samples\//,
            handler: 'StaleWhileRevalidate', // samples can change between deploys
            options: { cacheName: 'samples', expiration: { maxEntries: 20, purgeOnQuotaError: true } },
          },
          {
            // Only the exact pinned demo commit; never user data (plan §6).
            urlPattern: new RegExp(`^${catalog.cdn.replace(/[.]/g, '\\.')}`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'demo-images',
              expiration: { maxEntries: 40, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
