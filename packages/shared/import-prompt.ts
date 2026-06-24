// Prompts are intentionally in English — LLMs follow JSON schemas more accurately
// with English instructions. Trip dates are injected to resolve ambiguous years.

interface PromptOptions {
  tripStartDate?: string;
  tripEndDate?: string;
}

const SCHEMA_AND_EXAMPLE = `SCHEMA:
{
  "flights": [
    {
      "airline": "string (required) — airline name, e.g. Iberia",
      "flightNumber": "string (required) — e.g. IB3456",
      "origin": "string (required) — IATA code or city name",
      "destination": "string (required) — IATA code or city name",
      "departureAt": "string (required) — ISO 8601 datetime",
      "arrivalAt": "string (required) — ISO 8601 datetime",
      "bookingRef": "string — booking reference / PNR / locator",
      "seatNumber": "string — e.g. 14C",
      "class": "ECONOMY | PREMIUM_ECONOMY | BUSINESS | FIRST  (default: ECONOMY)",
      "price": "number — total ticket price",
      "notes": "string — any additional info"
    }
  ],
  "accommodations": [
    {
      "name": "string (required) — hotel or property name",
      "type": "HOTEL | HOSTEL | AIRBNB | APARTMENT | RESORT | OTHER  (default: HOTEL)",
      "city": "string (required) — city where the accommodation is located",
      "address": "string — full address",
      "checkIn": "string (required) — ISO 8601 datetime",
      "checkOut": "string (required) — ISO 8601 datetime",
      "bookingRef": "string — booking reference",
      "price": "number — total price for the stay",
      "pricePerNight": "number — price per night",
      "notes": "string"
    }
  ],
  "activities": [
    {
      "name": "string (required) — name of the activity, restaurant, tour, show, etc.",
      "type": "ACTIVITY | RESTAURANT | MUSEUM | TOUR | TRANSPORT | SHOW | OTHER  (default: ACTIVITY)",
      "description": "string — brief description",
      "location": "string — specific venue or address",
      "city": "string",
      "scheduledAt": "string — ISO 8601 datetime",
      "duration": "number — duration in minutes",
      "bookingRef": "string — booking or reservation reference",
      "price": "number — price per person or total",
      "status": "PENDING | RESERVED | CONFIRMED | CANCELLED  (default: PENDING)",
      "notes": "string"
    }
  ],
  "expenses": [
    {
      "description": "string (required) — what the expense is for",
      "category": "FLIGHT | ACCOMMODATION | FOOD | TRANSPORT | ACTIVITY | SHOPPING | OTHER  (required)",
      "amount": "number (required) — expense amount",
      "currency": "string — ISO 4217 code, e.g. EUR, USD, GBP  (default: EUR)",
      "date": "string (required) — ISO 8601 datetime",
      "paid": "boolean — whether it has been paid  (default: false)",
      "notes": "string"
    }
  ],
  "packing": [
    {
      "name": "string (required) — item name",
      "category": "string (required) — e.g. Clothing, Electronics, Documents, Toiletries",
      "quantity": "number — how many  (default: 1)"
    }
  ],
  "documents": [
    {
      "name": "string (required) — document name or description",
      "type": "PASSPORT | VISA | INSURANCE | TICKET | VOUCHER | OTHER  (required)",
      "expiresAt": "string — ISO 8601 datetime of expiration date",
      "notes": "string"
    }
  ]
}

EXAMPLE OUTPUT (flight + hotel booking):
{
  "flights": [
    {
      "airline": "Iberia",
      "flightNumber": "IB3456",
      "origin": "MAD",
      "destination": "BCN",
      "departureAt": "2024-06-15T07:30:00",
      "arrivalAt": "2024-06-15T08:45:00",
      "bookingRef": "ABC123",
      "class": "ECONOMY",
      "price": 89.50
    }
  ],
  "accommodations": [
    {
      "name": "Hotel Arts Barcelona",
      "type": "HOTEL",
      "city": "Barcelona",
      "checkIn": "2024-06-15T14:00:00",
      "checkOut": "2024-06-18T12:00:00",
      "bookingRef": "XYZ789",
      "pricePerNight": 250
    }
  ]
}`;

/**
 * System prompt for AgentOS mode: static instructions, schema, and example.
 * Sent as system_prompt so Claude treats them as authoritative behavior rules.
 * The user content goes in the prompt field separately.
 */
export function generateImportSystemPrompt(): string {
  return `You are a structured data extractor for a travel planning app. Your task is to extract travel information from user-provided content (PDF text, booking confirmations, itineraries, emails, etc.) and return it as a JSON object.

CRITICAL OUTPUT RULE: Your entire response must be a single valid JSON object. Start with { and end with }. No text before or after. No markdown. No code fences. No explanations. No source citations. Just the JSON.

EXTRACTION RULES:
1. Use ISO 8601 format for all dates and datetimes (e.g. "2024-06-15T14:30:00"). For dates without a time, use T00:00:00.
2. Omit sections that have no data — do not include empty arrays.
3. If a field is not found in the content, omit it entirely. Never use null or empty strings.
4. All price/amount values must be numbers, not strings (e.g. 89.50 not "89.50").
5. Include ALL items found. If there are multiple flights or hotels, include all of them.
6. For IATA codes: if the content uses a city name instead of an airport code, use the most common IATA code for that city (e.g. "Madrid" → "MAD", "London" → "LHR").

WEB SEARCH GUIDANCE (when WebSearch/WebFetch tools are available):
- USE web search to: look up IATA airport codes, find hotel addresses, verify airline names or flight numbers, resolve ambiguous venue locations.
- DO NOT use web search to find the travel content itself — the user has already provided it. Trust the provided content over web results.
- Prefer 1–2 targeted searches over broad exploration. Stop searching once you have the missing detail.

${SCHEMA_AND_EXAMPLE}`;
}

/**
 * User message for AgentOS mode: trip context + content to extract from.
 * Paired with generateImportSystemPrompt() for the system_prompt field.
 */
export function generateImportUserMessage(
  content: string,
  options?: PromptOptions,
): string {
  const tripContext =
    options?.tripStartDate && options?.tripEndDate
      ? `TRIP CONTEXT: This trip runs from ${options.tripStartDate.slice(0, 10)} to ${options.tripEndDate.slice(0, 10)}. Use this to resolve ambiguous dates — e.g. if the content says "June 15" without a year, infer the year from these dates.\n\n`
      : "";

  return `${tripContext}Extract all travel data from the following content:\n\n${content}`;
}

/**
 * Full combined prompt for manual mode (copy-paste to external AI).
 * External AIs don't have a separate system_prompt field, so everything goes in one block.
 */
export function generateImportPrompt(options?: PromptOptions): string {
  const tripContext =
    options?.tripStartDate && options?.tripEndDate
      ? `\nTRIP CONTEXT: This trip runs from ${options.tripStartDate.slice(0, 10)} to ${options.tripEndDate.slice(0, 10)}. Use this to resolve ambiguous dates — e.g. if the content says "June 15" without a year, infer the year from these dates.\n`
      : "";

  return `You are a structured data extractor for a travel planning app. I will provide travel-related content (PDF text, booking confirmations, itineraries, emails, etc.). Extract all relevant information and return it as a single JSON object following the exact schema below.${tripContext}

RULES:
1. Return ONLY the raw JSON object. No explanation, no markdown, no code fences (no \`\`\`json).
2. Use ISO 8601 format for all dates and datetimes (e.g. "2024-06-15T14:30:00"). For dates without a time component, use T00:00:00.
3. Omit sections that have no data in the provided content — do not include empty arrays.
4. If a field is not found, omit it entirely. Do not include null or empty strings.
5. All price/amount values must be numbers, not strings (e.g. 89.50 not "89.50").
6. Include ALL items you find. If there are multiple flights or hotels, include all of them.

${SCHEMA_AND_EXAMPLE}

---
Now extract the data from the following content:

[PASTE YOUR TRAVEL CONTENT HERE — PDF text, booking confirmation email, itinerary, etc.]`;
}
