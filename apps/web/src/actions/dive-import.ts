"use server";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/action-auth";
import { geocodeDiveSite } from "@/lib/geocode-items";
import { mapDiveLogInput } from "@/lib/dive-log-mapper";
import { isFuzzyMatch } from "@/lib/fuzzy-match";
import {
  divingLogImportPayloadSchema,
  DivingLogImportPayload,
} from "@/lib/schemas";
import { parseDivingLogDatabase, DivingLogFileError } from "@/lib/divinglog-parser";

// Generous but real: the sample export used to spec issue #169 (photos/blobs
// included) is ~4.3MB — 50MB comfortably covers larger libraries without
// being unbounded.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Returned as a code rather than a message: server action errors aren't
// locale-aware, and the client (DiveImportUploadStep) maps each code to a
// translated string via the same t object the rest of the UI uses.
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

export async function parseDivingLogFile(formData: FormData): Promise<DivingLogParseResponse> {
  await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, errorCode: "NO_FILE" };
  }
  if (file.size === 0) {
    return { ok: false, errorCode: "EMPTY_FILE" };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, errorCode: "FILE_TOO_LARGE", maxSizeMb: MAX_FILE_SIZE_BYTES / (1024 * 1024) };
  }

  // Written under a random name in the OS temp dir and opened readonly by the
  // parser — never executed, never written back to. Removed in `finally` even
  // if parsing throws partway through (issue #169's explicit security requirement).
  const tmpPath = path.join(os.tmpdir(), `divinglog-import-${randomUUID()}.sqlite`);
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tmpPath, buffer);

    const raw = parseDivingLogDatabase(tmpPath);
    const payload = divingLogImportPayloadSchema.parse({
      sites: raw.sites,
      logs: raw.entries,
      certifications: raw.certifications,
    });

    if (payload.sites.length === 0 && payload.logs.length === 0 && payload.certifications.length === 0) {
      return { ok: false, errorCode: "EMPTY_PAYLOAD" };
    }

    return { ok: true, payload };
  } catch (error) {
    // DivingLogFileError.message carries raw SQLite internals (table/column
    // names) — useful while debugging locally, not something to surface to
    // the end user, so only the generic code crosses the action boundary.
    if (error instanceof DivingLogFileError) {
      return { ok: false, errorCode: "UNRECOGNIZED_FILE" };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, errorCode: "UNRECOGNIZED_FILE" };
    }
    return { ok: false, errorCode: "UNKNOWN" };
  } finally {
    await fs.rm(tmpPath, { force: true });
  }
}

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
      const { _max } = await tx.diveLog.aggregate({ where: { userId }, _max: { diveNumber: true } });
      let nextDiveNumber = (_max.diveNumber ?? 0) + 1;

      const rows: Prisma.DiveLogCreateManyInput[] = data.logs.map((log) => {
        const diveSiteId = log.diveSiteExternalId ? (siteIdByExternalId.get(log.diveSiteExternalId) ?? null) : null;
        return {
          userId,
          diveNumber: nextDiveNumber++,
          source: "IMPORTED",
          externalId: log.externalId,
          ...mapDiveLogInput(log, diveSiteId),
        };
      });

      const created = await tx.diveLog.createMany({ data: rows, skipDuplicates: true });
      result.logs = created.count;
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

  revalidatePath("/dives");
  return result;
}
