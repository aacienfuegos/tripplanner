"use client";

import { Languages } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

export function LanguageToggle() {
  const { locale, setLocale, t } = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-9 w-9 cursor-pointer")}
        aria-label={t.language}
      >
        <Languages className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLocale("es")}
          className={cn("cursor-pointer", locale === "es" && "font-semibold")}
        >
          {t.langEs}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocale("en")}
          className={cn("cursor-pointer", locale === "en" && "font-semibold")}
        >
          {t.langEn}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
