import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Bot, ShieldAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getT } from "@/lib/locale";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsentForm, type ConsentStrings } from "@/components/agents/consent-form";
import { getOAuthConfig } from "@/lib/oauth/config";
import { prepareAuthorization, type AuthorizeErrorPage } from "@/lib/oauth/authorize";
import { hostOf, isLoopbackRedirect } from "@/lib/oauth/client-rules";
import { RateLimiter, clientIp } from "@/lib/rate-limit";
import type { WebTKeys } from "@/i18n";

const perIp = new RateLimiter(30, 60_000);

type BackLink = { readonly href: string; readonly host: string };

function Message({ t, text, toConnections = false, back }: { t: WebTKeys; text: string; toConnections?: boolean; back?: BackLink }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle>{t.agentsAuthorizeErrorTitle}</CardTitle>
          <CardDescription>{text}</CardDescription>
        </CardHeader>
        <CardContent>
          {back ? (
            <a href={back.href} rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
              {t.agentsAuthorizeBackTo.replace("{host}", back.host)}
            </a>
          ) : (
            <Link href={toConnections ? "/profile/agents" : "/dashboard"} className={buttonVariants({ variant: "outline" })}>
              {toConnections ? t.agentsGoToConnections : t.agentsBackHome}
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function errorText(t: WebTKeys, reason: AuthorizeErrorPage): string {
  switch (reason) {
    case "not_approved":
      return t.agentsAuthorizeNotApproved;
    case "invalid_client":
      return t.agentsAuthorizeInvalidClient;
    case "invalid_redirect_uri":
      return t.agentsAuthorizeInvalidRedirect;
    case "foreign_client":
      return t.agentsAuthorizeForeignClient;
    case "invalid_request":
      return t.agentsAuthorizeInvalidRequest;
  }
}

function consentStrings(t: WebTKeys): ConsentStrings {
  return {
    name: t.agentsConsentName,
    trips: t.agentsConsentTrips,
    tripsAll: t.agentsConsentTripsAll,
    tripsSome: t.agentsConsentTripsSome,
    noTrips: t.agentsConsentNoTrips,
    tripsPermissions: t.agentsConsentTripsPermissions,
    tripsRead: t.agentsScopeTripsRead,
    tripsSuggest: t.agentsScopeTripsSuggest,
    tripsWrite: t.agentsScopeTripsWrite,
    tripsDelete: t.agentsScopeTripsDelete,
    dives: t.agentsConsentDives,
    divesNone: t.agentsScopeDivesNone,
    divesRead: t.agentsScopeDivesRead,
    divesWrite: t.agentsScopeDivesWrite,
    divesDelete: t.agentsScopeDivesDelete,
    offline: t.agentsConsentOffline,
    authorize: t.agentsConsentAuthorize,
    cancel: t.agentsConsentCancel,
    errors: {
      invalid: t.agentsConsentErrorInvalid,
      expired: t.agentsConsentErrorExpired,
      csrf: t.agentsConsentErrorCsrf,
      invalid_trips: t.agentsConsentErrorTrips,
      no_scopes: t.agentsConsentErrorNoScopes,
      limit: t.agentsConsentErrorLimit,
      unavailable: t.agentsAuthorizeUnavailable,
    },
  };
}

// Outside the (app) layout: it has its own approval check, and the proxy gives
// it frame-ancestors 'none' like every page.
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const t = await getT();
  const config = getOAuthConfig();
  if (!config) return <Message t={t} text={t.agentsAuthorizeUnavailable} />;
  if (perIp.hit(clientIp(await headers())).limited) return <Message t={t} text={t.agentsAuthorizeTooMany} />;

  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const userId = session.user.id;

  const outcome = await prepareAuthorization(config, userId, await searchParams);
  if (outcome.kind === "error") return <Message t={t} text={errorText(t, outcome.reason)} />;
  if (outcome.kind === "limit") return <Message t={t} text={t.agentsAuthorizeLimit} toConnections />;
  if (outcome.kind === "redirect") redirect(outcome.location);
  if (outcome.kind === "client_error") {
    const back = { href: outcome.location, host: hostOf(outcome.location) };
    return <Message t={t} text={t.agentsAuthorizeClientError.replace("{error}", outcome.error)} back={back} />;
  }

  const { view } = outcome;
  const trips = await prisma.trip.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const origin =
    view.client.kind === "CIMD"
      ? hostOf(view.client.clientId)
      : t.agentsConsentRegisteredByYou.replace("{date}", format(view.client.createdAt, "PPP", { locale: dfLocale }));
  const redirectHost = hostOf(view.redirectUri);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <CardTitle>{t.agentsConsentTitle}</CardTitle>
          </div>
          <CardDescription>{t.agentsConsentIntro.replace("{client}", view.client.name)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t.agentsConsentClientDomain}</dt>
            <dd className="break-all font-medium">{origin}</dd>
            <dt className="text-muted-foreground">{t.agentsConsentRedirect}</dt>
            <dd className="break-all font-medium">{redirectHost}</dd>
          </dl>
          {isLoopbackRedirect(view.redirectUri) && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              {t.agentsConsentLocalhostWarning}
            </p>
          )}
          <ConsentForm
            requestId={view.requestId}
            csrfToken={view.csrfToken}
            defaultName={view.client.name}
            scopes={view.scopes}
            trips={trips}
            strings={consentStrings(t)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
