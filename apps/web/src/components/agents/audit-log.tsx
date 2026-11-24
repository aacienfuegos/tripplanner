import Link from "next/link";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WebTKeys } from "@/i18n";

// The Registro tab of /profile/agents. Everything an agent wrote (names,
// values) is the user's or an agent's text: always React text.

export type AuditItem = {
  readonly id: string;
  readonly when: string;
  readonly connection: string;
  readonly action: "CREATED" | "UPDATED" | "DELETED" | "SUGGESTED";
  readonly entityType: string;
  readonly trip: string | null;
  readonly changes: unknown;
};

export type AuditFilter = { readonly id: string; readonly name: string };

const ENTITY_KEYS: Record<string, keyof WebTKeys> = {
  Trip: "agentsEntityTrip",
  Destination: "agentsEntityDestination",
  Flight: "agentsEntityFlight",
  Accommodation: "agentsEntityAccommodation",
  Activity: "agentsEntityActivity",
  Document: "agentsEntityDocument",
  Expense: "agentsEntityExpense",
  Task: "agentsEntityTask",
  "Packing item": "agentsEntityPackingItem",
  Dive: "agentsEntityDive",
  "Dive site": "agentsEntityDiveSite",
  "Dive area": "agentsEntityDiveArea",
  Equipment: "agentsEntityEquipment",
  "Equipment service": "agentsEntityEquipmentService",
  Certification: "agentsEntityCertification",
};

function changeRows(changes: unknown, empty: string): [string, string, string][] {
  if (typeof changes !== "object" || changes === null || Array.isArray(changes)) return [];
  const show = (value: unknown) => (value === null || value === undefined || value === "" ? empty : String(value));
  return Object.entries(changes).flatMap(([field, pair]): [string, string, string][] =>
    Array.isArray(pair) && pair.length === 2 ? [[field, show(pair[0]), show(pair[1])]] : [],
  );
}

export function AuditLog({
  t,
  items,
  connections,
  grant,
  page,
  hasMore,
}: {
  t: WebTKeys;
  items: readonly AuditItem[];
  connections: readonly AuditFilter[];
  grant: string | null;
  page: number;
  hasMore: boolean;
}) {
  const href = (next: { grant?: string | null; page?: number }) => {
    const params = new URLSearchParams({ tab: "audit" });
    const g = next.grant === undefined ? grant : next.grant;
    if (g) params.set("grant", g);
    if (next.page) params.set("page", String(next.page));
    return `/profile/agents?${params.toString()}`;
  };
  const actions = {
    CREATED: t.agentsAuditCreated,
    UPDATED: t.agentsAuditUpdated,
    DELETED: t.agentsAuditDeleted,
    SUGGESTED: t.agentsAuditSuggested,
  };
  const entity = (type: string) => {
    const key = ENTITY_KEYS[type];
    const label = key ? t[key] : undefined;
    return typeof label === "string" ? label : type;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.agentsAuditIntro}</p>
      {connections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={href({ grant: null })} className={buttonVariants({ variant: grant ? "outline" : "secondary", size: "sm" })}>
            {t.agentsAuditAllConnections}
          </Link>
          {connections.map((connection) => (
            <Link
              key={connection.id}
              href={href({ grant: connection.id })}
              className={buttonVariants({ variant: grant === connection.id ? "secondary" : "outline", size: "sm" })}
            >
              {connection.name}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{t.agentsAuditEmpty}</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const rows = item.action === "UPDATED" ? changeRows(item.changes, t.agentsAuditEmptyValue) : [];
            return (
              <Card key={item.id}>
                <CardContent className="py-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className="gap-1 font-normal">
                      <Bot className="h-3 w-3" aria-hidden />
                      {item.connection}
                    </Badge>
                    <span className="font-medium">{actions[item.action]}</span>
                    <span>{entity(item.entityType)}</span>
                    {item.trip && (
                      <span className="text-muted-foreground">{t.agentsAuditInTrip.replace("{trip}", item.trip)}</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">{item.when}</span>
                  </div>
                  {item.action === "UPDATED" &&
                    (rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t.agentsAuditNoChanges}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-3 text-left font-medium">{t.agentsAuditField}</th>
                              <th className="py-1 pr-3 text-left font-medium">{t.agentsAuditBefore}</th>
                              <th className="py-1 text-left font-medium">{t.agentsAuditAfter}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(([field, before, after]) => (
                              <tr key={field} className="border-t align-top">
                                <td className="py-1 pr-3 font-mono">{field}</td>
                                <td className="py-1 pr-3 break-words">{before}</td>
                                <td className="py-1 break-words">{after}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(page > 0 || hasMore) && (
        <div className="flex justify-between">
          {page > 0 ? (
            <Link href={href({ page: page - 1 })} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {t.agentsAuditNewer}
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link href={href({ page: page + 1 })} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {t.agentsAuditOlder}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
