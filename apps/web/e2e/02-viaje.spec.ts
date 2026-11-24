import { es } from "@/i18n";
import { test, expect } from "./support/fixtures";
import { loginDevAdmin } from "./support/auth";

const ACTIVITY = "E2E Actividad";

test("viaje: validación, alta, edición, actividad y borrado", async ({ page }) => {
  const suffix = Date.now();
  const tripName = `E2E Viaje ${suffix}`;
  const editedName = `E2E Viaje editado ${suffix}`;
  const tripCards = page.locator('main a[href^="/trips/"]:not([href="/trips/new"])');

  await loginDevAdmin(page);
  await page.goto("/trips");
  const tripsBefore = await tripCards.count();

  await page.goto("/trips/new");
  await page.locator("#startDate").fill("2027-03-01");
  await page.locator("#endDate").fill("2027-03-05");
  await page.getByRole("button", { name: es.createTrip }).click();
  const nameInput = page.locator("#name");
  expect(await nameInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  expect(await nameInput.evaluate((el: HTMLInputElement) => el.validationMessage)).not.toBe("");
  await expect(page).toHaveURL(/\/trips\/new$/);
  await page.goto("/trips");
  await expect(tripCards).toHaveCount(tripsBefore);

  await page.goto("/trips/new");
  await page.locator("#name").fill(tripName);
  await page.locator("#startDate").fill("2027-03-01");
  await page.locator("#endDate").fill("2027-03-05");
  await page.getByRole("button", { name: es.createTrip }).click();
  await page.waitForURL(/\/trips\/(?!new$)[^/]+$/);
  const tripPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(tripName);

  await page.getByRole("link", { name: es.editBtn, exact: true }).click();
  await page.waitForURL(`**${tripPath}/edit`);
  await page.locator("#name").fill(editedName);
  await page.getByRole("button", { name: es.updateTrip }).click();
  await page.waitForURL(`**${tripPath}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(editedName);
  await page.goto("/trips");
  await expect(page.getByText(editedName, { exact: true })).toBeVisible();
  await expect(page.getByText(tripName, { exact: true })).toHaveCount(0);

  await page.goto(`${tripPath}/activities`);
  await page.getByRole("button", { name: es.addActivity }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#name").fill(ACTIVITY);
  await dialog.getByRole("button", { name: es.addActivity }).click();
  await expect(dialog).toBeHidden();
  const activityCard = page.locator('[data-slot="card"]').filter({ hasText: ACTIVITY });
  await expect(activityCard).toBeVisible();

  // El último botón de la tarjeta es el de borrar (icono sin texto).
  await activityCard.getByRole("button").last().click();
  await page.getByRole("dialog").getByRole("button", { name: es.delete }).click();
  await expect(page.getByText(ACTIVITY, { exact: true })).toHaveCount(0);

  await page.goto(`${tripPath}/edit`);
  await page.getByRole("button", { name: es.deleteTrip }).click();
  await page.getByRole("dialog").getByRole("button", { name: es.delete }).click();
  await page.waitForURL(/\/trips$/);
  await expect(page.getByText(editedName, { exact: true })).toHaveCount(0);
  await expect(tripCards).toHaveCount(tripsBefore);
});
