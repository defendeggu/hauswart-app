import type { Page } from "@playwright/test";

// Zugangsdaten aus supabase/seed.sql (nur lokale Testdaten).
export const FAMILIE_A = { username: "familie-a", password: "test12345678" };
export const FAMILIE_B = { username: "familie-b", password: "test12345678" };

export async function login(page: Page, username: string, password: string) {
  await page.goto("/#/login");
  await page.getByLabel("Benutzername").fill(username);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.getByRole("heading", { name: "Erfassen" }).waitFor();
}
