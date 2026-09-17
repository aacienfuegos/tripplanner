import { createHash } from "node:crypto";

// Jellyfin deriva el Guid del item de forma determinista, así que el link se
// construye desde la ruta sin consultar su API (LibraryManager.GetNewItemIdInternal):
//   key = type.FullName + path
//   return key.GetMD5()          // new Guid(MD5(Encoding.Unicode.GetBytes(key)))
// La ruta va tal cual porque EnableCaseSensitiveItemIds es true por defecto.
const VIDEO_TYPE = "MediaBrowser.Controller.Entities.Video";
const PHOTO_TYPE = "MediaBrowser.Controller.Entities.Photo";

// new Guid(byte[]) lee los tres primeros campos en little-endian; ToString("N")
// los imprime en orden textual, así que hay que invertirlos.
function toGuidHex(hash: Buffer): string {
  const ordered = Buffer.from([
    hash[3], hash[2], hash[1], hash[0],
    hash[5], hash[4],
    hash[7], hash[6],
    ...hash.subarray(8, 16),
  ]);
  return ordered.toString("hex");
}

export function jellyfinItemId(jellyfinPath: string, kind: "VIDEO" | "PHOTO"): string {
  const key = (kind === "PHOTO" ? PHOTO_TYPE : VIDEO_TYPE) + jellyfinPath;
  return toGuidHex(createHash("md5").update(Buffer.from(key, "utf16le")).digest());
}

export function jellyfinDetailsUrl(baseUrl: string, itemId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/web/index.html#!/details?id=${itemId}`;
}

// `quality` es el parámetro que importa: sin él Jellyfin sirve al 90, y
// `maxWidth` apenas recorta —medido, 153 KB por foto—. Con `fillWidth` y
// `quality=80` la misma miniatura baja a 15 KB, que en una rejilla de un par de
// cientos de clips es la diferencia entre 36 MB y 3,6 MB por pantalla.
export function jellyfinPrimaryImageUrl(baseUrl: string, itemId: string, width = 320): string {
  return `${baseUrl.replace(/\/$/, "")}/Items/${itemId}/Images/Primary?fillWidth=${width}&quality=80`;
}
