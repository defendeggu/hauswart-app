import { test, expect } from "@playwright/test";
import { FAMILIE_A, FAMILIE_B, login } from "./helpers";

// supabase/seed.sql schränkt "Wasserbezug" auf die erste Platzhalter-Familie
// (familie-a) ein, siehe docs/PLAN.md ("nur_familien").
test("nur_familien-Einschränkung: Wasserbezug nur für die berechtigte Familie sichtbar", async ({
  page,
}) => {
  await login(page, FAMILIE_A.username, FAMILIE_A.password);
  await expect(page.getByRole("button", { name: "Wasserbezug" })).toBeVisible();
  await page.getByRole("button", { name: "Abmelden" }).click();

  await login(page, FAMILIE_B.username, FAMILIE_B.password);
  await expect(page.getByRole("button", { name: "Wasserbezug" })).not.toBeVisible();
});
