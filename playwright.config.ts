import { defineConfig, devices } from '@playwright/test';

// The tests run against the built app, so every test runs under its Content Security Policy
// (docs/07). The developer page (Phase 1) is not built, so its test uses the dev server.
const appPort = 5200;
const devPort = 5199;
const built = 'node_modules/.e2e-dist';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  projects: [
    { name: 'app', testIgnore: /dev-page\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${appPort}` } },
    { name: 'dev-page', testMatch: /dev-page\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${devPort}` } },
  ],
  webServer: [
    {
      // Built fresh on every run: a reused server could serve an old build.
      command: `npx vite build --outDir ${built} --emptyOutDir --logLevel warn && npx vite preview --outDir ${built} --port ${appPort} --strictPort`,
      url: `http://localhost:${appPort}/`,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${devPort} --strictPort`,
      url: `http://localhost:${devPort}/dev.html`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
