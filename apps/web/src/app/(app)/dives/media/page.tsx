import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MediaLibrary } from "@/components/dives/media/MediaLibrary";
import { getMediaLibrary } from "@/lib/dive-media";
import { getT } from "@/lib/locale";

export default async function MediaLibraryPage() {
  const userId = await requireUser();
  const [t, days, user] = await Promise.all([
    getT(),
    getMediaLibrary(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
  ]);
  if (!days) notFound();

  const total = days.reduce((sum, day) => sum + day.clips.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dives" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={t.diveMediaTitle}>
          <ArrowLeft />
        </Link>
        <div>
          <h2 className="text-xl font-semibold">{t.diveMediaLibraryTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {t.diveMediaLibraryCount.replace("{n}", String(total))}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <MediaLibrary days={days} canRescan={user?.isAdmin ?? false} />
        </CardContent>
      </Card>
    </div>
  );
}
