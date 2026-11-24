import { es } from "@/i18n";
import { test, expect } from "./support/fixtures";
import { loginDevAdmin, usePendingSession } from "./support/auth";
import { PENDING_GUARD } from "./support/users";

test("sin sesión, /dashboard lleva a /auth/signin", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/signin$/);
});

test("con Dev Login se ve el dashboard", async ({ page }) => {
  await loginDevAdmin(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(es.dashboardTitle);
});

test("con la sesión de un usuario PENDING, /dashboard lleva a /auth/pending", async ({ context, page }) => {
  await usePendingSession(context, PENDING_GUARD);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/pending$/);
  await expect(page.getByText(es.pendingApprovalTitle)).toBeVisible();
});
