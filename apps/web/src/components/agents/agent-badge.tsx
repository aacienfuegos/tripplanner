"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/contexts/LanguageContext";

// The mark of an element an agent wrote last: the name of its connection, and
// whether it created it or edited it, or null once the register no longer
// says. The page resolves the names (lib/agent-labels.ts) and the lists only
// say where the mark goes.

export type AgentLabel = { readonly name: string; readonly action: "CREATED" | "UPDATED" | null };
export type AgentLabels = Readonly<Record<string, AgentLabel>>;

const AgentLabelsContext = createContext<AgentLabels>({});

export function AgentLabelsProvider({ labels, children }: { labels: AgentLabels; children: ReactNode }) {
  return <AgentLabelsContext value={labels}>{children}</AgentLabelsContext>;
}

// The name is the user's or an agent's text: always React text.
export function AgentBadge({ id }: { id: string }) {
  const label = useContext(AgentLabelsContext)[id];
  const { t } = useT();
  if (!label) return null;
  const text =
    label.action === "CREATED"
      ? t.agentsBadgeAddedBy
      : label.action === "UPDATED"
        ? t.agentsBadgeEditedBy
        : t.agentsBadgeBy;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Bot className="h-3 w-3" aria-hidden />
      {text.replace("{name}", label.name)}
    </Badge>
  );
}
