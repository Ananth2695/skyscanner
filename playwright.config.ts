import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 300000,
  workers: 1, 
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    viewport: null, // null = use the actual maximised window size
    screenshot: 'only-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
          ],
        },
      },
    },
  ],
});