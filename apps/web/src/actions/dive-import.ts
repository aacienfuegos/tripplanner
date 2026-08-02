"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/action-auth";
import { geocodeDiveSite } from "@/lib/geocode-items";
import { mapDiveLogInput } from "@/lib/dive-log-mapper";
import { renumberDives } from "@/lib/dive-numbering";
import { isFuzzyMatch } from "@/lib/fuzzy-match";
import {
  divingLogImportPayloadSchema,
  DivingLogImportPayload,
} from "@/lib/schemas";

// Returned as a code rather than a message: the parsing endpoint (route.ts,
// not a Server Action) isn't locale-aware, and the client
// (DiveImportUploadStep) maps each code to a translated string via the same
// t object the rest of the UI uses.
export type DivingLogParseErrorCode =
  | "NO_FILE"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNRECOGNIZED_FILE"
  | "EMPTY_PAYLOAD"
  | "UNKNOWN";

export type DivingLogParseResponse =
  | { ok: true; payload: DivingLogImportPayload }
  | { ok: false; errorCode: DivingLogParseErrorCode; maxSizeMb?: number };

export type DivingLogDuplicateFlags = {
  sites: boolean[];
  logs: boolean[];
  certifications: boolean[];
};

export async function checkDivingLogDuplicates(
  payload: DivingLogImportPayload,
): Promise<DivingLogDuplicateFlags> {
  const userId = await requireUser();
  const data = divingLogImportPayloadSchema.parse(payload);

  const [existingSites, existingLogs, existingCerts] = await Promise.all([
    prisma.diveSite.findMany({ where: { userId, externalId: { not: null } }, select: { externalId: true, name: true } }),
    prisma.diveLog.findMany({ where: { userId, externalId: { not: null } }, select: { externalId: true } }),
    prisma.diveCertification.findMany({ where: { userId, externalId: { not: null } }, select: { externalId: true } }),
  ]);

  const siteExternalIds = new Set(existingSites.map((s) => s.externalId));
  const logExternalIds = new Set(existingLogs.map((l) => l.externalId));
  const certExternalIds = new Set(existingCerts.map((c) => c.externalId));

  return {
    // Primary signal is externalId (survives reimport of the exact same DivingLog
    // row); a fuzzy name match also flags sites that were entered manually before
    // ever importing, so the user notices the potential overlap.
    sites: data.sites.map(
      (s) => siteExternalIds.has(s.externalId) || existingSites.some((e) => isFuzzyMatch(e.name, s.name)),
    ),
    logs: data.logs.map((l) => logExternalIds.has(l.externalId)),
    certifications: data.certifications.map((c) => certExternalIds.has(c.externalId)),
  };
}

export type DivingLogImportResult = {
  sites: number;
  logs: number;
  certifications: number;
};

export async function bulkImportDivingLog(payload: DivingLogImportPayload): Promise<DivingLogImportResult> {
  const userId = await requireUser();
  const data = divingLogImportPayloadSchema.parse(payload);

  const result = await prisma.$transaction(async (tx) => {
    const result: DivingLogImportResult = { sites: 0, logs: 0, certifications: 0 };

    const siteIdByExternalId = new Map<string, string>();
    if (data.sites.length > 0) {
      const existing = await tx.diveSite.findMany({
        where: { userId, externalId: { in: data.sites.map((s) => s.externalId) } },
        select: { id: true, externalId: true },
      });
      for (const e of existing) {
        if (e.externalId) siteIdByExternalId.set(e.externalId, e.id);
      }

      const toCreate = data.sites.filter((s) => !siteIdByExternalId.has(s.externalId));
      const needsGeocoding: string[] = [];
      for (const s of toCreate) {
        const created = await tx.diveSite.create({
          data: {
            userId,
            name: s.name,
            country: s.country || null,
            notes: s.notes || null,
            latitude: s.latitude ?? null,
            longitude: s.longitude ?? null,
            source: "IMPORTED",
            externalId: s.externalId,
          },
        });
        siteIdByExternalId.set(s.externalId, created.id);
        // Diving Log exports almost never include coordinates (verified against
        // #169's real sample: 0/27 sites had Lat/Lon) — fall back to the same
        // best-effort geocoding manual site creation already uses.
        if (created.latitude === null || created.longitude === null) needsGeocoding.push(created.id);
        result.sites += 1;
      }
      for (const id of needsGeocoding) void geocodeDiveSite(id);
    }

    if (data.logs.length > 0) {
      // diveNumber es un valor temporal — renumberDives lo recalcula por
      // fecha justo después de insertar las filas.
      const rows: Prisma.DiveLogCreateManyInput[] = data.logs.map((log) => {
        const diveSiteId = log.diveSiteExternalId ? (siteIdByExternalId.get(log.diveSiteExternalId) ?? null) : null;
        return {
          userId,
          diveNumber: 0,
          source: "IMPORTED",
          externalId: log.externalId,
          ...mapDiveLogInput(log, diveSiteId),
        };
      });

      const created = await tx.diveLog.createMany({ data: rows, skipDuplicates: true });
      result.logs = created.count;
      if (created.count > 0) await renumberDives(userId, tx);
    }

    if (data.certifications.length > 0) {
      const rows: Prisma.DiveCertificationCreateManyInput[] = data.certifications.map((c) => ({
        userId,
        agency: c.agency,
        level: c.level,
        certNumber: c.certNumber || null,
        issueDate: c.issueDate ? new Date(c.issueDate) : null,
        instructorName: c.instructorName || null,
        source: "IMPORTED",
        externalId: c.externalId,
      }));
      const created = await tx.diveCertification.createMany({ data: rows, skipDuplicates: true });
      result.certifications = created.count;
    }

    return result;
  });

  // El perfil profundidad/tiempo se guarda fuera de la transacción anterior:
  // createMany no soporta relaciones anidadas, y con miles de muestras por
  // buceo (buceos con ordenador muestreando cada 2s) un borrado+inserción por
  // buceo dentro de $transaction supera el timeout de transacción interactiva
  // de Prisma (5s por defecto) — ver #169 seguimiento. Se resuelve el id real
  // —nuevo o ya existente, para poder rellenar el perfil en una
  // reimportación— por externalId y se reemplazan sus muestras en un único
  // deleteMany + createMany en vez de uno por buceo.
  const logsWithProfile = data.logs.filter((log) => log.profileSamples.length > 0);
  if (logsWithProfile.length > 0) {
    const matched = await prisma.diveLog.findMany({
      where: { userId, externalId: { in: logsWithProfile.map((l) => l.externalId) } },
      select: { id: true, externalId: true },
    });
    const logIdByExternalId = new Map(matched.map((l) => [l.externalId, l.id]));

    const diveLogIds: string[] = [];
    const sampleRows: Prisma.DiveProfileSampleCreateManyInput[] = [];
    for (const log of logsWithProfile) {
      const diveLogId = logIdByExternalId.get(log.externalId);
      if (!diveLogId) continue;
      diveLogIds.push(diveLogId);
      for (const s of log.profileSamples) sampleRows.push({ diveLogId, seconds: s.seconds, depth: s.depth });
    }

    if (diveLogIds.length > 0) {
      await prisma.diveProfileSample.deleteMany({ where: { diveLogId: { in: diveLogIds } } });
    }
    if (sampleRows.length > 0) {
      await prisma.diveProfileSample.createMany({ data: sampleRows });
    }
  }

  revalidatePath("/dives");
  return result;
}
