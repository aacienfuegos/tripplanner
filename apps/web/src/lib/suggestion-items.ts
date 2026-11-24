import "server-only";
import type { AgentSuggestionKind } from "@prisma/client";
import { format, parseISO } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { accommodationInputSchema, activityInputSchema } from "@/lib/agent-schemas";
import { formatCurrency } from "@/lib/currency";
import { listPendingSuggestions } from "@/lib/services/suggestions";
import type { SuggestionItem } from "@/components/agents/agent-suggestions";
import type { WebTKeys } from "@/i18n";

// The first pending suggestions of a trip's section, as the cards of its block
// show them, and whether there are more. One whose data no longer passes the
// schema still shows, to dismiss it.
export async function getSuggestionItems(
  userId: string,
  tripId: string,
  kind: AgentSuggestionKind,
  t: WebTKeys,
  currency: string,
): Promise<{ items: SuggestionItem[]; more: boolean }> {
  const { suggestions, more } = await listPendingSuggestions(userId, tripId, kind);
  const locale = t.locale === "es" ? esLocale : enUS;
  const day = (value: string) => format(parseISO(value), "PP", { locale });
  const price = (value: number | null | undefined) =>
    value === null || value === undefined ? [] : [formatCurrency(value, currency, t.dateLocale)];
  const text = (...values: (string | null | undefined)[]) => values.filter((v): v is string => !!v);

  const items = suggestions.map((suggestion): SuggestionItem => {
    const base = { id: suggestion.id, by: suggestion.grantName, title: null, details: [], notes: null };
    if (kind === "ACCOMMODATION") {
      const parsed = accommodationInputSchema.safeParse(suggestion.payload);
      if (!parsed.success) return base;
      const a = parsed.data;
      return {
        ...base,
        title: a.name,
        details: [...text(a.address, a.city), `${day(a.checkIn)} – ${day(a.checkOut)}`, ...price(a.price)],
        notes: a.notes ?? null,
      };
    }
    const parsed = activityInputSchema.safeParse(suggestion.payload);
    if (!parsed.success) return base;
    const a = parsed.data;
    return {
      ...base,
      title: a.name,
      details: [
        ...text(a.location, a.city),
        ...(a.scheduledAt ? [format(parseISO(a.scheduledAt), "PPp", { locale })] : []),
        ...price(a.price),
      ],
      notes: a.description ?? a.notes ?? null,
    };
  });
  return { items, more };
}
