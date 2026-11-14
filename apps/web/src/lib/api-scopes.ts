import type { ApiScope } from "@prisma/client";

export const API_SCOPES = {
  "trips:read": "TRIPS_READ",
  "activities:write": "ACTIVITIES_WRITE",
  "accommodations:write": "ACCOMMODATIONS_WRITE",
  "equipment:write": "EQUIPMENT_WRITE",
} as const satisfies Record<string, ApiScope>;

export type ApiScopeName = keyof typeof API_SCOPES;

export const API_SCOPE_NAMES = Object.keys(API_SCOPES) as ApiScopeName[];

const SCOPE_NAME_BY_VALUE = Object.fromEntries(
  API_SCOPE_NAMES.map((name) => [API_SCOPES[name], name]),
) as Record<ApiScope, ApiScopeName>;

export function apiScopeName(scope: ApiScope): ApiScopeName {
  return SCOPE_NAME_BY_VALUE[scope];
}
