import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptToken, decryptToken } from "./token-encryption";

function decryptAccountFields(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const r = result as Record<string, unknown>;
  // decryptToken returns null for corrupted ciphertext — treat as missing token
  if (typeof r.access_token === "string") r.access_token = decryptToken(r.access_token);
  if (typeof r.refresh_token === "string") r.refresh_token = decryptToken(r.refresh_token);
  return r;
}

function encryptDataFields(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return data as Record<string, unknown>;
  // Clone to avoid mutating the caller's reference
  const d = { ...(data as Record<string, unknown>) };
  if (typeof d.access_token === "string") d.access_token = encryptToken(d.access_token);
  if (typeof d.refresh_token === "string") d.refresh_token = encryptToken(d.refresh_token);
  return d;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const base = new PrismaClient({ adapter, log: ["error"] });

  return base.$extends({
    query: {
      account: {
        async $allOperations({ operation, args, query }: { operation: string; args: unknown; query: (args: unknown) => Promise<unknown> }) {
          const typedArgs = args as Record<string, unknown>;
          let patchedArgs = typedArgs;

          if (operation === "create" || operation === "update") {
            patchedArgs = { ...typedArgs, data: encryptDataFields(typedArgs.data) };
          } else if (operation === "upsert") {
            patchedArgs = { ...typedArgs, create: encryptDataFields(typedArgs.create), update: encryptDataFields(typedArgs.update) };
          }

          const result = await query(patchedArgs);

          if (Array.isArray(result)) {
            return result.map(decryptAccountFields);
          }
          return decryptAccountFields(result);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
