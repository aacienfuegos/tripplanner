import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedTripsForUser } from "../src/lib/seed-trips";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEV_USER_ID = "dev-local-user-001";

async function main() {
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      email: process.env.DEV_ADMIN_EMAIL ?? "admin@dev.local",
      name: "Dev Admin",
      status: "APPROVED",
      isAdmin: true,
    },
  });

  await seedTripsForUser(prisma, DEV_USER_ID);

  console.log(`✅ Seed completado para usuario dev (${DEV_USER_ID})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
