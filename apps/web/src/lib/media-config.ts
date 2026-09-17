import "server-only";

export type MediaConfig = {
  // Ruta del bind read-only dentro del contenedor.
  readonly libraryPath: string;
  // Solo para el escaneo de directorio: la misma biblioteca vista desde
  // Jellyfin, para poder calcular el ItemId. Con manifiesto el ItemId lo trae
  // ya resuelto el generador y esto sobra.
  readonly jellyfinLibraryPath: string | null;
  readonly internalUrl: string | null;
  readonly publicUrl: string | null;
};

export function getMediaConfig(): MediaConfig | null {
  const libraryPath = process.env.MEDIA_LIBRARY_PATH?.trim();
  const jellyfinLibraryPath = process.env.JELLYFIN_LIBRARY_PATH?.trim() || null;
  if (!libraryPath) return null;

  const internalUrl = process.env.JELLYFIN_INTERNAL_URL?.trim() || null;
  const publicUrl = process.env.JELLYFIN_PUBLIC_URL?.trim() || null;
  if (!internalUrl && !publicUrl) return null;

  return { libraryPath, jellyfinLibraryPath, internalUrl, publicUrl };
}
