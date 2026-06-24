"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, FileText, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentForm } from "./document-form";
import { deleteDocument } from "@/actions/documents";
import type { Document } from "@/types";
import { differenceInDays, isBefore } from "date-fns";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  PASSPORT: "Pasaporte", VISA: "Visado", INSURANCE: "Seguro",
  TICKET: "Billete", VOUCHER: "Voucher", OTHER: "Otro",
};
const typeIcons: Record<string, string> = {
  PASSPORT: "🛂", VISA: "🔖", INSURANCE: "🏥", TICKET: "🎫", VOUCHER: "📄", OTHER: "📎",
};

export function DocumentsList({ tripId, documents }: { tripId: string; documents: Document[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    try { await deleteDocument(tripId, id); toast.success("Eliminado"); }
    catch { toast.error("Error al eliminar"); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> Añadir documento
      </Button>

      {documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>No hay documentos registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => {
            const isExpiringSoon = doc.expiresAt && differenceInDays(doc.expiresAt, new Date()) < 90;
            const isExpired = doc.expiresAt && isBefore(doc.expiresAt, new Date());
            return (
              <Card key={doc.id} className={isExpired ? "border-destructive/50" : isExpiringSoon ? "border-yellow-400/50" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{typeIcons[doc.type]}</span>
                        <span className="font-semibold">{doc.name}</span>
                        <Badge variant="secondary">{typeLabels[doc.type]}</Badge>
                      </div>
                      {doc.expiresAt && (
                        <p className={`text-sm flex items-center gap-1 ${isExpired ? "text-destructive" : isExpiringSoon ? "text-yellow-600" : "text-muted-foreground"}`}>
                          {(isExpired || isExpiringSoon) && <AlertTriangle className="h-3.5 w-3.5" />}
                          Caduca: {format(doc.expiresAt, "d MMM yyyy", { locale: es })}
                          {isExpired && " (caducado)"}
                          {!isExpired && isExpiringSoon && ` (${differenceInDays(doc.expiresAt, new Date())} días)`}
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
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(doc); setOpen(true); }}>✏️</Button>
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
            <DialogTitle>{editing ? "Editar documento" : "Añadir documento"}</DialogTitle>
          </DialogHeader>
          <DocumentForm tripId={tripId} document={editing ?? undefined} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
