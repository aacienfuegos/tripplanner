"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Film, Info, Library, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { rescanMediaLibrary, setClipLinks } from "@/actions/media";
import { formatUtcOffset } from "@/lib/media-match";
import { useT } from "@/contexts/LanguageContext";
import type { DiveMedia as DiveMediaData } from "@/lib/dive-media";
import { ClipTile } from "./media/ClipTile";
import type { ThumbState } from "./media/ClipThumbnail";
import { MediaPicker } from "./media/MediaPicker";

export function DiveMedia({
  diveLogId,
  dive,
  media,
  canRescan,
}: {
  diveLogId: string;
  dive: { date: string; bottomTime: number };
  media: DiveMediaData;
  canRescan: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(new Set());

  const attached = useMemo(() => media.clips.filter((clip) => clip.attached), [media.clips]);

  const trackState = useCallback((clipId: string, state: ThumbState) => {
    setUnavailable((current) => {
      const has = current.has(clipId);
      if (state === "unavailable" ? has : !has) return current;
      const next = new Set(current);
      if (state === "unavailable") next.add(clipId);
      else next.delete(clipId);
      return next;
    });
  }, []);

  // La causa de que no carguen (sin sesión en Jellyfin, fuera de la red) es
  // global: el aviso va una vez bajo la rejilla, no repetido en cada tarjeta.
  // Que falle una sola es otra cosa — un fichero movido — y no merece aviso.
  const showThumbnailNotice =
    attached.length > 0 && unavailable.size >= Math.max(2, Math.ceil(attached.length / 2));

  function rescan() {
    startTransition(async () => {
      const result = await rescanMediaLibrary();
      if ("error" in result) {
        const messages: Record<string, string> = {
          unreachable: t.diveMediaScanUnreachable,
          empty: t.diveMediaScanEmpty,
        };
        toast.error(messages[result.error] ?? t.diveMediaScanUnreachable);
        return;
      }
      toast.success(`${t.diveMediaScanDone} (${result.indexed})`);
      router.refresh();
    });
  }

  function remove(clipId: string) {
    startTransition(async () => {
      const clip = media.clips.find((candidate) => candidate.id === clipId);
      // Quitar un clip que el automático empareja exige un override explícito;
      // borrar la fila lo devolvería a la rejilla en el siguiente render.
      await setClipLinks(diveLogId, [{ clipId, included: clip?.auto ? false : null }]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="text-sm font-medium">{t.diveMediaTitle}</h4>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px] tabular-nums">
            {attached.length}
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus />
            {t.diveMediaManage}
          </Button>
          {canRescan && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="icon-sm" variant="ghost" aria-label={t.diveMediaRescan} />}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={pending} onClick={rescan}>
                  <RefreshCw className={pending ? "animate-spin" : ""} />
                  {pending ? t.diveMediaRescanning : t.diveMediaRescan}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/dives?tab=media" />}>
                  <Library />
                  {t.diveMediaLibraryTitle}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {media.offsetSource !== null && (
        <p className="text-xs text-muted-foreground">
          {t.diveMediaClockOffset}: <span className="tabular-nums">{formatUtcOffset(media.offsetMinutes)}</span>
        </p>
      )}

      {media.clips.length === 0 ? (
        <div className="space-y-3 py-10 text-center">
          <Film className="mx-auto size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t.diveMediaEmptyLibrary}</p>
          {canRescan && (
            <Button size="sm" variant="outline" disabled={pending} onClick={rescan}>
              <RefreshCw className={pending ? "animate-spin" : ""} />
              {pending ? t.diveMediaRescanning : t.diveMediaRescan}
            </Button>
          )}
        </div>
      ) : attached.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground">{t.diveMediaNoneAttached}</p>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus />
            {t.diveMediaManage}
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {attached.map((clip) => (
            <ClipTile
              key={clip.id}
              clip={clip}
              onRemove={() => remove(clip.id)}
              onState={(state) => trackState(clip.id, state)}
            />
          ))}
        </ul>
      )}

      {showThumbnailNotice && media.jellyfinUrls.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            {t.diveMediaThumbnailFallback}{" "}
            <a
              href={media.jellyfinUrls[0]}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
            >
              {t.diveMediaOpenJellyfin}
              <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
      )}

      {pickerOpen && (
        <MediaPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          diveLogId={diveLogId}
          dive={dive}
          diveWindow={media.diveWindow}
          clips={media.clips}
          day={media.day}
          offsetMinutes={media.offsetMinutes}
          offsetSource={media.offsetSource}
        />
      )}
    </div>
  );
}
