"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Copy, KeyRound, Plus } from "lucide-react";
import type { ApiScope } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { createApiToken, revokeApiToken } from "@/actions/api-tokens";
import { API_SCOPES, API_SCOPE_NAMES, apiScopeName } from "@/lib/api-scopes";
import { useT } from "@/contexts/LanguageContext";

export type ApiTokenStatus = "active" | "revoked" | "expired";

export interface ApiTokenView {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  status: ApiTokenStatus;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  usage: {
    id: string;
    method: string;
    path: string;
    status: number;
    fields: string[];
    resourceId: string | null;
    createdAt: Date;
  }[];
}

const EXPIRY_OPTIONS = ["30", "90", "365", "never"] as const;

export function ApiTokensCard({ tokens }: { tokens: ApiTokenView[] }) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [expiry, setExpiry] = useState<string>("90");
  // El token en claro solo vive en este estado: ni toast, ni URL, ni localStorage.
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const statusLabel: Record<ApiTokenStatus, string> = {
    active: t.apiTokenStatusActive,
    revoked: t.apiTokenStatusRevoked,
    expired: t.apiTokenStatusExpired,
  };
  const expiryLabel = (value: string) =>
    value === "never" ? t.apiTokenExpiryNever : t.apiTokenExpiryDays(Number(value));
  const formatDate = (date: Date) => format(date, "d MMM yyyy HH:mm", { locale: dfLocale });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCreatedToken(null);
      setExpiry("90");
    }
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      try {
        const { token } = await createApiToken(formData);
        setCreatedToken(token);
        toast.success(t.apiTokenCreatedToast);
      } catch {
        toast.error(t.error);
      }
    });
  }

  async function handleCopy() {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      toast.success(t.copied);
    } catch {
      toast.error(t.error);
    }
  }

  async function handleRevoke(id: string) {
    const ok = await confirm({
      title: t.apiTokenRevokeConfirm,
      confirmLabel: t.apiTokenRevoke,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await revokeApiToken(id);
      toast.success(t.apiTokenRevokedToast);
    } catch {
      toast.error(t.error);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t.apiTokensTitle}</CardTitle>
          <CardDescription>{t.apiTokensDesc}</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> {t.apiTokenCreateBtn}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4 opacity-60" /> {t.apiTokenNoTokens}
          </p>
        ) : (
          tokens.map((token) => (
            <div key={token.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{token.name}</span>
                    <code className="text-xs text-muted-foreground">{token.prefix}…</code>
                    <Badge variant={token.status === "active" ? "secondary" : "outline"}>
                      {statusLabel[token.status]}
                    </Badge>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {token.scopes.map((scope) => (
                      <Badge key={scope} variant="outline" className="font-mono text-xs">
                        {apiScopeName(scope)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.apiTokenLastUsed}: {token.lastUsedAt ? formatDate(token.lastUsedAt) : t.apiTokenNeverUsed}
                    {" · "}
                    {t.apiTokenExpires}: {token.expiresAt ? formatDate(token.expiresAt) : t.apiTokenExpiryNever}
                  </p>
                </div>
                {token.status === "active" && (
                  <Button variant="outline" size="sm" onClick={() => handleRevoke(token.id)}>
                    {t.apiTokenRevoke}
                  </Button>
                )}
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {t.apiTokenUsageSummary(token.usage.length)}
                </summary>
                {token.usage.length === 0 ? (
                  <p className="mt-2 text-muted-foreground">{t.apiTokenNoUsage}</p>
                ) : (
                  <ul className="mt-2 space-y-1 font-mono">
                    {token.usage.map((entry) => (
                      <li key={entry.id} className="break-all">
                        {formatDate(entry.createdAt)} {entry.method} {entry.path} {entry.status}
                        {entry.fields.length > 0 && ` · ${t.apiTokenUsageFields}: ${entry.fields.join(", ")}`}
                        {entry.resourceId && ` · ${t.apiTokenUsageResource}: ${entry.resourceId}`}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          {createdToken ? (
            <>
              <DialogHeader>
                <DialogTitle>{t.apiTokenCreatedTitle}</DialogTitle>
                <DialogDescription>{t.apiTokenCreatedDesc}</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <Input readOnly value={createdToken} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button variant="outline" size="icon" onClick={handleCopy} aria-label={t.copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => handleOpenChange(false)}>{t.close}</Button>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t.apiTokenCreateTitle}</DialogTitle>
              </DialogHeader>
              <form action={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="api-token-name">{t.nameLabel}</Label>
                  <Input
                    id="api-token-name"
                    name="name"
                    placeholder={t.apiTokenNamePlaceholder}
                    maxLength={100}
                    required
                  />
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium mb-1.5">{t.apiTokenScopesLabel}</legend>
                  {API_SCOPE_NAMES.map((name) => (
                    <label key={name} className="flex items-center gap-2 text-sm font-mono">
                      <input type="checkbox" name="scopes" value={API_SCOPES[name]} className="h-4 w-4" />
                      {name}
                    </label>
                  ))}
                </fieldset>

                <div className="space-y-1.5">
                  <Label htmlFor="api-token-expiry">{t.apiTokenExpiryLabel}</Label>
                  <Select name="expiry" value={expiry} onValueChange={(v) => v !== null && setExpiry(v)}>
                    <SelectTrigger id="api-token-expiry">
                      <SelectValue>{(value: string) => expiryLabel(value)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {expiryLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? t.savingEllipsis : t.apiTokenCreateSubmit}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </Card>
  );
}
