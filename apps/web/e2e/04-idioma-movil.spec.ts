import type { Page } from "@playwright/test";
import { en, es, type WebLocale } from "@/i18n";
import { test, expect } from "./support/fixtures";
import { loginDevAdmin } from "./support/auth";
import { attachScreenshot, expectNoHorizontalOverflow } from "./support/layout";

const SEED_TRIP = "Japón - Cerezos en flor";

async function switchLocale(page: Page, from: WebLocale, to: WebLocale) {
  const t = from === "es" ? es : en;
  await page.getByRole("button", { name: t.language }).click();
  await page.getByRole("menuitem", { name: to === "es" ? t.langEs : t.langEn }).click();
}

test("idioma: el dashboard y la lista de viajes pasan a inglés y vuelven", async ({ page }) => {
  await loginDevAdmin(page);
  const screens = [
    { path: "/dashboard", es: es.dashboardTitle, en: en.dashboardTitle },
    { path: "/trips", es: es.myTrips, en: en.myTrips },
  ];
  for (const screen of screens) {
    await page.goto(screen.path);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText(screen.es);
    await switchLocale(page, "es", "en");
    await expect(heading).toContainText(screen.en);
    await switchLocale(page, "en", "es");
    await expect(heading).toContainText(screen.es);
  }
});

test.describe("a 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sin desborde horizontal", async ({ page }, testInfo) => {
    await loginDevAdmin(page);
    const screens: { name: string; open: () => Promise<unknown> }[] = [
      { name: "dashboard", open: () => page.goto("/dashboard") },
      { name: "viajes", open: () => page.goto("/trips") },
      {
        name: "detalle-viaje",
        open: async () => {
          await page.goto("/trips");
          await page.getByText(SEED_TRIP, { exact: true }).click();
          await page.waitForURL(/\/trips\/(?!new$)[^/]+$/);
        },
      },
      { name: "inmersiones", open: () => page.goto("/dives") },
      { name: "admin", open: () => page.goto("/admin") },
    ];
    for (const screen of screens) {
      await screen.open();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await attachScreenshot(page, testInfo, `390px-${screen.name}`);
      await expectNoHorizontalOverflow(page, screen.name);
    }
  });
});
