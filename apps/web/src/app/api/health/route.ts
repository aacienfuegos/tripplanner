import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// El healthcheck del contenedor apuntaba a `/`, que responde igual de bien con
// la base de datos caída: servía para saber que había un proceso escuchando,
// no que la app funcionara.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "db-unreachable" }, { status: 503 });
  }
}
