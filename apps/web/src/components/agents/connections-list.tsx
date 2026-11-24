"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/contexts/LanguageContext";
import { revokeAgentConnection } from "@/actions/agents";

export type ConnectionItem = {
  readonly id: string;
  readonly name: string;
  readonly clientName: string;
  readonly clientOrigin: string;
  readonly status: "active" | "revoked" | "inactive";
  readonly authorized: string;
  readonly lastUsed: string;
  readonly expires: string | null;
  readonly trips: string | null;
  readonly permissions: readonly string[];
};

function ConnectionCard({ connection }: { connection: ConnectionItem }) {
  const { t } = useT();
  const { confirm, dialog } = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  async function handleRevoke() {
    const ok = await confirm({
      title: t.agentsRevokeConfirmTitle,
      description: t.agentsRevokeConfirmDesc,
      confirmLabel: t.agentsRevoke,
      cancelLabel: t.agentsCancel,
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const result = await revokeAgentConnection(connection.id);
        if (result.ok) toast.success(t.agentsRevoked);
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
            <p className="font-medium break-words">{connection.name}</p>
            <p className="text-sm text-muted-foreground break-words">
              {t.agentsConnectionClient}: {connection.clientName} · {connection.clientOrigin}
            </p>
          </div>
          {connection.status === "active" ? (
            <Button variant="outline" size="sm" onClick={handleRevoke} disabled={pending}>
              {t.agentsRevoke}
            </Button>
          ) : (
            <Badge variant="secondary">
              {connection.status === "inactive" ? t.agentsConnectionInactive : t.agentsConnectionRevoked}
            </Badge>
          )}
        </div>
        {connection.trips && (
          <p className="text-sm">
            <span className="text-muted-foreground">{t.agentsConsentTrips}: </span>
            {connection.trips}
          </p>
        )}
        {connection.permissions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {connection.permissions.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {[connection.authorized, connection.lastUsed, connection.expires].filter(Boolean).join(" · ")}
        </p>
      </CardContent>
      {dialog}
    </Card>
  );
}

export function ConnectionsList({ connections }: { connections: readonly ConnectionItem[] }) {
  const { t } = useT();
  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center">
        <Bot className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-md">{t.agentsConnectionsEmpty}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {connections.map((connection) => (
        <ConnectionCard key={connection.id} connection={connection} />
      ))}
    </div>
  );
}
