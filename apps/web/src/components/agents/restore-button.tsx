"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/LanguageContext";
import { restoreAgentDeletion } from "@/actions/agents";

export function RestoreButton({ entryId }: { entryId: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      try {
        const result = await restoreAgentDeletion(entryId);
        if (result.ok) toast.success(t.agentsAuditRestoredToast);
        else toast.error(result.error === "parent_missing" ? t.agentsAuditRestoreParentMissing : t.agentsNotFound);
      } catch {
        toast.error(t.agentsError);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRestore} disabled={pending}>
      {t.agentsAuditRestore}
    </Button>
  );
}
