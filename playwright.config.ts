import { defineConfig, devices } from "@playwright/test";

// Braucht eine laufende lokale Supabase-Instanz mit den Testdaten aus
// supabase/seed.sql (npm run db:start && npm run db:reset).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
