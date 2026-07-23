"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDocument, updateDocument } from "@/actions/documents";
import type { Document } from "@/types";
import { format } from "date-fns";
import { useT } from "@/contexts/LanguageContext";

interface Props { tripId: string; document?: Document; onSuccess: () => void; }

export function DocumentForm({ tripId, document: d, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (d) { await updateDocument(tripId, d.id, formData); toast.success(t.toastUpdated); }
        else { await createDocument(tripId, formData); toast.success(t.toastAdded); }
        onSuccess();
      } catch { toast.error(t.toastErrorSaving); }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">{t.typeLabel}</Label>
          <Select name="type" defaultValue={d?.type ?? "OTHER"}>
            <SelectTrigger id="type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["PASSPORT","VISA","INSURANCE","TICKET","VOUCHER","OTHER"].map(t => (
                <SelectItem key={t} value={t}>{t.charAt(0)+t.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">{t.nameLabel} *</Label>
          <Input id="name" name="name" required defaultValue={d?.name} placeholder="Pasaporte ES123" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expiresAt">{t.expiryDate}</Label>
        <Input id="expiresAt" name="expiresAt" type="date" defaultValue={d?.expiresAt ? format(d.expiresAt, "yyyy-MM-dd") : ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fileUrl">{t.documentLinkLabel}</Label>
        <Input id="fileUrl" name="fileUrl" type="url" placeholder="https://drive.google.com/..." defaultValue={d?.fileUrl ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={d?.notes ?? ""} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : d ? t.saveChanges : t.addDocument}
      </Button>
    </form>
  );
}
