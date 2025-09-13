import { defineConfig, devices } from '@playwright/test';

const reuse = process.env.CI ? false : true;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },

  // Start BOTH servers for tests; or reuse if already running.
  webServer: [
    {
      // API (wait on health)
      command: 'npm -w api run dev',
      url: 'http://localhost:5050/health',
      reuseExistingServer: reuse,
      timeout: 120_000
    },
    {
      // Web (Vite)
      command: 'npm -w web run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: reuse,
      timeout: 120_000
    }
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
