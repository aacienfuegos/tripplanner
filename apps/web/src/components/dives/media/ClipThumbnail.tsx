"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Film, Image as ImageIcon } from "lucide-react";
import type { DiveClip } from "@/lib/dive-media";

export type ThumbState = "loading" | "loaded" | "unavailable";

// Un host interno inalcanzable desde fuera de la red no emite `error`: cuelga
// hasta que expira el timeout de red. Sin este reloj propio la tarjeta se queda
// en blanco indefinidamente y el estado de "sin miniatura" nunca se renderiza.
const ATTEMPT_TIMEOUT_MS = [3000, 5000];
// Con un solo host configurado no hay adónde saltar, y rendirse a los 3 s sería
// injusto: Jellyfin genera la miniatura la primera vez que se la piden, y la de
// un vídeo 4K tarda más que eso. Se espera mucho más antes de darla por perdida.
const FINAL_TIMEOUT_MS = 15000;

// Un clip que Jellyfin todavía no ha indexado no tiene ItemId, y sin él no hay
// adónde enlazar: la tarjeta se pinta igual, pero no es un enlace.
export function ClipLink({
  clip,
  className,
  title,
  ariaLabel,
  children,
}: {
  clip: { readonly detailsUrls: readonly string[] };
  className?: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const href = clip.detailsUrls[0];
  if (!href) {
    return (
      <div className={className} title={title} aria-label={ariaLabel}>
        {children}
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
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
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // La rejilla llega a tener cientos de tarjetas y la imagen no se pide hasta
  // que se acerca a la pantalla. Sin saber eso, el reloj de abajo corría
  // también para las que el navegador no había pedido todavía y las daba por
  // rotas sin haberlas intentado: al bajar, media rejilla ya se había rendido.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // El callback llega como lambda del padre, así que cambia de identidad en
  // cada render suyo. Con él en las dependencias el efecto se reejecuta en cada
  // render y el setState de vuelta realimenta el ciclo.
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  useEffect(() => {
    onStateRef.current?.(state);
  }, [state]);

  // Una imagen que termina de cargar antes de que React hidrate no dispara
  // nunca `onLoad`: el evento ya pasó cuando se engancha el listener. Sin esta
  // comprobación, justo las miniaturas más rápidas se daban por fallidas.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setState("loaded");
  }, [url]);

  useEffect(() => {
    if (state !== "loading" || !url || !visible) return;
    const hasNext = attempt + 1 < clip.imageUrls.length;
    const delay = hasNext ? (ATTEMPT_TIMEOUT_MS[attempt] ?? 5000) : FINAL_TIMEOUT_MS;
    const timeout = setTimeout(() => setAttempt((current) => current + 1), delay);
    return () => clearTimeout(timeout);
  }, [attempt, state, url, visible, clip.imageUrls.length]);

  useEffect(() => {
    if (!url && state === "loading") setState("unavailable");
  }, [url, state]);

  return (
    <>
      <div
        ref={boxRef}
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
      {url && visible && state !== "unavailable" && (
        <img
          ref={imgRef}
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
