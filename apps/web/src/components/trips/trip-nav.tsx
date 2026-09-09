"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Hotel, Star, DollarSign, ShoppingBag, FileText, ClipboardList, MapPin, Milestone, MoreHorizontal, Waves } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TripNavCounts } from "@/lib/trip-nav-counts";
import { useT } from "@/contexts/LanguageContext";
import type { WebTKeys } from "@/i18n";

interface TripNavProps {
  tripId: string;
  counts: TripNavCounts;
}

function mainSections(t: WebTKeys) {
  return [
    { href: "flights", label: t.sectionFlights, icon: Plane, countKey: "flights" },
    { href: "accommodations", label: t.sectionAccommodations, icon: Hotel, countKey: "accommodations" },
    { href: "activities", label: t.sectionActivities, icon: Star, countKey: "activities" },
    { href: "expenses", label: t.sectionExpenses, icon: DollarSign, countKey: "expenses" },
  ] as const;
}

function moreSections(t: WebTKeys) {
  return [
    { href: "destinations", label: t.sectionDestinations, icon: Milestone, countKey: "destinations" },
    { href: "packing", label: t.sectionPacking, icon: ShoppingBag, countKey: "packingItems" },
    { href: "documents", label: t.sectionDocuments, icon: FileText, countKey: "documents" },
    { href: "tasks", label: t.sectionTasks, icon: ClipboardList, countKey: "tasks" },
    { href: "dives", label: t.sectionDives, icon: Waves, countKey: "dives" },
  ] as const;
}

export function TripNav({ tripId, counts }: TripNavProps) {
  const { t } = useT();
  const pathname = usePathname();
  const base = `/trips/${tripId}`;
  const MAIN_SECTIONS = mainSections(t);
  const MORE_SECTIONS = moreSections(t);
  const isMoreActive =
    MORE_SECTIONS.some((s) => pathname === `${base}/${s.href}`) || pathname === `${base}/map`;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {MAIN_SECTIONS.map(({ href, label, icon: Icon, countKey }) => {
        const active = pathname === `${base}/${href}`;
        const count = counts[countKey];
        return (
          <Link
            key={href}
            href={`${base}/${href}`}
            className={cn(buttonVariants({ variant: active ? "secondary" : "outline", size: "sm" }), "shrink-0")}
          >
            <Icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            <span className="shrink-0">{label}</span>
            {count > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1 shrink-0">{count}</Badge>
            )}
          </Link>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: isMoreActive ? "secondary" : "outline", size: "sm" }), "shrink-0")}
        >
          <MoreHorizontal className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          {t.moreSections}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {MORE_SECTIONS.map(({ href, label, icon: Icon, countKey }) => {
            const count = counts[countKey];
            return (
              <DropdownMenuItem key={href} className="gap-2">
                <Link href={`${base}/${href}`} className="flex flex-1 items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {count > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{count}</Badge>}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem className="gap-2">
            <Link href={`${base}/map`} className="flex flex-1 items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="flex-1">{t.sectionMap}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
