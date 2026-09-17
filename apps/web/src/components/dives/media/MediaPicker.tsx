"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Minus, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { setClipLinks, setDaySiteOffset } from "@/actions/media";
import { formatUtcOffset, groupIntoSessions, sessionOverlapsDive } from "@/lib/media-match";
import { useT } from "@/contexts/LanguageContext";
import type { DiveClip } from "@/lib/dive-media";
import { ClipThumbnail, ClipTypeIcon } from "./ClipThumbnail";

const OFFSET_STEP_MINUTES = 30;
const COLLAPSED_PREVIEW = 6;

type Filter = "ALL" | "VIDEO" | "PHOTO";

function SessionTile({
  clip,
  selected,
  onToggle,
}: {
  clip: DiveClip;
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useT();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      aria-label={`${clip.kind === "VIDEO" ? t.diveMediaVideoAria : t.diveMediaPhotoAria} ${clip.time}`}
      title={clip.filename}
      className={`relative aspect-video overflow-hidden rounded-md transition-opacity ${
        selected
          ? "opacity-100 ring-2 ring-primary ring-offset-2 ring-offset-popover"
          : "opacity-60 hover:opacity-100"
      }`}
    >
      <ClipThumbnail clip={clip} />
      <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/55 p-0.5 backdrop-blur-sm">
        <ClipTypeIcon kind={clip.kind} className="size-2.5 text-white" />
      </span>
      {selected && (
        <span className="pointer-events-none absolute top-1 right-1 rounded-full bg-primary p-0.5">
          <Check className="size-2.5 text-primary-foreground" />
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-left text-[10px] font-medium text-white tabular-nums">
        {clip.time}
      </span>
    </button>
  );
}

function Session({
  clips,
  overlaps,
  otherDay,
  selection,
  onToggle,
  onBulk,
}: {
  clips: readonly DiveClip[];
  overlaps: boolean;
  otherDay: boolean;
  selection: ReadonlySet<string>;
  onToggle: (clipId: string) => void;
  onBulk: (clipIds: readonly string[], selected: boolean) => void;
}) {
  const { t } = useT();
  // Las ráfagas que no tocan la inmersión llegan plegadas: al abrir el panel se
  // ven un puñado de cabeceras, no doscientas miniaturas pidiéndose a Jellyfin.
  const [expanded, setExpanded] = useState(overlaps);
  const visible = expanded ? clips : clips.slice(0, COLLAPSED_PREVIEW);
  const allSelected = clips.every((clip) => selection.has(clip.id));

  return (
    <section className={`pl-3 ${overlaps ? "border-l-2 border-primary" : "border-l-2 border-transparent"}`}>
      <header className="sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-popover/95 py-1.5 backdrop-blur">
        <div className="flex items-baseline gap-2 truncate">
          <span className="text-xs font-medium tabular-nums">
            {/* El selector abarca el día ±1, así que sin fecha una ráfaga de la
                víspera parece de la misma jornada. */}
            {otherDay && `${clips[0].day} · `}
            {clips[0].time} – {clips[clips.length - 1].time}
          </span>
          <span className="text-xs text-muted-foreground">· {clips.length}</span>
          {overlaps && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {t.diveMediaOverlaps}
            </Badge>
          )}
        </div>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onBulk(clips.map((clip) => clip.id), !allSelected)}
        >
          {allSelected ? t.diveMediaClearAll : t.diveMediaSelectAll}
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-2 pt-1 sm:grid-cols-4">
        {visible.map((clip) => (
          <SessionTile
            key={clip.id}
            clip={clip}
            selected={selection.has(clip.id)}
            onToggle={() => onToggle(clip.id)}
          />
        ))}
      </div>

      {!expanded && clips.length > COLLAPSED_PREVIEW && (
        <Button size="sm" variant="ghost" className="mt-1.5" onClick={() => setExpanded(true)}>
          {t.diveMediaShowRest.replace("{n}", String(clips.length - COLLAPSED_PREVIEW))}
        </Button>
      )}
    </section>
  );
}

export function MediaPicker({
  open,
  onOpenChange,
  diveLogId,
  dive,
  diveWindow,
  clips,
  day,
  offsetMinutes,
  offsetSource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diveLogId: string;
  dive: { date: string; bottomTime: number };
  diveWindow: { start: string; end: string; date: string };
  clips: readonly DiveClip[];
  day: string;
  offsetMinutes: number;
  offsetSource: "AUTO" | "MANUAL" | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selection, setSelection] = useState<ReadonlySet<string>>(
    () => new Set(clips.filter((clip) => clip.attached).map((clip) => clip.id)),
  );

  const matchable = useMemo(
    () => ({ id: diveLogId, date: new Date(dive.date), bottomTime: dive.bottomTime }),
    [diveLogId, dive.date, dive.bottomTime],
  );

  const sessions = useMemo(() => {
    const withDates = clips.map((clip) => ({ ...clip, capturedAt: new Date(clip.capturedAt) }));
    const needle = query.trim().toLowerCase();
    const filtered = withDates.filter(
      (clip) =>
        (filter === "ALL" || clip.kind === filter) &&
        (needle === "" || clip.filename.toLowerCase().includes(needle)),
    );
    return groupIntoSessions(filtered).map((session) => ({
      clips: session,
      overlaps: sessionOverlapsDive(session, matchable, offsetMinutes),
      otherDay: session[0].day !== diveWindow.date,
    }));
  }, [clips, query, filter, matchable, offsetMinutes, diveWindow.date]);

  const changes = useMemo(
    () =>
      clips
        .filter((clip) => selection.has(clip.id) !== clip.attached)
        .map((clip) => {
          const included = selection.has(clip.id);
          // Si el estado deseado ya es el que da el automático, se borra el
          // override en vez de duplicarlo: así el clip vuelve a seguir al
          // desfase del día si este cambia después.
          return { clipId: clip.id, included: included === clip.auto ? null : included };
        }),
    [clips, selection],
  );
  const added = changes.filter((change) => change.included !== false).length;
  const removed = changes.length - added;

  function toggle(clipId: string) {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }

  function bulk(clipIds: readonly string[], selected: boolean) {
    setSelection((current) => {
      const next = new Set(current);
      for (const clipId of clipIds) {
        if (selected) next.add(clipId);
        else next.delete(clipId);
      }
      return next;
    });
  }

  function shiftOffset(delta: number) {
    startTransition(async () => {
      await setDaySiteOffset(day, offsetMinutes + delta);
      router.refresh();
    });
  }

  function save() {
    startTransition(async () => {
      await setClipLinks(diveLogId, changes);
      toast.success(t.diveMediaSave);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* SheetContent trae data-[side=right]:sm:max-w-sm horneado; hay que
          sobrescribirlo con el mismo prefijo o tailwind-merge no lo deduplica. */}
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="space-y-3 border-b px-5 py-4">
          <div>
            <SheetTitle className="text-base">{t.diveMediaPickerTitle}</SheetTitle>
            <SheetDescription className="text-xs">
              {diveWindow.start} – {diveWindow.end} · {diveWindow.date}
            </SheetDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t.diveMediaClockOffset}</span>
            <div className="flex items-center gap-1">
              <Button size="icon-xs" variant="outline" disabled={pending} onClick={() => shiftOffset(-OFFSET_STEP_MINUTES)}>
                <Minus />
              </Button>
              <span className="min-w-20 text-center text-xs font-medium tabular-nums">
                {formatUtcOffset(offsetMinutes)}
              </span>
              <Button size="icon-xs" variant="outline" disabled={pending} onClick={() => shiftOffset(OFFSET_STEP_MINUTES)}>
                <Plus />
              </Button>
            </div>
            {offsetSource && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {offsetSource === "AUTO" ? t.diveMediaOffsetAuto : t.diveMediaOffsetManual}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.diveMediaSearch}
                className="h-8 pl-7 text-xs"
              />
            </div>
            {(["ALL", "VIDEO", "PHOTO"] as const).map((value) => (
              <Button
                key={value}
                size="xs"
                variant={filter === value ? "secondary" : "ghost"}
                onClick={() => setFilter(value)}
              >
                {value === "ALL" ? t.diveMediaFilterAll : value === "VIDEO" ? t.diveMediaFilterVideo : t.diveMediaFilterPhoto}
              </Button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.diveMediaNoMatches}</p>
          ) : (
            sessions.map((session) => (
              <Session
                key={session.clips[0].id}
                clips={session.clips}
                overlaps={session.overlaps}
                otherDay={session.otherDay}
                selection={selection}
                onToggle={toggle}
                onBulk={bulk}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {changes.length === 0
              ? t.diveMediaNoChanges
              : t.diveMediaChanges.replace("{added}", String(added)).replace("{removed}", String(removed))}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.diveMediaCancel}
            </Button>
            <Button size="sm" disabled={pending || changes.length === 0} onClick={save}>
              {t.diveMediaSave}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
