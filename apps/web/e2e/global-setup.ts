import { Client } from "pg";
import { requireEnv } from "./support/env";
import { PENDING_APPROVE, PENDING_GUARD } from "./support/users";

export default async function globalSetup() {
  const connectionString = requireEnv("DATABASE_URL");
  for (const name of ["AUTH_SECRET", "DEV_ADMIN_EMAIL", "DEV_ADMIN_PASSWORD"]) requireEnv(name);

  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const user of [PENDING_GUARD, PENDING_APPROVE]) {
      await client.query(
        `INSERT INTO "User" (id, name, email, status) VALUES ($1, $2, $3, 'PENDING')
         ON CONFLICT (id) DO UPDATE SET status = 'PENDING'`,
        [user.id, user.name, user.email],
      );
    }
  } finally {
    await client.end();
  }
}
