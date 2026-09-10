import { defineConfig } from '@playwright/test'

// E2E config placeholder. Real specs land once the auth/dashboard
// foundation exists (see docs/MVP-CHECKLIST.md). Not yet wired into CI.
export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
})
