import { prisma } from "@/lib/prisma";

// Derivado del propio $transaction del cliente extendido (token-encryption
// $extends en lib/prisma.ts) en vez de Prisma.TransactionClient — ese tipo
// genérico no encaja estructuralmente con un cliente extendido.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | TxClient;

// diveNumber refleja la posición cronológica real de la inmersión (la Nª
// inmersión es la Nª que se hizo por fecha), no el orden en que se registró
// en la app — así que se recalcula por completo cada vez que cambia el
// conjunto de inmersiones de un usuario (alta, baja, edición de fecha,
// import masivo) en vez de asignarse una sola vez al crear.
export async function renumberDives(userId: string, db: Db = prisma) {
  const dives = await db.diveLog.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    select: { id: true, diveNumber: true },
  });

  const changed = dives
    .map((d, i) => ({ id: d.id, diveNumber: i + 1, changed: d.diveNumber !== i + 1 }))
    .filter((d) => d.changed);

  await Promise.all(
    changed.map((d) => db.diveLog.update({ where: { id: d.id }, data: { diveNumber: d.diveNumber } })),
  );
}
