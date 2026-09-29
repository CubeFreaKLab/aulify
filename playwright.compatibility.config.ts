import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// Additional engine checks; mobile emulation remains in the main Chromium suite.
export default defineConfig({
  ...base,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-compatibility-report' }],
    ['json', { outputFile: 'test-results-compatibility/results.json' }],
  ],
  outputDir: 'test-results-compatibility',
  projects: [
    { name: 'firefox-escritorio', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-escritorio', use: { ...devices['Desktop Safari'] } },
  ],
});
