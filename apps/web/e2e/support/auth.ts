import type { BrowserContext, Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { es } from "@/i18n";
import { requireEnv } from "./env";
import { APP_ORIGIN } from "./network";

// Sobre http, Auth.js usa el nombre sin el prefijo __Secure-; es también la salt del JWE.
const SESSION_COOKIE = "authjs.session-token";

export async function loginDevAdmin(page: Page) {
  await page.goto("/auth/signin");
  await page.locator("#email").fill(requireEnv("DEV_ADMIN_EMAIL"));
  await page.locator("#password").fill(requireEnv("DEV_ADMIN_PASSWORD"));
  await page.getByRole("button", { name: es.enterBtn }).click();
  await page.waitForURL("**/dashboard");
}

// Dev Login siempre entra como el admin: la sesión de otro usuario se firma
// con el AUTH_SECRET del servidor de la prueba, y solo vale para ese servidor.
export async function usePendingSession(
  context: BrowserContext,
  user: { readonly id: string; readonly name: string; readonly email: string },
) {
  const value = await encode({
    token: { sub: user.id, name: user.name, email: user.email },
    secret: requireEnv("AUTH_SECRET"),
    salt: SESSION_COOKIE,
  });
  await context.addCookies([{ name: SESSION_COOKIE, value, url: APP_ORIGIN, httpOnly: true, sameSite: "Lax" }]);
}
