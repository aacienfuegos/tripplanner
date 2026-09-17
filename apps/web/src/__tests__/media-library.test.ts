import { describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("server-only", () => ({}));

const { ManifestError, scanMediaLibrary } = await import("@/lib/media-library");

const LIBRARY = "/mnt/media/buceo";

async function manifestWith(body: unknown): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "media-manifest-"));
  const file = path.join(dir, "manifest.json");
  await writeFile(file, JSON.stringify(body));
  return file;
}

const validClip = {
  path: "2026-01/DJI_20260124123308_0002_D.MP4",
  kind: "VIDEO",
  capturedAt: "2026-01-24T07:33:08.000Z",
  sizeBytes: 1_240_000_000,
};

const validManifest = { version: 1, generatedAt: "2026-09-17T18:00:00.000Z", libraryPath: LIBRARY, clips: [validClip] };

describe("scanMediaLibrary con manifiesto", () => {
  it("toma el instante del manifiesto tal cual", async () => {
    const clips = await scanMediaLibrary(await manifestWith(validManifest), LIBRARY);
    expect(clips).toEqual([
      {
        path: validClip.path,
        kind: "VIDEO",
        capturedAt: new Date("2026-01-24T07:33:08.000Z"),
        sizeBytes: BigInt(1_240_000_000),
      },
    ]);
  });

  it("tolera una barra final de más en la raíz", async () => {
    const file = await manifestWith({ ...validManifest, libraryPath: `${LIBRARY}/` });
    await expect(scanMediaLibrary(file, LIBRARY)).resolves.toHaveLength(1);
  });

  it("rechaza un manifiesto de otra biblioteca", async () => {
    const file = await manifestWith({ ...validManifest, libraryPath: "/mnt/media/otro" });
    await expect(scanMediaLibrary(file, LIBRARY)).rejects.toThrow(
      expect.objectContaining({ code: "library-mismatch" }),
    );
  });

  it.each([
    ["sin capturedAt", { ...validClip, capturedAt: undefined }],
    ["con hora sin huso", { ...validClip, capturedAt: "2026-01-24T07:33:08" }],
    ["con ruta absoluta", { ...validClip, path: "/mnt/media/buceo/DJI.MP4" }],
    ["con ruta que sale de la raíz", { ...validClip, path: "../otro/DJI.MP4" }],
    ["con tamaño negativo", { ...validClip, sizeBytes: -1 }],
  ])("rechaza un clip %s", async (_name, clip) => {
    const file = await manifestWith({ ...validManifest, clips: [clip] });
    await expect(scanMediaLibrary(file, LIBRARY)).rejects.toBeInstanceOf(ManifestError);
  });

  it("rechaza un manifiesto vacío", async () => {
    const file = await manifestWith({ ...validManifest, clips: [] });
    await expect(scanMediaLibrary(file, LIBRARY)).rejects.toBeInstanceOf(ManifestError);
  });
});

describe("scanMediaLibrary con directorio", () => {
  it("deduce el instante restando el huso del reloj de la cámara", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "media-dir-"));
    // El nombre marca las 12:33:08 y el fichero se grabó a las 07:33:08 UTC:
    // la cámara iba en UTC+5.
    const instant = new Date("2026-01-24T07:33:08.000Z");
    for (const name of ["DJI_20260124123308_0002_D.MP4", "DJI_20260124124118_0003_D.MP4"]) {
      const file = path.join(dir, name);
      await writeFile(file, "");
      const shift = name.includes("124118") ? 8 * 60_000 + 10_000 : 0;
      await utimes(file, new Date(instant.getTime() + shift), new Date(instant.getTime() + shift));
    }

    const clips = await scanMediaLibrary(dir, LIBRARY);
    expect(clips.map((clip) => clip.capturedAt.toISOString())).toEqual([
      "2026-01-24T07:33:08.000Z",
      "2026-01-24T07:41:18.000Z",
    ]);
  });
});
