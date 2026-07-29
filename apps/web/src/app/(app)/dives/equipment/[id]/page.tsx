import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Anchor, ArrowLeft, Waves, ArrowDownToLine, Timer, AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EquipmentDetailActions } from "@/components/dives/equipment-detail-actions";
import { equipmentCategoryLabel } from "@/lib/equipment-category";
import { isServiceDue } from "@/lib/equipment-service";
import { formatDiveDate } from "@/lib/dive-date";
import { getT } from "@/lib/locale";

export default async function DiveEquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUser();

  const [t, equipment, dives] = await Promise.all([
    getT(),
    prisma.diveEquipment.findUnique({ where: { id, userId } }),
    prisma.diveLog.findMany({ where: { userId, equipment: { some: { id } } }, orderBy: { date: "desc" } }),
  ]);
  if (!equipment) notFound();

  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const currencyFormatter = new Intl.NumberFormat(t.locale === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: "EUR",
  });

  return (
    <div className="space-y-6">
      <Link href="/dives/equipment" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> {t.diveEquipmentTab}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Anchor className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{equipment.name}</h1>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline">{equipmentCategoryLabel(equipment.category, t)}</Badge>
            {isServiceDue(equipment) && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {t.equipmentServiceDue}
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground space-y-0.5">
            {(equipment.brand || equipment.model) && <p>{[equipment.brand, equipment.model].filter(Boolean).join(" ")}</p>}
            {equipment.size && <p>{t.equipmentSize}: {equipment.size}</p>}
            {equipment.serialNumber && <p>{t.equipmentSerialNumber}: {equipment.serialNumber}</p>}
            {equipment.purchaseDate && (
              <p>
                {t.equipmentPurchaseDate}: {format(equipment.purchaseDate, "d MMM yyyy", { locale: dfLocale })}
                {equipment.purchasePrice != null && ` · ${currencyFormatter.format(equipment.purchasePrice)}`}
              </p>
            )}
            {equipment.lastServiceDate && (
              <p>
                {t.equipmentLastServiceDate}: {format(equipment.lastServiceDate, "d MMM yyyy", { locale: dfLocale })}
              </p>
            )}
          </div>
          {equipment.notes && <p className="text-sm italic text-muted-foreground max-w-prose">{equipment.notes}</p>}
        </div>
        <EquipmentDetailActions equipment={equipment} />
      </div>

      {dives.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Waves className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noEquipmentDives}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {dives.map((dive) => (
            <Link key={dive.id} href={`/dives#${dive.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="py-3 flex items-center gap-4">
                  <Badge variant="secondary">#{dive.diveNumber}</Badge>
                  <span className="text-sm text-muted-foreground flex-1">{formatDiveDate(dive.date, dfLocale)}</span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <ArrowDownToLine className="h-3.5 w-3.5" /> {dive.depthMax} m
                    <Timer className="h-3.5 w-3.5 ml-2" /> {dive.bottomTime} min
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
