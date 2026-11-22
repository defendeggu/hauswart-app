import { test, expect } from "@playwright/test";
import { FAMILIE_A, login } from "./helpers";

test("anmelden, Stunden erfassen, in der Liste sehen", async ({ page }) => {
  await login(page, FAMILIE_A.username, FAMILIE_A.password);

  await page.getByRole("button", { name: "Rasen mähen" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page.getByText("Gespeichert.")).toBeVisible();

  await page.getByRole("link", { name: "Meine Einträge" }).click();

  await expect(page.getByText("Rasen mähen").first()).toBeVisible();
  await expect(page.getByText("1 h").first()).toBeVisible();
});
