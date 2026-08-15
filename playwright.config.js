import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    // No demanis res a Wikidata: interceptem totes les crides externes
    extraHTTPHeaders: {},
  },

  webServer: {
    command: 'python3 -m http.server 8080',
    port: 8080,
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'mobile-portrait',
      use: {
        ...devices['iPhone 14'],
        // portrait: width < height (390×844 per defecte de l'iPhone 14)
      },
    },
    {
      name: 'mobile-landscape',
      use: {
        ...devices['iPhone 14 landscape'],
        // landscape: width > height (844×390)
      },
    },
  ],
});
