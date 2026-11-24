"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitConsent, type ConsentState } from "@/app/oauth/authorize/actions";
import type { ConsentError } from "@/lib/oauth/consent";

export type ConsentStrings = {
  readonly name: string;
  readonly trips: string;
  readonly tripsAll: string;
  readonly tripsSome: string;
  readonly noTrips: string;
  readonly tripsPermissions: string;
  readonly tripsRead: string;
  readonly tripsSuggest: string;
  readonly tripsWrite: string;
  readonly tripsDelete: string;
  readonly dives: string;
  readonly divesNone: string;
  readonly divesRead: string;
  readonly divesWrite: string;
  readonly divesDelete: string;
  readonly offline: string;
  readonly authorize: string;
  readonly cancel: string;
  readonly errors: Readonly<Record<ConsentError | "unavailable", string>>;
};

type Props = {
  readonly requestId: string;
  readonly csrfToken: string;
  readonly defaultName: string;
  readonly scopes: readonly string[];
  readonly trips: readonly { readonly id: string; readonly name: string }[];
  readonly strings: ConsentStrings;
};

const choice = "h-4 w-4 shrink-0 accent-primary";

function Option({ children, ...input }: React.ComponentProps<"input">) {
  return (
    <label className="flex items-center gap-2 text-sm py-1">
      <input className={choice} {...input} />
      <span>{children}</span>
    </label>
  );
}

function Buttons({ strings }: { strings: ConsentStrings }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="submit" name="decision" value="deny" variant="outline" disabled={pending}>
        {strings.cancel}
      </Button>
      <Button type="submit" name="decision" value="allow" disabled={pending}>
        {strings.authorize}
      </Button>
    </div>
  );
}

// Only what the client asked for is offered. Write and delete start unticked.
export function ConsentForm({ requestId, csrfToken, defaultName, scopes, trips, strings }: Props) {
  const [state, formAction] = useActionState<ConsentState, FormData>(submitConsent, null);
  const [tripsMode, setTripsMode] = useState<"all" | "some">("some");
  const asked = new Set(scopes);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="csrfToken" value={csrfToken} />

      <div className="space-y-1.5">
        <Label htmlFor="agent-name">{strings.name}</Label>
        <Input id="agent-name" name="name" defaultValue={defaultName.slice(0, 60)} maxLength={60} />
      </div>

      {asked.has("trips:read") && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{strings.trips}</legend>
          <Option type="radio" name="tripsMode" value="all" checked={tripsMode === "all"} onChange={() => setTripsMode("all")}>
            {strings.tripsAll}
          </Option>
          <Option type="radio" name="tripsMode" value="some" checked={tripsMode === "some"} onChange={() => setTripsMode("some")}>
            {strings.tripsSome}
          </Option>
          {tripsMode === "some" && (
            <div className="ml-6 max-h-48 overflow-y-auto rounded-md border px-3 py-1">
              {trips.length === 0 && <p className="py-1 text-sm text-muted-foreground">{strings.noTrips}</p>}
              {trips.map((trip) => (
                <Option key={trip.id} type="checkbox" name="tripIds" value={trip.id}>
                  {trip.name}
                </Option>
              ))}
            </div>
          )}
          <p className="pt-1 text-sm font-medium">{strings.tripsPermissions}</p>
          <Option type="checkbox" checked disabled readOnly>
            {strings.tripsRead}
          </Option>
          {asked.has("trips:suggest") && (
            <Option type="checkbox" name="tripsSuggest">
              {strings.tripsSuggest}
            </Option>
          )}
          {asked.has("trips:write") && (
            <Option type="checkbox" name="tripsWrite">
              {strings.tripsWrite}
            </Option>
          )}
          {asked.has("trips:delete") && (
            <Option type="checkbox" name="tripsDelete">
              {strings.tripsDelete}
            </Option>
          )}
        </fieldset>
      )}

      {asked.has("dives:read") && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{strings.dives}</legend>
          <Option type="radio" name="dives" value="none" defaultChecked>
            {strings.divesNone}
          </Option>
          <Option type="radio" name="dives" value="read">
            {strings.divesRead}
          </Option>
          {asked.has("dives:write") && (
            <Option type="radio" name="dives" value="write">
              {strings.divesWrite}
            </Option>
          )}
          {asked.has("dives:delete") && (
            <Option type="checkbox" name="divesDelete">
              {strings.divesDelete}
            </Option>
          )}
        </fieldset>
      )}

      {asked.has("offline_access") && <p className="text-sm text-muted-foreground">{strings.offline}</p>}

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {strings.errors[state.error]}
        </p>
      )}

      <Buttons strings={strings} />
    </form>
  );
}
