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
  clipSeconds,
}: {
  samples: ProfileSample[];
  site: { name: string; latitude: number | null; longitude: number | null } | null;
  clipSeconds?: readonly number[];
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
      <TabsList className="max-sm:group-data-horizontal/tabs:h-10">
        <TabsTrigger value="profile" aria-label={t.diveProfileTabDepth} className="group/trigger gap-1.5 px-2.5 sm:px-1.5">
          <Waves className="h-3.5 w-3.5" />
          <span className="max-sm:hidden max-sm:group-data-active/trigger:inline">{t.diveProfileTabDepth}</span>
        </TabsTrigger>
        <TabsTrigger value="temp" aria-label={t.diveProfileTabTemp} className="group/trigger gap-1.5 px-2.5 sm:px-1.5">
          <Thermometer className="h-3.5 w-3.5" />
          <span className="max-sm:hidden max-sm:group-data-active/trigger:inline">{t.diveProfileTabTemp}</span>
        </TabsTrigger>
        <TabsTrigger value="ndl" aria-label={t.diveProfileTabNdl} className="group/trigger gap-1.5 px-2.5 sm:px-1.5">
          <Timer className="h-3.5 w-3.5" />
          <span className="max-sm:hidden max-sm:group-data-active/trigger:inline">{t.diveProfileTabNdl}</span>
        </TabsTrigger>
        <TabsTrigger value="map" aria-label={t.diveProfileTabMap} className="group/trigger gap-1.5 px-2.5 sm:px-1.5">
          <MapPin className="h-3.5 w-3.5" />
          <span className="max-sm:hidden max-sm:group-data-active/trigger:inline">{t.diveProfileTabMap}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="mt-4">
        <DiveProfileChart samples={samples} clipSeconds={clipSeconds} />
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
