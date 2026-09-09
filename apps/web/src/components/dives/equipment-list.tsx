"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Package, Pencil, Trash2, AlertTriangle, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { EquipmentForm } from "./equipment-form";
import { deleteDiveEquipment } from "@/actions/dive-equipment";
import { equipmentCategoryLabels } from "@/lib/equipment-category";
import { isServiceDue } from "@/lib/equipment-service";
import type { DiveEquipmentWithCount } from "@/types";
import { useT } from "@/contexts/LanguageContext";

export function EquipmentList({ equipment }: { equipment: DiveEquipmentWithCount[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiveEquipmentWithCount | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const categoryLabels = equipmentCategoryLabels(t);
  const currencyFormatter = new Intl.NumberFormat(t.locale === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: "EUR",
  });

  const gear = equipment.filter((e) => e.status !== "WISHLIST");
  const wishlist = equipment.filter((e) => e.status === "WISHLIST");
  const totalInvestment = gear.reduce((sum, e) => sum + (e.purchasePrice ?? 0), 0);
  const wishlistTotal = wishlist.reduce((sum, e) => sum + (e.purchasePrice ?? 0), 0);

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.confirmDeleteEquipment,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveEquipment(id);
      toast.success(t.deletedToastEquipment);
    } catch {
      toast.error(t.error);
    }
  }

  function renderList(items: DiveEquipmentWithCount[]) {
    if (items.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noEquipment}</p>
            <p className="text-sm">{t.noEquipmentHint}</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((e) => (
          <Card key={e.id}>
            <CardContent className="pt-4 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/dives/equipment/${e.id}`} className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium truncate">{e.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[e.category]}
                    </Badge>
                    {e.status === "OWNED" && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Waves className="h-3 w-3" /> {t.equipmentUsedInDives(e._count.diveLogs)}
                      </Badge>
                    )}
                    {isServiceDue(e) && (
                      <Badge variant="warning" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" /> {t.equipmentServiceDue}
                      </Badge>
                    )}
                  </div>
                  {(e.brand || e.model) && (
                    <p className="text-xs text-muted-foreground truncate">{[e.brand, e.model].filter(Boolean).join(" ")}</p>
                  )}
                  {e.purchasePrice != null && (
                    <p className="text-xs text-muted-foreground">{currencyFormatter.format(e.purchasePrice)}</p>
                  )}
                </Link>
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(e);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> {t.addEquipment}
        </Button>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {totalInvestment > 0 && <span>{t.equipmentTotalInvestment(currencyFormatter.format(totalInvestment))}</span>}
          {wishlistTotal > 0 && <span>{t.equipmentWishlistTotal(currencyFormatter.format(wishlistTotal))}</span>}
        </div>
      </div>

      <Tabs defaultValue="gear">
        <TabsList>
          <TabsTrigger value="gear">
            {t.equipmentMyGearTab} <Badge variant="secondary" className="ml-1.5">{gear.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="wishlist">
            {t.equipmentWishlistTab} <Badge variant="secondary" className="ml-1.5">{wishlist.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gear" className="mt-4">
          {renderList(gear)}
        </TabsContent>
        <TabsContent value="wishlist" className="mt-4">
          {renderList(wishlist)}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t.editEquipment : t.addEquipment}</DialogTitle>
          </DialogHeader>
          <EquipmentForm equipment={editing ?? undefined} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
