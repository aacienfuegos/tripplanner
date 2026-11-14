// happy-dom descarta cabeceras de new Request() (ver dive-import-route.test.ts):
// el stub expone solo lo que leen los handlers de /api/v1.
export interface ApiRequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string | ReadableStream<Uint8Array>;
}

export function streamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

export function apiRequest({
  method = "GET",
  url = "http://localhost/api/v1/trips",
  headers = {},
  body,
}: ApiRequestOptions = {}): Request {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    url,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    body: typeof body === "string" ? streamOf(body) : (body ?? null),
  } as unknown as Request;
}

export function jsonRequest(method: string, url: string, token: string, data: unknown): Request {
  const body = JSON.stringify(data);
  return apiRequest({
    method,
    url,
    headers: { authorization: `Bearer ${token}`, "content-length": String(Buffer.byteLength(body)) },
    body,
  });
}
