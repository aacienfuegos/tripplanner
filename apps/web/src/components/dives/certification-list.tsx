"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, Award, Pencil, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { CertificationForm } from "./certification-form";
import { deleteDiveCertification } from "@/actions/dive-certifications";
import type { DiveCertification } from "@/types";
import { useT } from "@/contexts/LanguageContext";

export function CertificationList({ certifications }: { certifications: DiveCertification[] }) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiveCertification | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.confirmDeleteCertification,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveCertification(id);
      toast.success(t.deletedToastCertification);
    } catch {
      toast.error(t.error);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4 mr-2" /> {t.addCertification}
      </Button>

      {certifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Award className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noCertifications}</p>
            <p className="text-sm">{t.noCertificationsHint}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {certifications.map((cert) => (
            <Card key={cert.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{cert.agency}</span>
                      <Badge variant="outline">{cert.level}</Badge>
                      {cert.certNumber && <Badge variant="secondary">#{cert.certNumber}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {cert.issueDate && <p>{format(cert.issueDate, "d MMM yyyy", { locale: dfLocale })}</p>}
                      {cert.instructorName && (
                        <p className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" /> {cert.instructorName}
                        </p>
                      )}
                      {cert.notes && <p className="italic">{cert.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(cert);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cert.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t.editCertification : t.addCertification}</DialogTitle>
          </DialogHeader>
          <CertificationForm certification={editing ?? undefined} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
