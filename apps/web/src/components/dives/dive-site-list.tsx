"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, MapPin, Map, Pencil, Trash2, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { DiveAreaForm } from "./dive-area-form";
import { DiveSiteForm } from "./dive-site-form";
import { DiveSitesMapView, type DiveSitePoint } from "./DiveSitesMapView";
import { deleteDiveArea, deleteDiveSite } from "@/actions/dive-sites";
import type { DiveArea, DiveSiteWithArea } from "@/types";
import { useT } from "@/contexts/LanguageContext";

type SiteWithCount = DiveSiteWithArea & { _count: { diveLogs: number } };

export function DiveSiteList({
  areas,
  sites,
  sitePoints,
}: {
  areas: DiveArea[];
  sites: SiteWithCount[];
  sitePoints: DiveSitePoint[];
}) {
  const { t } = useT();
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<DiveArea | null>(null);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SiteWithCount | null>(null);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  async function handleDeleteArea(id: string) {
    const ok = await confirm({
      title: t.confirmDeleteDiveArea,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveArea(id);
      toast.success(t.deletedToastDiveArea);
    } catch {
      toast.error(t.error);
    }
  }

  async function handleDeleteSite(id: string) {
    const ok = await confirm({
      title: t.confirmDeleteDiveSite,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveSite(id);
      toast.success(t.deletedToastDiveSite);
    } catch {
      toast.error(t.error);
    }
  }

  const groups = [
    ...areas.map((area) => ({ area, sites: sites.filter((s) => s.diveArea?.id === area.id) })),
    { area: null, sites: sites.filter((s) => !s.diveArea) },
  ].filter((g) => g.sites.length > 0 || g.area);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setEditingSite(null);
            setSiteDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> {t.addDiveSite}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setEditingArea(null);
            setAreaDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> {t.addDiveArea}
        </Button>
        {sitePoints.length > 0 && (
          <Button variant="outline" onClick={() => setMapDialogOpen(true)}>
            <Map className="h-4 w-4 mr-2" /> {t.viewDiveSitesMap}
          </Button>
        )}
      </div>

      {sites.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noDiveSites}</p>
            <p className="text-sm">{t.noDiveSitesHint}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(({ area, sites: groupSites }) => (
            <div key={area?.id ?? "ungrouped"} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {area ? (
                    <Link href={`/dives/sites/areas/${area.id}`} className="font-semibold hover:underline">
                      {area.name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-muted-foreground">{t.diveAreaNone}</span>
                  )}
                  {area?.country && (
                    <Badge variant="outline" className="text-xs">
                      {area.country}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {t.diveAreaDiveSiteCount(groupSites.length)}
                  </Badge>
                </div>
                {area && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingArea(area);
                        setAreaDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteArea(area.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupSites.map((site) => (
                  <Card key={site.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/dives/sites/${site.id}`} className="flex-1 min-w-0 space-y-1">
                          <p className="font-medium truncate">{site.name}</p>
                          {(site.region || site.country) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {[site.region, site.country].filter(Boolean).join(", ")}
                            </p>
                          )}
                          <Badge variant="outline" className="text-xs gap-1">
                            <Waves className="h-3 w-3" /> {t.diveSiteDiveCount(site._count.diveLogs)}
                          </Badge>
                        </Link>
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingSite(site);
                              setSiteDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSite(site.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingArea ? t.editDiveArea : t.addDiveArea}</DialogTitle>
          </DialogHeader>
          <DiveAreaForm area={editingArea ?? undefined} onSuccess={() => setAreaDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSite ? t.editDiveSite : t.addDiveSite}</DialogTitle>
          </DialogHeader>
          <DiveSiteForm site={editingSite ?? undefined} areas={areas} onSuccess={() => setSiteDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t.viewDiveSitesMap}</DialogTitle>
          </DialogHeader>
          {mapDialogOpen && <DiveSitesMapView points={sitePoints} labels={{ viewDetail: t.viewDetail }} />}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
