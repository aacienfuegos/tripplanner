import { describe, it, expect } from "vitest";
import { jellyfinDetailsUrl, jellyfinItemId, jellyfinPrimaryImageUrl } from "@/lib/jellyfin";

describe("jellyfinItemId", () => {
  // Vector fijo con una ruta que no existe en ninguna biblioteca: si Jellyfin
  // cambia el esquema de derivación del Guid, este test lo detecta antes de que
  // todos los links de la app apunten a items inexistentes (#311). La
  // equivalencia con la instancia real se comprobó a mano, y no se fija aquí a
  // propósito: el endpoint de imagen de Jellyfin es anónimo, así que publicar
  // un par (ruta real, ItemId) en un repo público es publicar una URL viva.
  it("deriva el Guid como Jellyfin", () => {
    expect(jellyfinItemId("/library/video/CLIP_0001.MP4", "VIDEO")).toBe(
      "29c9c748055d1fbd584da95622925978",
    );
  });

  it("distingue vídeo de foto para la misma ruta", () => {
    const path = "/library/video/CLIP_0002.JPG";
    expect(jellyfinItemId(path, "PHOTO")).not.toBe(jellyfinItemId(path, "VIDEO"));
  });

  it("es sensible a mayúsculas, como EnableCaseSensitiveItemIds por defecto", () => {
    expect(jellyfinItemId("/library/video/A.MP4", "VIDEO")).not.toBe(
      jellyfinItemId("/library/video/a.mp4", "VIDEO"),
    );
  });

  it("devuelve 32 caracteres hex", () => {
    expect(jellyfinItemId("/library/video/x.mp4", "VIDEO")).toMatch(/^[0-9a-f]{32}$/);
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
