import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  reporter: "line",
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "msedge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
})
