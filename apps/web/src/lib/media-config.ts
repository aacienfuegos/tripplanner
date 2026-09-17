import "server-only";

export type MediaConfig = {
  // Ruta del bind read-only dentro del contenedor.
  readonly libraryPath: string;
  // La misma biblioteca vista desde Jellyfin: entra en el hash del ItemId, y no
  // tiene por qué coincidir con el punto de montaje de este contenedor.
  readonly jellyfinLibraryPath: string;
  readonly internalUrl: string | null;
  readonly publicUrl: string | null;
};

export function getMediaConfig(): MediaConfig | null {
  const libraryPath = process.env.MEDIA_LIBRARY_PATH?.trim();
  const jellyfinLibraryPath = process.env.JELLYFIN_LIBRARY_PATH?.trim();
  if (!libraryPath || !jellyfinLibraryPath) return null;

  const internalUrl = process.env.JELLYFIN_INTERNAL_URL?.trim() || null;
  const publicUrl = process.env.JELLYFIN_PUBLIC_URL?.trim() || null;
  if (!internalUrl && !publicUrl) return null;

  return { libraryPath, jellyfinLibraryPath, internalUrl, publicUrl };
}
