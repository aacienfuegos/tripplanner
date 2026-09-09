import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { requireUser } from "@/lib/action-auth";
import { divingLogImportPayloadSchema } from "@/lib/schemas";
import { parseDivingLogDatabase, DivingLogFileError } from "@/lib/divinglog-parser";
import type { DivingLogParseResponse } from "@/actions/dive-import";

// Route Handler, no Server Action: evita el protocolo RSC de serialización
// de argumentos (FormData+File como argumento directo de una Server
// Function), que el ruleset gestionado de Cloudflare fingerprinting como
// "React - Leaking Server Functions" bloqueaba en /dives.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Los Server Actions comprueban Origin vs Host automáticamente contra CSRF;
// un Route Handler no lo hace por defecto, así que se replica aquí.
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse<DivingLogParseResponse>> {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, errorCode: "UNKNOWN" }, { status: 403 });
  }

  await requireUser();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, errorCode: "NO_FILE" });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, errorCode: "EMPTY_FILE" });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ ok: false, errorCode: "FILE_TOO_LARGE", maxSizeMb: MAX_FILE_SIZE_BYTES / (1024 * 1024) });
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
      trips: raw.trips,
    });

    if (
      payload.sites.length === 0 &&
      payload.logs.length === 0 &&
      payload.certifications.length === 0 &&
      payload.trips.length === 0
    ) {
      return NextResponse.json({ ok: false, errorCode: "EMPTY_PAYLOAD" });
    }

    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    // DivingLogFileError.message carries raw SQLite internals (table/column
    // names) — useful while debugging locally, not something to surface to
    // the end user, so only the generic code crosses the response boundary.
    if (error instanceof DivingLogFileError) {
      return NextResponse.json({ ok: false, errorCode: "UNRECOGNIZED_FILE" });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, errorCode: "UNRECOGNIZED_FILE" });
    }
    return NextResponse.json({ ok: false, errorCode: "UNKNOWN" });
  } finally {
    await fs.rm(tmpPath, { force: true });
  }
}
