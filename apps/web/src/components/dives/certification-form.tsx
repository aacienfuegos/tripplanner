"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDiveCertification, updateDiveCertification } from "@/actions/dive-certifications";
import type { DiveCertification } from "@/types";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  certification?: DiveCertification;
  onSuccess: () => void;
}

export function CertificationForm({ certification: c, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (c) {
          await updateDiveCertification(c.id, formData);
          toast.success(t.toastUpdated);
        } else {
          await createDiveCertification(formData);
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
        <div className="space-y-1.5">
          <Label htmlFor="agency">{t.certAgency} *</Label>
          <Input id="agency" name="agency" required defaultValue={c?.agency ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="level">{t.certLevel} *</Label>
          <Input id="level" name="level" required defaultValue={c?.level ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="certNumber">{t.certNumber}</Label>
          <Input id="certNumber" name="certNumber" defaultValue={c?.certNumber ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issueDate">{t.certIssueDate}</Label>
          <Input
            id="issueDate"
            name="issueDate"
            type="date"
            defaultValue={c?.issueDate ? format(c.issueDate, "yyyy-MM-dd") : ""}
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="instructorName">{t.certInstructorName}</Label>
          <Input id="instructorName" name="instructorName" defaultValue={c?.instructorName ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={c?.notes ?? ""} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : c ? t.saveChanges : t.addCertification}
      </Button>
    </form>
  );
}
