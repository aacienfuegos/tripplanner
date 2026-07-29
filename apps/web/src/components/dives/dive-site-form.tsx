"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDiveSite } from "@/actions/dives";
import { createDiveArea, updateDiveSite } from "@/actions/dive-sites";
import type { DiveArea, DiveSiteWithArea } from "@/types";
import { useT } from "@/contexts/LanguageContext";

const NEW_AREA_VALUE = "__new__";
const NONE_AREA_VALUE = "__none__";

interface Props {
  site?: DiveSiteWithArea;
  areas: DiveArea[];
  onSuccess: () => void;
}

export function DiveSiteForm({ site: s, areas, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [areaId, setAreaId] = useState<string>(s?.diveArea?.id ?? NONE_AREA_VALUE);
  const [newAreaName, setNewAreaName] = useState("");

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        let resolvedAreaId = "";
        if (areaId === NEW_AREA_VALUE) {
          if (newAreaName.trim()) {
            const areaFormData = new FormData();
            areaFormData.set("name", newAreaName.trim());
            const area = await createDiveArea(areaFormData);
            resolvedAreaId = area.id;
          }
        } else if (areaId !== NONE_AREA_VALUE) {
          resolvedAreaId = areaId;
        }
        formData.set("diveAreaId", resolvedAreaId);

        if (s) {
          await updateDiveSite(s.id, formData);
          toast.success(t.toastUpdated);
        } else {
          await createDiveSite(formData);
          toast.success(t.toastAdded);
        }
        onSuccess();
      } catch {
        toast.error(t.toastErrorSaving);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="name">{t.diveSiteName} *</Label>
          <Input id="name" name="name" required defaultValue={s?.name ?? ""} />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="diveArea">{t.diveAreaLabel}</Label>
          <Select value={areaId} onValueChange={(v) => v !== null && setAreaId(v)}>
            <SelectTrigger id="diveArea" className="w-full">
              <SelectValue>
                {(value: string) =>
                  value === NEW_AREA_VALUE
                    ? t.diveAreaCreateNew
                    : (areas.find((a) => a.id === value)?.name ?? t.diveAreaNone)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_AREA_VALUE}>{t.diveAreaNone}</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_AREA_VALUE}>{t.diveAreaCreateNew}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {areaId === NEW_AREA_VALUE && (
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="newAreaName">{t.diveAreaName} *</Label>
            <Input id="newAreaName" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="address">{t.diveSiteAddress}</Label>
          <Input id="address" name="address" defaultValue={s?.address ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">{t.diveSiteCountry}</Label>
          <Input id="country" name="country" defaultValue={s?.country ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="region">{t.diveSiteRegion}</Label>
          <Input id="region" name="region" defaultValue={s?.region ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={s?.notes ?? ""} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : s ? t.saveChanges : t.addDiveSite}
      </Button>
    </form>
  );
}
