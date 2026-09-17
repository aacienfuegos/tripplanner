"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipThumbnail, ClipTypeIcon, clipTime, type ThumbState } from "./ClipThumbnail";
import { useT } from "@/contexts/LanguageContext";
import type { DiveClip } from "@/lib/dive-media";

export function ClipTile({
  clip,
  onRemove,
  onState,
}: {
  clip: DiveClip;
  onRemove: () => void;
  onState?: (state: ThumbState) => void;
}) {
  const { t } = useT();
  const kindLabel = clip.kind === "VIDEO" ? t.diveMediaVideoAria : t.diveMediaPhotoAria;
  // Un override que coincide con lo que ya decía el automático no es una
  // decisión del usuario, así que no merece badge.
  const manual = clip.attached !== clip.auto;

  return (
    <li className="group relative aspect-video overflow-hidden rounded-lg bg-muted">
      <a
        href={clip.detailsUrls[0]}
        target="_blank"
        rel="noreferrer"
        title={clip.filename}
        aria-label={`${kindLabel} ${clipTime(clip.capturedAt)}`}
        className="absolute inset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ClipThumbnail clip={clip} onState={onState} />
      </a>

      <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-black/55 p-1 backdrop-blur-sm">
        <ClipTypeIcon kind={clip.kind} className="size-3 text-white" />
      </span>

      {manual && (
        <Badge
          variant="secondary"
          className="pointer-events-none absolute top-1.5 right-1.5 h-5 bg-background/85 px-1.5 text-[10px] backdrop-blur-sm"
        >
          {t.diveMediaManual}
        </Badge>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5">
        <span className="text-[11px] font-medium text-white tabular-nums drop-shadow">
          {clipTime(clip.capturedAt)}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onRemove}
          aria-label={`${t.diveMediaRemove}: ${clip.filename}`}
          // En táctil no hay hover: por debajo de md el botón va siempre visible.
          className="pointer-events-auto text-white transition-opacity hover:bg-white/20 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        >
          <X />
        </Button>
      </div>
    </li>
  );
}
