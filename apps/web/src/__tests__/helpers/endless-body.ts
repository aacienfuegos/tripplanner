// A form body that never ends, sent without Content-Length, as a chunked
// request arrives. `pulled` says how many 1 KB chunks the reader asked for,
// and `cancelled` whether it gave up on the rest.
export function endlessFormRequest(url: string, headers: Record<string, string> = {}) {
  const state = { pulled: 0, cancelled: false };
  const chunk = new TextEncoder().encode(`token=${"a".repeat(1024 - 6)}`);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.pulled += 1;
      controller.enqueue(chunk);
    },
    cancel() {
      state.cancelled = true;
    },
  });
  const request = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, state };
}
