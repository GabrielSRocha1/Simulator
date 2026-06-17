// Servidor HTTP minimal — só pra contornar o bloqueio de fetch() em file:// do Chrome.
// Uso: node serve.js  →  http://localhost:8000/preview.html
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
};

// Proxy do DAS getAsset — api.mainnet-beta.solana.com bloqueia esse metodo
// quando chamado de browsers (responde 403 com Origin header). Servidor Node
// nao tem origin, entao a chamada funciona.
function proxyAsset(mint, res) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: mint } });
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  const req = require('https').request('https://api.mainnet-beta.solana.com', opts, (r) => {
    let data = '';
    r.on('data', (c) => data += c);
    r.on('end', () => {
      try {
        const j = JSON.parse(data);
        const c = j?.result?.content || {};
        const out = {
          image: c.links?.image || c.files?.[0]?.uri || null,
          name:  c.metadata?.name || null,
          symbol: c.metadata?.symbol || null,
        };
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' });
        res.end(JSON.stringify(out));
      } catch {
        res.writeHead(502); res.end('{}');
      }
    });
  });
  req.on('error', () => { res.writeHead(502); res.end('{}'); });
  req.write(body);
  req.end();
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  // Proxy: /asset/<mint>
  const m = p.match(/^\/asset\/([A-Za-z0-9]+)$/);
  if (m) { proxyAsset(m[1], res); return; }
  if (p === '/') p = '/preview.html';
  const filePath = path.join(ROOT, p);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + p); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Servindo ${ROOT} em http://localhost:${PORT}/`);
  console.log(`Abra: http://localhost:${PORT}/preview.html`);
});
