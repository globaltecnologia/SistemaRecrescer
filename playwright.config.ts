import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/functional",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run api",
      url: "http://127.0.0.1:3101/api/health",
      env: { ...process.env, PORT: "3101", DATA_DIR: "/tmp/recrescer-e2e", ADMIN_LOGIN: "admin", ADMIN_PASSWORD: "recrescer" },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5175",
      url: "http://127.0.0.1:5175",
      env: { ...process.env, VITE_API_PROXY: "http://127.0.0.1:3101" },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
