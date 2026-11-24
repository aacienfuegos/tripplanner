"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Bot, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/contexts/LanguageContext";
import { acceptAgentSuggestion, dismissAgentSuggestion, type SuggestionResult } from "@/actions/suggestions";

// "Sugerencias de agentes", above the accommodations or the activities of a
// trip, only while there are pending ones: the first ones, and a line if there
// are more. What the agent wrote is always React text.

export type SuggestionItem = {
  readonly id: string;
  readonly title: string | null;
  readonly details: readonly string[];
  readonly notes: string | null;
  readonly by: string | null;
};

function SuggestionCard({ tripId, item }: { tripId: string; item: SuggestionItem }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function run(action: (tripId: string, id: string) => Promise<SuggestionResult>, done: string) {
    startTransition(async () => {
      try {
        const result = await action(tripId, item.id);
        if (result.ok) toast.success(done);
        else toast.error(result.error === "invalid" ? t.agentsSuggestionInvalid : t.agentsNotFound);
      } catch {
        toast.error(t.agentsError);
      }
    });
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium break-words">{item.title ?? t.agentsSuggestionUnreadable}</p>
          {item.by && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Bot className="h-3 w-3" aria-hidden />
              {t.agentsSuggestionBy.replace("{name}", item.by)}
            </Badge>
          )}
        </div>
        {item.details.length > 0 && <p className="text-sm text-muted-foreground break-words">{item.details.join(" · ")}</p>}
        {item.notes && <p className="text-sm whitespace-pre-line break-words line-clamp-4">{item.notes}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={pending} onClick={() => run(acceptAgentSuggestion, t.agentsSuggestionAccepted)}>
            <Check className="h-4 w-4 mr-1" aria-hidden />
            {t.agentsSuggestionAccept}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(dismissAgentSuggestion, t.agentsSuggestionDismissed)}
          >
            <X className="h-4 w-4 mr-1" aria-hidden />
            {t.agentsSuggestionDismiss}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentSuggestions({
  tripId,
  items,
  more,
}: {
  tripId: string;
  items: readonly SuggestionItem[];
  more: boolean;
}) {
  const { t } = useT();
  if (items.length === 0) return null;
  return (
    <section className="space-y-3" aria-label={t.agentsSuggestionsTitle}>
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4" aria-hidden />
          {t.agentsSuggestionsTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{t.agentsSuggestionsIntro}</p>
      </div>
      {items.map((item) => (
        <SuggestionCard key={item.id} tripId={tripId} item={item} />
      ))}
      {more && <p className="text-sm text-muted-foreground">{t.agentsSuggestionsMore}</p>}
    </section>
  );
}
