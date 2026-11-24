import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { requireUser } from "@/lib/action-auth";
import { getT } from "@/lib/locale";
import { getOAuthConfig, INACTIVITY_MS } from "@/lib/oauth/config";
import { hostOf } from "@/lib/oauth/client-rules";
import { isInactive, listManualClients, listUserGrants } from "@/lib/oauth/grants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionsList, type ConnectionItem } from "@/components/agents/connections-list";
import { ClientsPanel, type ClientItem } from "@/components/agents/clients-panel";
import type { WebTKeys } from "@/i18n";

function scopeLabels(t: WebTKeys, scopes: readonly string[]): string[] {
  const labels: Record<string, string> = {
    "trips:read": `${t.agentsConsentTrips}: ${t.agentsScopeTripsRead}`,
    "trips:suggest": `${t.agentsConsentTrips}: ${t.agentsScopeTripsSuggest}`,
    "trips:write": `${t.agentsConsentTrips}: ${t.agentsScopeTripsWrite}`,
    "trips:delete": `${t.agentsConsentTrips}: ${t.agentsScopeTripsDelete}`,
    "dives:read": `${t.agentsConsentDives}: ${t.agentsScopeDivesRead}`,
    "dives:write": `${t.agentsConsentDives}: ${t.agentsScopeTripsWrite}`,
    "dives:delete": `${t.agentsConsentDives}: ${t.agentsScopeTripsDelete}`,
  };
  return scopes.flatMap((scope) => (labels[scope] ? [labels[scope]] : []));
}

export default async function AgentConnectionsPage() {
  const userId = await requireUser();
  const [t, grants, clients] = await Promise.all([getT(), listUserGrants(userId), listManualClients(userId)]);
  const config = getOAuthConfig();
  const now = new Date();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const day = (date: Date) => format(date, "PPP", { locale: dfLocale });

  const connections: ConnectionItem[] = grants.map((grant) => {
    const inactive = !grant.revokedAt && isInactive(grant.lastUsedAt, now);
    const status = grant.revokedAt ? (grant.revokedReason === "INACTIVE" ? "inactive" : "revoked") : inactive ? "inactive" : "active";
    return {
      id: grant.id,
      name: grant.name,
      clientName: grant.client.name,
      clientOrigin:
        grant.client.kind === "CIMD"
          ? hostOf(grant.client.clientId)
          : t.agentsConsentRegisteredByYou.replace("{date}", day(grant.client.createdAt)),
      status,
      authorized: t.agentsConnectionAuthorized.replace("{date}", day(grant.createdAt)),
      lastUsed: t.agentsConnectionLastUsed.replace("{date}", format(grant.lastUsedAt, "PPp", { locale: dfLocale })),
      expires:
        status === "active"
          ? t.agentsConnectionExpires.replace("{date}", day(new Date(grant.lastUsedAt.getTime() + INACTIVITY_MS)))
          : null,
      trips: !grant.scopes.includes("trips:read")
        ? null
        : grant.allTrips
          ? t.agentsConnectionAllTrips
          : grant.trips.length === 0
            ? t.agentsConnectionNoTrips
            : grant.trips.map((entry) => entry.trip.name).join(", "),
      permissions: scopeLabels(t, grant.scopes),
    };
  });

  const activeByClient = new Map<string, number>();
  for (const grant of grants) {
    if (!grant.revokedAt && !isInactive(grant.lastUsedAt, now)) {
      activeByClient.set(grant.client.id, (activeByClient.get(grant.client.id) ?? 0) + 1);
    }
  }
  const clientItems: ClientItem[] = clients.map((client) => ({
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    redirectUri: client.redirectUris[0] ?? "",
    registered: t.agentsClientRegistered.replace("{date}", day(client.createdAt)),
    activeConnections: activeByClient.get(client.id) ?? 0,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.agentsCardTitle}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t.agentsPageSubtitle}</p>
      </div>

      {config ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
          <p className="text-muted-foreground">{t.agentsMcpUrlLabel}</p>
          <p className="font-mono break-all mt-0.5">{config.resource}</p>
        </div>
      ) : (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {t.agentsNotConfigured}
        </p>
      )}

      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">{t.agentsTabConnections}</TabsTrigger>
          <TabsTrigger value="clients">{t.agentsTabClients}</TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="mt-4">
          <ConnectionsList connections={connections} />
        </TabsContent>
        <TabsContent value="clients" className="mt-4">
          <ClientsPanel clients={clientItems} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
