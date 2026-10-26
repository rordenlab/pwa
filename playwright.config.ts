import { defineConfig } from '@playwright/test'

// dev: fast feedback on the Vite dev server. prod: the built app with its service worker.
export default defineConfig({
  testDir: 'tests',
  webServer: [
    { command: 'bunx vite --port 5173 --strictPort', url: 'http://localhost:5173/pwa/', reuseExistingServer: true },
    {
      command: 'bunx vite build && bunx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173/pwa/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chromium', testIgnore: /prod\.spec/, use: { browserName: 'chromium', baseURL: 'http://localhost:5173/pwa/' } },
    // Non-Chromium: no File System Access, so these cover the open/download fallback path.
    ...(['webkit', 'firefox'] as const).map((browserName) => ({
      name: browserName,
      testMatch: /m0\.spec|m1\.spec|m2\.spec|m4\.spec/,
      grep: /M0|M1|without File System Access|sections follow/,
      use: { browserName, baseURL: 'http://localhost:5173/pwa/' },
    })),
    { name: 'prod', testMatch: /prod\.spec/, use: { browserName: 'chromium', baseURL: 'http://localhost:4173/pwa/' } },
  ],
})
