"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDiveLog, updateDiveLog, createDiveSite } from "@/actions/dives";
import type { DiveLog, DiveSite } from "@/types";
import { useT } from "@/contexts/LanguageContext";
import { DIVE_TYPE_KEYS, diveTypeKeyLabels, isDiveTypeKey } from "@/lib/dive-type";

const NEW_SITE_VALUE = "__new__";
const NONE_SITE_VALUE = "__none__";
const NONE_DIVE_TYPE_VALUE = "__none__";
const OTHER_DIVE_TYPE_VALUE = "__other__";

interface Props {
  dive?: DiveLog;
  sites: DiveSite[];
  tripId?: string;
  onSuccess: () => void;
}

export function DiveLogForm({ dive: d, sites, tripId, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [siteId, setSiteId] = useState<string>(d?.diveSiteId ?? NONE_SITE_VALUE);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");

  const initialDiveTypeChoice = isDiveTypeKey(d?.diveType)
    ? d.diveType
    : d?.diveType
      ? OTHER_DIVE_TYPE_VALUE
      : NONE_DIVE_TYPE_VALUE;
  const [diveTypeChoice, setDiveTypeChoice] = useState<string>(initialDiveTypeChoice);
  const [customDiveType, setCustomDiveType] = useState(
    !isDiveTypeKey(d?.diveType) ? (d?.diveType ?? "") : "",
  );
  const diveTypeLabels = diveTypeKeyLabels(t);
  const gasMixLabels: Record<string, string> = {
    AIR: t.gasMixAir,
    NITROX: t.gasMixNitrox,
    TRIMIX: t.gasMixTrimix,
    OXYGEN: t.gasMixOxygen,
  };

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        let resolvedSiteId = "";
        if (siteId === NEW_SITE_VALUE) {
          if (newSiteName.trim()) {
            const siteFormData = new FormData();
            siteFormData.set("name", newSiteName.trim());
            siteFormData.set("address", newSiteAddress.trim());
            const site = await createDiveSite(siteFormData);
            resolvedSiteId = site.id;
          }
        } else if (siteId !== NONE_SITE_VALUE) {
          resolvedSiteId = siteId;
        }
        formData.set("diveSiteId", resolvedSiteId);

        const resolvedDiveType =
          diveTypeChoice === OTHER_DIVE_TYPE_VALUE
            ? customDiveType.trim()
            : diveTypeChoice === NONE_DIVE_TYPE_VALUE
              ? ""
              : diveTypeChoice;
        formData.set("diveType", resolvedDiveType);

        if (d) {
          await updateDiveLog(d.id, formData);
          toast.success(t.toastUpdated);
        } else {
          await createDiveLog(formData);
          toast.success(t.toastAdded);
        }
        onSuccess();
      } catch {
        toast.error(t.toastErrorSaving);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {tripId && !d && <input type="hidden" name="tripId" value={tripId} />}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">{t.diveGroupBasic}</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1.5 col-span-2 md:col-span-3">
            <Label htmlFor="diveSite">{t.diveSite}</Label>
            <Select value={siteId} onValueChange={(v) => v !== null && setSiteId(v)}>
              <SelectTrigger id="diveSite" className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === NEW_SITE_VALUE
                      ? t.diveSiteCreateNew
                      : (sites.find((s) => s.id === value)?.name ?? t.diveSiteNone)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_SITE_VALUE}>{t.diveSiteNone}</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_SITE_VALUE}>{t.diveSiteCreateNew}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="date">{t.diveDate} *</Label>
            <div className="flex gap-1.5">
              <Input
                id="date"
                name="date"
                type="date"
                required
                className="w-[160px] shrink-0"
                defaultValue={d?.date ? format(d.date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
              />
              <Input
                id="time"
                name="time"
                type="time"
                aria-label={t.diveTime}
                className="w-[130px] shrink-0"
                defaultValue={d?.date && format(d.date, "HH:mm") !== "00:00" ? format(d.date, "HH:mm") : ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diveType">{t.diveType}</Label>
            <Select value={diveTypeChoice} onValueChange={(v) => v !== null && setDiveTypeChoice(v)}>
              <SelectTrigger id="diveType">
                <SelectValue>
                  {(value: string) =>
                    value === OTHER_DIVE_TYPE_VALUE
                      ? t.otherLabel
                      : isDiveTypeKey(value)
                        ? diveTypeLabels[value]
                        : t.diveTypeNone
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_DIVE_TYPE_VALUE}>{t.diveTypeNone}</SelectItem>
                {DIVE_TYPE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {diveTypeLabels[key]}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_DIVE_TYPE_VALUE}>{t.otherLabel}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {diveTypeChoice === OTHER_DIVE_TYPE_VALUE && (
            <div className="space-y-1.5">
              <Label htmlFor="customDiveType">{t.otherLabel}</Label>
              <Input
                id="customDiveType"
                value={customDiveType}
                onChange={(e) => setCustomDiveType(e.target.value)}
                placeholder={t.diveTypeOtherPlaceholder}
              />
            </div>
          )}
          {siteId === NEW_SITE_VALUE && (
            <div className="col-span-2 md:col-span-3 grid grid-cols-2 gap-3 p-3 rounded-md border border-dashed">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="newSiteName">{t.diveSiteName} *</Label>
                <Input id="newSiteName" value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="newSiteAddress">{t.diveSiteAddress}</Label>
                <Input id="newSiteAddress" value={newSiteAddress} onChange={(e) => setNewSiteAddress(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">{t.diveGroupProfile}</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="depthMax">{t.diveDepthMax} *</Label>
            <Input id="depthMax" name="depthMax" type="number" step="0.1" min="0" required defaultValue={d?.depthMax ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bottomTime">{t.diveBottomTime} *</Label>
            <Input id="bottomTime" name="bottomTime" type="number" min="0" required defaultValue={d?.bottomTime ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="surfaceInterval">{t.diveSurfaceInterval}</Label>
            <Input id="surfaceInterval" name="surfaceInterval" type="number" min="0" defaultValue={d?.surfaceInterval ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gasMix">{t.diveGasMix}</Label>
            <Select name="gasMix" defaultValue={d?.gasMix ?? "AIR"}>
              <SelectTrigger id="gasMix">
                <SelectValue>{(value: string) => gasMixLabels[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AIR">{t.gasMixAir}</SelectItem>
                <SelectItem value="NITROX">{t.gasMixNitrox}</SelectItem>
                <SelectItem value="TRIMIX">{t.gasMixTrimix}</SelectItem>
                <SelectItem value="OXYGEN">{t.gasMixOxygen}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="o2Percentage">{t.diveO2Percentage}</Label>
            <Input id="o2Percentage" name="o2Percentage" type="number" min="0" max="100" defaultValue={d?.o2Percentage ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="heliumPercentage">{t.diveHeliumPercentage}</Label>
            <Input id="heliumPercentage" name="heliumPercentage" type="number" min="0" max="100" defaultValue={d?.heliumPercentage ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pressureStart">{t.divePressureStart}</Label>
            <Input id="pressureStart" name="pressureStart" type="number" min="0" defaultValue={d?.pressureStart ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pressureEnd">{t.divePressureEnd}</Label>
            <Input id="pressureEnd" name="pressureEnd" type="number" min="0" defaultValue={d?.pressureEnd ?? ""} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">{t.diveGroupConditions}</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="waterTemp">{t.diveWaterTemp}</Label>
            <Input id="waterTemp" name="waterTemp" type="number" step="0.1" defaultValue={d?.waterTemp ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="airTemp">{t.diveAirTemp}</Label>
            <Input id="airTemp" name="airTemp" type="number" step="0.1" defaultValue={d?.airTemp ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visibility">{t.diveVisibility}</Label>
            <Input id="visibility" name="visibility" type="number" step="0.1" min="0" defaultValue={d?.visibility ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suitType">{t.diveSuitType}</Label>
            <Input id="suitType" name="suitType" defaultValue={d?.suitType ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight">{t.diveWeight}</Label>
            <Input id="weight" name="weight" type="number" step="0.1" min="0" defaultValue={d?.weight ?? ""} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">{t.diveGroupNotes}</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="buddyName">{t.diveBuddyName}</Label>
            <Input id="buddyName" name="buddyName" defaultValue={d?.buddyName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rating">{t.diveRating}</Label>
            <Input id="rating" name="rating" type="number" min="1" max="5" step="1" defaultValue={d?.rating ?? ""} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">{t.notes}</Label>
          <Textarea id="notes" name="notes" rows={2} defaultValue={d?.notes ?? ""} />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : d ? t.saveChanges : t.addDive}
      </Button>
    </form>
  );
}
