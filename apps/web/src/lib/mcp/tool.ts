import "server-only";
import { z } from "zod";
import type { CallToolResult, StandardSchemaWithJSON, ToolAnnotations } from "@modelcontextprotocol/server";
import type { AgentActor } from "@/lib/oauth/verify";
import type { Scope } from "@/lib/services/actor";
import {
  ConflictError,
  DuplicateError,
  InputError,
  LimitError,
  NotFoundError,
  ScopeError,
  parseInput,
} from "@/lib/services/errors";

// What a tool needs to know about the connection beyond its actor: whether the
// user is an admin with a media library, read once per request.
export type ToolContext = { readonly actor: AgentActor; readonly mediaAdmin: boolean };

export type ToolDefinition = {
  readonly name: string;
  readonly scope: Scope;
  readonly title: string;
  readonly description: string;
  readonly input: z.ZodType;
  readonly output: z.ZodType;
  readonly annotations: ToolAnnotations;
  // Only with a connection to all trips (create_trip, update_trip).
  readonly allTripsOnly?: boolean;
  // Only for an admin with a media library.
  readonly mediaAdminOnly?: boolean;
  readonly run: (context: ToolContext, args: unknown) => Promise<unknown>;
};

export function defineTool<I extends z.ZodType, O extends z.ZodType>(definition: {
  readonly name: string;
  readonly scope: Scope;
  readonly title: string;
  readonly description: string;
  readonly input: I;
  readonly output: O;
  readonly annotations: ToolAnnotations;
  readonly allTripsOnly?: boolean;
  readonly mediaAdminOnly?: boolean;
  readonly run: (context: ToolContext, args: z.output<I>) => Promise<z.input<O>>;
}): ToolDefinition {
  return {
    ...definition,
    run: (context, args) => definition.run(context, parseInput(definition.input, args)),
  };
}

export const READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
export const CREATE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
export const DELETE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};
export const EDIT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

// tools/list advertises the real schema, but the SDK's own check passes every
// argument through: the tool parses it, so that a bad one is an invalid_input
// error with its field instead of the SDK's plain text.
export function advertised(schema: z.ZodType): StandardSchemaWithJSON {
  const standard = schema["~standard"];
  return {
    "~standard": {
      version: 1,
      vendor: "tripplanner",
      validate: (value: unknown) => ({ value }),
      jsonSchema: standard.jsonSchema,
    },
  };
}

export const idInput = z.string().min(1).max(200);

export const DUPLICATES =
  "If the same one already exists, nothing is created and the error duplicate gives the existing one; call again with force: true to create it anyway.";

// Creating or editing a trip needs a connection to all of them. The tool isn't
// even published otherwise; this is in case it gets called anyway.
export function requireAllTrips(actor: AgentActor): void {
  if (!actor.grant.allTrips) throw new ScopeError(["trips:write"]);
}

// ─── Output ───────────────────────────────────────────────────────────────────

export const recordOutput = z.looseObject({ id: z.string() });
export const listOutput = z.object({ items: z.array(recordOutput), nextCursor: z.string().nullable() });

export const PAGE = { default: 50, max: 100 } as const;
export const pageInput = {
  cursor: z.string().min(1).max(200).optional().describe("nextCursor of the previous page"),
  limit: z.number().int().min(1).max(PAGE.max).optional().describe(`Page size, ${PAGE.default} by default`),
};

const pad = (n: number) => String(n).padStart(2, "0");
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// The fields written with a time; every other date is a day. Dates go out in
// the format they come in, so an agent can read and write back without
// converting.
const DATE_TIME_FIELDS = new Set(["departureAt", "arrivalAt", "scheduledAt"]);
const INSTANT_FIELDS = new Set(["createdAt", "updatedAt"]);
const HIDDEN_FIELDS = new Set(["userId", "agentGrantId"]);

export function toOutput(row: Readonly<Record<string, unknown>>): Record<string, unknown> & { id: string } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (value instanceof Date) {
      out[key] = INSTANT_FIELDS.has(key)
        ? value.toISOString()
        : DATE_TIME_FIELDS.has(key)
          ? `${localDay(value)}T${localTime(value)}`
          : localDay(value);
    } else {
      out[key] = value;
    }
  }
  return { ...out, id: String(row.id) };
}

export function page<T extends { id: string }>(rows: readonly T[], limit: number): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
}

// ─── Results ──────────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function result(structured: Record<string, unknown>, isError: boolean): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(structured) }],
    structuredContent: structured,
    ...(isError ? { isError: true } : {}),
  };
}

// What the services throw becomes a tool error with its code. The same
// not_found for what doesn't exist, what is someone else's and what is outside
// the connection. Anything else is logged by class only: a message could carry
// what the agent sent.
export async function callTool(tool: ToolDefinition, context: ToolContext, args: unknown): Promise<CallToolResult> {
  try {
    const output = await tool.run(context, args);
    return result(isRecord(output) ? output : { value: output }, false);
  } catch (error) {
    if (error instanceof InputError) return result({ code: "invalid_input", field: error.field, message: error.message }, true);
    if (error instanceof NotFoundError) return result({ code: "not_found", message: error.message }, true);
    if (error instanceof DuplicateError) return result({ code: "duplicate", existing: error.existing }, true);
    if (error instanceof LimitError) {
      const detail = error.retryAfterSeconds === null ? { message: error.message } : { retryAfterSeconds: error.retryAfterSeconds };
      return result({ code: "limit", ...detail }, true);
    }
    if (error instanceof ConflictError) {
      return result({ code: "conflict", message: "It has linked records; nothing was deleted", linked: error.linked }, true);
    }
    if (error instanceof ScopeError) return result({ code: "forbidden", message: "Not allowed for this connection" }, true);
    console.error("[mcp] tool_error", tool.name, error instanceof Error ? error.name : typeof error);
    return result({ code: "internal_error", message: "The tool failed" }, true);
  }
}
