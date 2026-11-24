import type { z } from "zod";
import type { Scope } from "@/lib/services/actor";

// What the services throw. The web actions turn a trip that isn't the user's
// into the redirect they always did and let the rest go up; the MCP tools turn
// each one into a tool error with its code.

export type Entity =
  | "Trip"
  | "Destination"
  | "Flight"
  | "Accommodation"
  | "Activity"
  | "Document"
  | "Expense"
  | "Task"
  | "Packing item"
  | "Suitcase"
  | "Dive"
  | "Dive site"
  | "Dive area"
  | "Equipment"
  | "Equipment service"
  | "Certification"
  | "Media library"
  | "Register entry"
  | "Suggestion";

// The same error for what doesn't exist, what is another user's and what is
// outside an agent's connection: telling them apart would confirm that an id
// exists.
export class NotFoundError extends Error {
  constructor(readonly entity: Entity) {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

export class InputError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "InputError";
  }
}

export class DuplicateError extends Error {
  constructor(readonly existing: { readonly id: string }) {
    super("Duplicate");
    this.name = "DuplicateError";
  }
}

export class LimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Limit reached");
    this.name = "LimitError";
  }
}

export class ConflictError extends Error {
  constructor(readonly linked: Readonly<Record<string, number>>) {
    super("Linked records prevent this");
    this.name = "ConflictError";
  }
}

export class ScopeError extends Error {
  constructor(readonly missing: readonly Scope[]) {
    super(`Missing scopes: ${missing.join(" ")}`);
    this.name = "ScopeError";
  }
}

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new InputError(issue.path.map(String).join("."), issue.message);
}

// Prisma's P2025: an update or delete whose where matched nothing. With the
// owner in the where, an id from someone else gives the same, and nothing is
// written.
function isRecordNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

export async function orNotFound<T>(entity: Entity, write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error) {
    if (isRecordNotFound(error)) throw new NotFoundError(entity);
    throw error;
  }
}
