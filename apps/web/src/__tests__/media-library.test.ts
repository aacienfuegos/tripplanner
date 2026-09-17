import { describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("server-only", () => ({}));

const { ManifestError, scanMediaLibrary } = await import("@/lib/media-library");
const { jellyfinItemId } = await import("@/lib/jellyfin");

const LIBRARY = "/library/video";

async function manifestWith(body: unknown): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "media-manifest-"));
  const file = path.join(dir, "manifest.json");
  await writeFile(file, JSON.stringify(body));
  return file;
}

const validClip = {
  jellyfin_path: "/library/video/CLIP_0064.MP4",
  jellyfin_item_id: "0000ffff0000ffff0000ffff0000ffff",
  kind: "video",
  captured_at_utc: "2026-01-25T14:13:16Z",
  size_bytes: 93_285_139,
};

const validManifest = { version: 1, generated_at: "2026-09-17T18:00:00Z", clips: [validClip] };

describe("scanMediaLibrary con manifiesto", () => {
  it("toma el instante y el ItemId del manifiesto tal cual", async () => {
    const clips = await scanMediaLibrary(await manifestWith(validManifest), LIBRARY);
    expect(clips).toEqual([
      {
        path: validClip.jellyfin_path,
        itemId: validClip.jellyfin_item_id,
        kind: "VIDEO",
        capturedAt: new Date("2026-01-25T14:13:16Z"),
        sizeBytes: BigInt(93_285_139),
      },
    ]);
  });

  it("acepta un clip que Jellyfin todavía no ha indexado", async () => {
    const file = await manifestWith({
      ...validManifest,
      clips: [{ ...validClip, jellyfin_item_id: null }],
    });
    await expect(scanMediaLibrary(file, LIBRARY)).resolves.toMatchObject([{ itemId: null }]);
  });

  it("no necesita JELLYFIN_LIBRARY_PATH", async () => {
    await expect(scanMediaLibrary(await manifestWith(validManifest), null)).resolves.toHaveLength(1);
  });

  it.each([
    ["sin captured_at_utc", { ...validClip, captured_at_utc: undefined }],
    ["con hora sin huso", { ...validClip, captured_at_utc: "2026-01-25T14:13:16" }],
    ["con ruta relativa", { ...validClip, jellyfin_path: "CLIP_0064.MP4" }],
    ["con kind en mayúsculas", { ...validClip, kind: "VIDEO" }],
    ["con ItemId vacío", { ...validClip, jellyfin_item_id: "" }],
    ["con tamaño negativo", { ...validClip, size_bytes: -1 }],
  ])("rechaza un clip %s", async (_name, clip) => {
    const file = await manifestWith({ ...validManifest, clips: [clip] });
    await expect(scanMediaLibrary(file, LIBRARY)).rejects.toBeInstanceOf(ManifestError);
  });

  it.each([
    ["sin version", { generated_at: validManifest.generated_at, clips: [validClip] }],
    ["de otra versión", { ...validManifest, version: 2 }],
    ["sin clips", { ...validManifest, clips: [] }],
  ])("rechaza un manifiesto %s", async (_name, body) => {
    await expect(scanMediaLibrary(await manifestWith(body), LIBRARY)).rejects.toBeInstanceOf(
      ManifestError,
    );
  });
});

describe("scanMediaLibrary con directorio", () => {
  async function libraryWith(names: readonly string[], instants: readonly Date[]): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "media-dir-"));
    for (const [i, name] of names.entries()) {
      const file = path.join(dir, name);
      await writeFile(file, "");
      await utimes(file, instants[i], instants[i]);
    }
    return dir;
  }

  it("deduce el instante restando el huso del reloj de la cámara y calcula el ItemId", async () => {
    // Los nombres marcan las 12:33:08 y 12:41:18, y los ficheros se grabaron
    // cinco horas antes: la cámara iba en UTC+5.
    const dir = await libraryWith(
      ["DJI_20260124123308_0002_D.MP4", "DJI_20260124124118_0003_D.JPG"],
      [new Date("2026-01-24T07:33:08Z"), new Date("2026-01-24T07:41:18Z")],
    );

    const clips = await scanMediaLibrary(dir, LIBRARY);
    expect(clips.map((clip) => clip.capturedAt.toISOString())).toEqual([
      "2026-01-24T07:33:08.000Z",
      "2026-01-24T07:41:18.000Z",
    ]);
    expect(clips[0].path).toBe(`${LIBRARY}/DJI_20260124123308_0002_D.MP4`);
    expect(clips[0].itemId).toBe(jellyfinItemId(clips[0].path, "VIDEO"));
    expect(clips[1].itemId).toBe(jellyfinItemId(clips[1].path, "PHOTO"));
  });

  it("falla si no sabe cómo ve Jellyfin la biblioteca", async () => {
    const dir = await libraryWith(["DJI_20260124123308_0002_D.MP4"], [new Date()]);
    await expect(scanMediaLibrary(dir, null)).rejects.toBeInstanceOf(ManifestError);
  });
});
