import "server-only";

export type MediaConfig = {
  // Ruta del bind read-only dentro del contenedor.
  readonly libraryPath: string;
  // Solo para el escaneo de directorio: la misma biblioteca vista desde
  // Jellyfin, para poder calcular el ItemId. Con manifiesto el ItemId lo trae
  // ya resuelto el generador y esto sobra.
  readonly jellyfinLibraryPath: string | null;
  // La URL pública, y solo esa. La interna está detrás de forward-auth, y una
  // miniatura es un subrecurso cross-site que no lleva la cookie de sesión: por
  // ese host nunca llegó a servirse una imagen, solo la pantalla de login.
  readonly jellyfinUrl: string;
};

export function getMediaConfig(): MediaConfig | null {
  const libraryPath = process.env.MEDIA_LIBRARY_PATH?.trim();
  const jellyfinLibraryPath = process.env.JELLYFIN_LIBRARY_PATH?.trim() || null;
  if (!libraryPath) return null;

  const jellyfinUrl = process.env.JELLYFIN_URL?.trim();
  if (!jellyfinUrl) return null;

  return { libraryPath, jellyfinLibraryPath, jellyfinUrl };
}
