import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3';

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const qs = url.slice(idx + 1);
  const result: Record<string, string> = {};
  for (const part of qs.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) result[decodeURIComponent(part)] = '';
    else result[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
  }
  return result;
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-proxy',
      configureServer(server) {
        server.middlewares.use('/api/proxy', async (req, res) => {
          const query = parseQuery(req.url || '');
          const targetUrl = query.url;
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }
          try {
            const headers: Record<string, string> = {
              'User-Agent': USER_AGENT,
              'X-User-Agent': USER_AGENT,
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Connection': 'keep-alive',
            };
            if (query._auth) headers['Authorization'] = query._auth;
            if (query._cookie) headers['Cookie'] = query._cookie;
            const resp = await fetch(targetUrl, { method: 'GET', headers });
            const text = await resp.text();
            const ct = resp.headers.get('content-type') || '';
            let jsonData;
            let parseFailed = false;
            try {
              jsonData = JSON.parse(text);
            } catch {
              const jsonMatch = text.match(/(\{[\s\S]*\})/);
              if (jsonMatch) {
                try {
                  jsonData = JSON.parse(jsonMatch[1]);
                } catch {
                  parseFailed = true;
                }
              } else {
                parseFailed = true;
              }
            }
            if (!parseFailed && jsonData) {
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(jsonData));
            } else {
              res.setHeader('content-type', ct);
              res.end(text);
            }
          } catch (e: any) {
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'Proxy request failed', message: e.message }));
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  css: {
    devSourcemap: false,
  },
});
