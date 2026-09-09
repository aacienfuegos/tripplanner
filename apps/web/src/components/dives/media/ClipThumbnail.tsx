"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Image as ImageIcon } from "lucide-react";
import type { DiveClip } from "@/lib/dive-media";

export type ThumbState = "loading" | "loaded" | "unavailable";

// Un host interno inalcanzable desde fuera de la red no emite `error`: cuelga
// hasta que expira el timeout de red. Sin este reloj propio la tarjeta se queda
// en blanco indefinidamente y el estado de "sin miniatura" nunca se renderiza.
const ATTEMPT_TIMEOUT_MS = [3000, 5000];

export function clipTime(capturedAt: Date | string): string {
  return new Date(capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ClipTypeIcon({ kind, className }: { kind: DiveClip["kind"]; className?: string }) {
  return kind === "VIDEO" ? <Film className={className} /> : <ImageIcon className={className} />;
}

// La miniatura la sirve Jellyfin al navegador, y fallar es un caso frecuente
// (sesión caducada, fuera de la red), no excepcional. Por eso se pinta primero
// el marcador de posición y la imagen asciende encima al cargar, en vez de
// pintar un <img> y degradarlo: así el estado más común aparece al instante.
export function ClipThumbnail({
  clip,
  onState,
}: {
  clip: DiveClip;
  onState?: (state: ThumbState) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ThumbState>(
    clip.imageUrls.length === 0 ? "unavailable" : "loading",
  );
  const url = clip.imageUrls[attempt];

  // El callback llega como lambda del padre, así que cambia de identidad en
  // cada render suyo. Con él en las dependencias el efecto se reejecuta en cada
  // render y el setState de vuelta realimenta el ciclo.
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  useEffect(() => {
    onStateRef.current?.(state);
  }, [state]);

  useEffect(() => {
    if (state !== "loading" || !url) return;
    const timeout = setTimeout(() => setAttempt((current) => current + 1), ATTEMPT_TIMEOUT_MS[attempt] ?? 5000);
    return () => clearTimeout(timeout);
  }, [attempt, state, url]);

  useEffect(() => {
    if (!url && state === "loading") setState("unavailable");
  }, [url, state]);

  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 bg-muted/40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, color-mix(in oklab, var(--muted-foreground) 7%, transparent) 0 1px, transparent 1px 7px)",
        }}
      />
      {state === "unavailable" && (
        <ClipTypeIcon
          kind={clip.kind}
          className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50"
        />
      )}
      {url && state !== "unavailable" && (
        <img
          src={url}
          alt=""
          loading="lazy"
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setState("loaded")}
          onError={() => setAttempt((current) => current + 1)}
        />
      )}
    </>
  );
}
