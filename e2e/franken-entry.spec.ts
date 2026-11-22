import { test, expect } from "@playwright/test";
import { FAMILIE_A, login } from "./helpers";

test("Verpflegung in Franken erfassen", async ({ page }) => {
  await login(page, FAMILIE_A.username, FAMILIE_A.password);

  await page.getByRole("button", { name: "Verpflegung" }).click();
  await page.getByLabel("Betrag in CHF").fill("12.50");
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page.getByText("Gespeichert.")).toBeVisible();

  await page.getByRole("link", { name: "Meine Einträge" }).click();

  await expect(page.getByText("Verpflegung").first()).toBeVisible();
  await expect(page.getByText("CHF 12.50").first()).toBeVisible();
});
