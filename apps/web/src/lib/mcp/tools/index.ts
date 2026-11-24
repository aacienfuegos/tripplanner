import "server-only";
import type { ToolDefinition } from "@/lib/mcp/tool";
import { tripTools } from "@/lib/mcp/tools/trips";

// The whole catalog, in the order tools/list gives it.
export const TOOLS: readonly ToolDefinition[] = [...tripTools];

export const TOOLS_BY_NAME: ReadonlyMap<string, ToolDefinition> = new Map(TOOLS.map((tool) => [tool.name, tool]));
