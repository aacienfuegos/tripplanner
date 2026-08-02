"use client";

import { Waves, Thermometer, Timer, MapPin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DiveProfileChart, DiveTempChart, DiveNdlChart } from "./DiveProfileChart";
import { DiveSitesMapView, type DiveSitePoint } from "./DiveSitesMapView";
import type { ProfileSample } from "@/lib/dive-profile";
import { useT } from "@/contexts/LanguageContext";

export function DiveChartsSection({
  samples,
  site,
}: {
  samples: ProfileSample[];
  site: { name: string; latitude: number | null; longitude: number | null } | null;
}) {
  const { t } = useT();

  const mapPoints: DiveSitePoint[] =
    site && site.latitude != null && site.longitude != null
      ? [{
          id: "dive-site",
          name: site.name,
          lat: site.latitude,
          lng: site.longitude,
          subtitle: null,
          diveCountLabel: "",
          detailHref: "/dives",
        }]
      : [];

  return (
    <Tabs defaultValue="profile">
      <TabsList>
        <TabsTrigger value="profile" className="gap-1.5">
          <Waves className="h-3.5 w-3.5" /> {t.diveProfileTabDepth}
        </TabsTrigger>
        <TabsTrigger value="temp" className="gap-1.5">
          <Thermometer className="h-3.5 w-3.5" /> {t.diveProfileTabTemp}
        </TabsTrigger>
        <TabsTrigger value="ndl" className="gap-1.5">
          <Timer className="h-3.5 w-3.5" /> {t.diveProfileTabNdl}
        </TabsTrigger>
        <TabsTrigger value="map" className="gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> {t.diveProfileTabMap}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="mt-4">
        <DiveProfileChart samples={samples} />
      </TabsContent>
      <TabsContent value="temp" className="mt-4">
        <DiveTempChart samples={samples} />
      </TabsContent>
      <TabsContent value="ndl" className="mt-4">
        <DiveNdlChart samples={samples} />
      </TabsContent>
      <TabsContent value="map" className="mt-4">
        {mapPoints.length > 0 ? (
          <DiveSitesMapView points={mapPoints} labels={{ viewDetail: t.diveSitesTab }} />
        ) : (
          <p className="text-sm text-muted-foreground py-10 text-center">{t.diveProfileNoMapData}</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
