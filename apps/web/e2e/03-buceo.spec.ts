import { es } from "@/i18n";
import { test, expect } from "./support/fixtures";
import { loginDevAdmin } from "./support/auth";

const SITE = "E2E Sitio";
const SEED_TRIP = "Japón - Cerezos en flor";
// La última inmersión del seed es la nº 10, del 2026-06-08; esta va después
// y dentro de las fechas del viaje del seed (2026-06-07 a 2026-06-22).
const DIVE_DATE = "2026-06-20";
const EXPECTED_NUMBER = 11;

test("buceo: sitio, inmersión con el número siguiente y vínculo al viaje", async ({ page }) => {
  await loginDevAdmin(page);

  await page.goto("/dives?tab=sites");
  await page.getByRole("button", { name: es.addDiveSite }).click();
  const siteDialog = page.getByRole("dialog");
  await siteDialog.locator("#name").fill(SITE);
  await siteDialog.getByRole("button", { name: es.addDiveSite }).click();
  await expect(siteDialog).toBeHidden();
  await expect(page.getByText(SITE, { exact: true }).first()).toBeVisible();

  await page.goto("/dives");
  await page.getByRole("button", { name: es.addDive }).click();
  const diveDialog = page.getByRole("dialog");
  await diveDialog.locator("#diveSite").click();
  await page.getByRole("option", { name: SITE, exact: true }).click();
  await diveDialog.locator("#date").fill(DIVE_DATE);
  await diveDialog.locator("#depthMax").fill("18");
  await diveDialog.locator("#bottomTime").fill("45");
  await diveDialog.getByRole("button", { name: es.addDive }).click();
  await expect(diveDialog).toBeHidden();
  const diveCard = page.getByRole("link").filter({ hasText: SITE });
  await expect(diveCard).toHaveCount(1);
  await expect(diveCard).toContainText(`#${EXPECTED_NUMBER}`);

  await page.goto("/trips");
  await page.getByText(SEED_TRIP, { exact: true }).click();
  await page.waitForURL(/\/trips\/(?!new$)[^/]+$/);
  await page.goto(`${new URL(page.url()).pathname}/dives`);
  await page.getByRole("combobox").filter({ hasText: es.linkDiveSelectPlaceholder }).click();
  await page.getByRole("option", { name: new RegExp(`^#${EXPECTED_NUMBER} · .* · ${SITE}$`) }).click();
  await page.getByRole("button", { name: es.linkDive, exact: true }).click();
  await expect(page.locator('main [data-slot="card"]').filter({ hasText: SITE })).toBeVisible();
});
