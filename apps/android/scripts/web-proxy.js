#!/usr/bin/env node
// Proxy for expo web dev server that adds SharedArrayBuffer headers.
// expo-sqlite v16 (wa-sqlite) requires these for synchronous SQLite on web.
// Usage: node scripts/web-proxy.js [target_port] [proxy_port]
// Default: forwards localhost:8081 → localhost:8082

const http = require("http");
const net = require("net");

const TARGET_PORT = parseInt(process.argv[2] ?? "8081", 10);
const PROXY_PORT = parseInt(process.argv[3] ?? "8082", 10);
const TARGET_HOST = "localhost";

const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const server = http.createServer((req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(options, (upstream) => {
    // Inject isolation headers on every response
    Object.assign(upstream.headers, ISOLATION_HEADERS);
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });

  proxy.on("error", (err) => {
    res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxy);
});

// Forward WebSocket upgrades (Metro HMR)
server.on("upgrade", (req, socket, head) => {
  const conn = net.connect(TARGET_PORT, TARGET_HOST, () => {
    conn.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    conn.write(head);
    socket.pipe(conn).pipe(socket);
  });
  conn.on("error", () => socket.destroy());
});

server.listen(PROXY_PORT, () => {
  console.log(`\n✓ Web proxy ready: http://localhost:${PROXY_PORT}`);
  console.log(`  Forwarding to Metro at http://localhost:${TARGET_PORT}`);
  console.log(`  COOP/COEP headers active — SharedArrayBuffer enabled\n`);
});
