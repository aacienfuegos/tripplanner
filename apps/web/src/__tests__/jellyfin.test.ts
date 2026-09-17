import { describe, it, expect } from "vitest";
import { jellyfinDetailsUrl, jellyfinItemId, jellyfinPrimaryImageUrl } from "@/lib/jellyfin";

describe("jellyfinItemId", () => {
  // Par (ruta, ItemId) verificado contra la instancia real. Si Jellyfin cambia
  // el esquema de derivación del Guid, este test es lo que lo detecta antes de
  // que todos los links de la app apunten a items inexistentes (#311).
  it("reproduce el ItemId real de un vídeo de la biblioteca", () => {
    expect(jellyfinItemId("/mnt/media/buceo/DJI_20260829152524_0235_D.MP4", "VIDEO")).toBe(
      "7edf01d92cb4aee73194c0b112cd4358",
    );
  });

  it("distingue vídeo de foto para la misma ruta", () => {
    const path = "/mnt/media/buceo/DJI_20260822132755_0222_D.JPG";
    expect(jellyfinItemId(path, "PHOTO")).not.toBe(jellyfinItemId(path, "VIDEO"));
  });

  it("es sensible a mayúsculas, como EnableCaseSensitiveItemIds por defecto", () => {
    expect(jellyfinItemId("/mnt/media/buceo/A.MP4", "VIDEO")).not.toBe(
      jellyfinItemId("/mnt/media/buceo/a.mp4", "VIDEO"),
    );
  });

  it("devuelve 32 caracteres hex", () => {
    expect(jellyfinItemId("/mnt/media/buceo/x.mp4", "VIDEO")).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("urls", () => {
  it("construye el deep link del reproductor", () => {
    expect(jellyfinDetailsUrl("https://jellyfin.lan", "abc")).toBe(
      "https://jellyfin.lan/web/index.html#!/details?id=abc",
    );
  });

  it("tolera una barra final en la base", () => {
    expect(jellyfinPrimaryImageUrl("https://jellyfin.lan/", "abc", 200)).toBe(
      "https://jellyfin.lan/Items/abc/Images/Primary?maxWidth=200",
    );
  });
});
