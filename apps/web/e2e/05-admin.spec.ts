import { es } from "@/i18n";
import { test, expect } from "./support/fixtures";
import { loginDevAdmin } from "./support/auth";
import { PENDING_APPROVE } from "./support/users";

test("admin: aprobar a un usuario PENDING", async ({ page }) => {
  await loginDevAdmin(page);
  await page.goto("/admin");

  const section = (title: string) =>
    page.locator('[data-slot="card"]').filter({ has: page.getByText(title, { exact: true }) });
  const pending = section(es.pendingRequestsTitle);
  const approved = section(es.approvedUsersTitle);
  const approveButton = page.getByRole("button", { name: es.approveBtn });

  // La fila es el div más interno que tiene el email y el botón de aprobar.
  const row = pending.locator("div").filter({ hasText: PENDING_APPROVE.email }).filter({ has: approveButton }).last();
  await row.getByRole("button", { name: es.approveBtn }).click();

  await expect(approved.getByText(PENDING_APPROVE.email, { exact: true })).toBeVisible();
  await expect(pending.getByText(PENDING_APPROVE.email, { exact: true })).toHaveCount(0);
});
