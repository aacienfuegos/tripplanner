"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rescanMediaLibrary } from "@/actions/media";
import { useT } from "@/contexts/LanguageContext";
import type { LibraryDay } from "@/lib/dive-media";
import { ClipThumbnail, ClipTypeIcon, clipTime } from "./ClipThumbnail";

export function MediaLibrary({
  days,
  canRescan,
}: {
  days: readonly LibraryDay[];
  canRescan: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  const total = days.reduce((sum, day) => sum + day.clips.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t.diveMediaLibraryCount.replace("{n}", String(total))}
        </p>
        {canRescan && (
          <Button size="sm" variant="outline" disabled={pending} onClick={rescan}>
            <RefreshCw className={pending ? "animate-spin" : ""} />
            {pending ? t.diveMediaRescanning : t.diveMediaRescan}
          </Button>
        )}
      </div>

      {days.length === 0 && <p className="text-sm text-muted-foreground">{t.diveMediaEmptyLibrary}</p>}

      {days.map((day) => (
        <section key={day.day} className="space-y-2">
          <header className="flex items-baseline gap-2">
            <h3 className="text-sm font-medium tabular-nums">{day.day}</h3>
            <span className="text-xs text-muted-foreground">· {day.clips.length}</span>
            {day.offsetMinutes !== 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                {day.offsetMinutes > 0 ? "+" : ""}
                {day.offsetMinutes} min
                {day.offsetSource === "MANUAL" ? ` · ${t.diveMediaOffsetManual}` : ""}
              </Badge>
            )}
          </header>

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {day.clips.map((clip) => (
              <li key={clip.id} className="space-y-1">
                <a
                  href={clip.detailsUrls[0]}
                  target="_blank"
                  rel="noreferrer"
                  title={clip.filename}
                  className="relative block aspect-video overflow-hidden rounded-md"
                >
                  <ClipThumbnail clip={clip} />
                  <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/55 p-0.5 backdrop-blur-sm">
                    <ClipTypeIcon kind={clip.kind} className="size-2.5 text-white" />
                  </span>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-0.5 text-[10px] font-medium text-white tabular-nums">
                    {clipTime(clip.capturedAt)}
                  </span>
                </a>
                {clip.diveLogId ? (
                  <Link
                    href={`/dives/${clip.diveLogId}`}
                    className="block text-center text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    #{clip.diveNumber}
                  </Link>
                ) : (
                  <p className="text-center text-[10px] text-muted-foreground/50">
                    {t.diveMediaLibraryOrphans}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
