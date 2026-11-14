import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import net from 'node:net';

function isPortListening(port = 8000, timeoutMs = 150): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let settled = false;
    s.setTimeout(timeoutMs);
    s.on('connect', () => {
      if (!settled) {
        settled = true;
        s.destroy();
        resolve(true);
      }
    });
    s.on('timeout', () => {
      if (!settled) {
        settled = true;
        s.destroy();
        resolve(false);
      }
    });
    s.on('error', () => {
      if (!settled) {
        settled = true;
        s.destroy();
        resolve(false);
      }
    });
    s.connect(port, '127.0.0.1');
  });
}

function silentOfflineProxyGuard(): Plugin {
  return {
    name: 'silent-offline-proxy-guard',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/stable-audio')) {
          const active = await isPortListening(8000);
          if (!active) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ offline: true, error: 'Stable Audio daemon is offline' }));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), silentOfflineProxyGuard()],
  server: {
    host: '127.0.0.1',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api/stable-audio': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stable-audio/, ''),
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !(res as any).headersSent) {
              (res as any).writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Stable Audio daemon offline', code: 'ECONNREFUSED' }));
            }
          });
        },
      },
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});

