"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Plane, Map, Waves, LogOut, User, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

interface NavbarProps {
  user: { name?: string | null; email?: string | null; image?: string | null; isAdmin?: boolean };
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const { t } = useT();

  const navLinks = [
    { href: "/dashboard", label: t.navHome, icon: Map },
    { href: "/trips", label: t.navTrips, icon: Plane },
    { href: "/dives", label: t.navDives, icon: Waves },
  ];

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.[0].toUpperCase() ?? "U";

  return (
    <>
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
            <Plane className="h-5 w-5 text-primary" />
            TripPlanner
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  buttonVariants({ variant: pathname.startsWith(href) ? "secondary" : "ghost", size: "sm" }),
                  "flex items-center gap-2"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className="relative h-9 w-9 rounded-full cursor-pointer outline-none">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 py-2 md:py-1" render={<Link href="/profile" />}>
                <User className="h-4 w-4" />
                {t.navProfile}
              </DropdownMenuItem>
              {user.isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 py-2 md:py-1" render={<Link href="/admin" />}>
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {t.navAdmin}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive gap-2 py-2 md:py-1 cursor-pointer"
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              >
                <LogOut className="h-4 w-4" />
                {t.navSignOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-3">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-xs font-medium",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
