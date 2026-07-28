"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format, differenceInDays, isBefore } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, FileText, Pencil, Trash2, ExternalLink, AlertTriangle, IdCard, Stamp, HeartPulse, Ticket, Receipt, Paperclip } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentForm } from "./document-form";
import { deleteDocument } from "@/actions/documents";
import type { Document } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

const typeIcons: Record<string, React.ElementType> = {
  PASSPORT: IdCard, VISA: Stamp, INSURANCE: HeartPulse, TICKET: Ticket, VOUCHER: Receipt, OTHER: Paperclip,
};

export function DocumentsList({ tripId, documents }: { tripId: string; documents: Document[] }) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const typeLabels: Record<string, string> = {
    PASSPORT: t.locale === "es" ? "Pasaporte" : "Passport",
    VISA: t.locale === "es" ? "Visado" : "Visa",
    INSURANCE: t.locale === "es" ? "Seguro" : "Insurance",
    TICKET: t.locale === "es" ? "Billete" : "Ticket",
    VOUCHER: "Voucher",
    OTHER: t.locale === "es" ? "Otro" : "Other",
  };

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.locale === "es" ? "¿Eliminar este documento?" : "Delete this document?",
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try { await deleteDocument(tripId, id); toast.success(t.locale === "es" ? "Eliminado" : "Deleted"); }
    catch { toast.error(t.error); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> {t.addDocument}
      </Button>

      {documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noDocuments}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => {
            const isExpiringSoon = doc.expiresAt && differenceInDays(doc.expiresAt, new Date()) < 90;
            const isExpired = doc.expiresAt && isBefore(doc.expiresAt, new Date());
            const TypeIcon = typeIcons[doc.type];
            return (
              <Card key={doc.id} className={isExpired ? "border-destructive/50" : isExpiringSoon ? "border-yellow-400/50" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">{doc.name}</span>
                        <Badge variant="secondary">{typeLabels[doc.type]}</Badge>
                      </div>
                      {doc.expiresAt && (
                        <p className={`text-sm flex items-center gap-1 ${isExpired ? "text-destructive" : isExpiringSoon ? "text-yellow-600" : "text-muted-foreground"}`}>
                          {(isExpired || isExpiringSoon) && <AlertTriangle className="h-3.5 w-3.5" />}
                          {t.expiresAt}: {format(doc.expiresAt, "d MMM yyyy", { locale: dfLocale })}
                          {isExpired && ` (${t.expired})`}
                          {!isExpired && isExpiringSoon && ` (${differenceInDays(doc.expiresAt, new Date())} ${t.days})`}
                        </p>
                      )}
                      {doc.notes && <p className="text-sm text-muted-foreground">{doc.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(doc); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t.editDocument : t.addDocument}</DialogTitle>
          </DialogHeader>
          <DocumentForm tripId={tripId} document={editing ?? undefined} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
