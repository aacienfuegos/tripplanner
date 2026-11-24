import "server-only";
import type { ToolDefinition } from "@/lib/mcp/tool";
import { diveCatalogTools } from "@/lib/mcp/tools/dive-catalog";
import { diveTools } from "@/lib/mcp/tools/dives";
import { diveDeleteTools, sectionDeleteTools } from "@/lib/mcp/tools/deletes";
import { sectionTools } from "@/lib/mcp/tools/sections";
import { tripTools } from "@/lib/mcp/tools/trips";

// The whole catalog, in the order tools/list gives it. There is no tool to
// delete a trip or a dive.
export const TOOLS: readonly ToolDefinition[] = [
  ...tripTools,
  ...sectionTools,
  ...sectionDeleteTools,
  ...diveTools,
  ...diveCatalogTools,
  ...diveDeleteTools,
];

export const TOOLS_BY_NAME: ReadonlyMap<string, ToolDefinition> = new Map(TOOLS.map((tool) => [tool.name, tool]));
