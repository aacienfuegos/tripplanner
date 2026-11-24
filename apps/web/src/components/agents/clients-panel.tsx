"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/contexts/LanguageContext";
import { createAgentClient, deleteAgentClient, type AgentActionResult } from "@/actions/agents";

export type ClientItem = {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly redirectUri: string;
  readonly registered: string;
  readonly activeConnections: number;
};

function NewClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const messages: Record<Exclude<AgentActionResult, { ok: true }>["error"], string> = {
    invalid_name: t.agentsClientErrorName,
    invalid_redirect_uri: t.agentsClientErrorUri,
    limit: t.agentsClientErrorLimit,
    not_found: t.agentsNotFound,
  };

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "");
    const redirectUri = String(formData.get("redirectUri") ?? "");
    startTransition(async () => {
      try {
        const result = await createAgentClient({ name, redirectUri });
        if (!result.ok) {
          setError(messages[result.error]);
          return;
        }
        toast.success(t.agentsClientCreated);
        setError(null);
        onOpenChange(false);
      } catch {
        setError(t.agentsError);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.agentsClientNew}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">{t.agentsClientName}</Label>
            <Input id="client-name" name="name" maxLength={60} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-redirect">{t.agentsClientRedirectUri}</Label>
            <Input id="client-redirect" name="redirectUri" type="url" maxLength={2048} placeholder="https://" required />
            <p className="text-xs text-muted-foreground">{t.agentsClientRedirectHint}</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.agentsCancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {t.agentsClientCreate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientCard({ client }: { client: ClientItem }) {
  const { t } = useT();
  const { confirm, dialog } = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(client.clientId);
      toast.success(t.agentsClientCopied);
    } catch {
      toast.error(t.agentsError);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: t.agentsClientDeleteConfirmTitle,
      description: t.agentsClientDeleteConfirmDesc.replace("{n}", String(client.activeConnections)),
      confirmLabel: t.agentsClientDelete,
      cancelLabel: t.agentsCancel,
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const result = await deleteAgentClient(client.id);
        if (result.ok) toast.success(t.agentsClientDeleted);
        else toast.error(t.agentsNotFound);
      } catch {
        toast.error(t.agentsError);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium break-words">{client.name}</p>
            <p className="text-sm text-muted-foreground break-all">{client.redirectUri}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={pending}>
            {t.agentsClientDelete}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-xs break-all">{client.clientId}</code>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
            {t.agentsClientCopy}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{client.registered}</p>
      </CardContent>
      {dialog}
    </Card>
  );
}

export function ClientsPanel({ clients }: { clients: readonly ClientItem[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} disabled={clients.length >= 5}>
          <Plus className="h-4 w-4" />
          {t.agentsClientNew}
        </Button>
      </div>
      {clients.length === 0 && (
        <p className="rounded-md border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">{t.agentsClientsEmpty}</p>
      )}
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} />
      ))}
      <NewClientDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
