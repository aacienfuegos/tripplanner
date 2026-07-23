"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Hotel, Star, DollarSign, ShoppingBag, FileText, ClipboardList, MoreHorizontal } from "lucide-react";
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

interface TripNavProps {
  tripId: string;
  counts: TripNavCounts;
}

const MAIN_SECTIONS = [
  { href: "flights", label: "Vuelos", icon: Plane, countKey: "flights" },
  { href: "accommodations", label: "Alojamientos", icon: Hotel, countKey: "accommodations" },
  { href: "activities", label: "Actividades", icon: Star, countKey: "activities" },
  { href: "expenses", label: "Gastos", icon: DollarSign, countKey: "expenses" },
] as const;

const MORE_SECTIONS = [
  { href: "packing", label: "Maleta", icon: ShoppingBag, countKey: "packingItems" },
  { href: "documents", label: "Documentos", icon: FileText, countKey: "documents" },
  { href: "tasks", label: "Tareas", icon: ClipboardList, countKey: "tasks" },
] as const;

export function TripNav({ tripId, counts }: TripNavProps) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;
  const isMoreActive = MORE_SECTIONS.some((s) => pathname === `${base}/${s.href}`);

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
          Más
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
