import { test as base, expect } from "@playwright/test";
import { ALLOWED_BLOCKED_HOSTS, APP_ORIGIN } from "./network";

export const test = base.extend<{ blockExternalRequests: void }>({
  blockExternalRequests: [
    async ({ context }, use) => {
      const blockedHosts = new Set<string>();
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === APP_ORIGIN) return route.continue();
        blockedHosts.add(url.hostname);
        return route.abort("blockedbyclient");
      });
      await use();
      const unexpected = [...blockedHosts].filter((host) => !ALLOWED_BLOCKED_HOSTS.includes(host));
      expect(unexpected, "peticiones externas no previstas").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
