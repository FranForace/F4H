// Servidor estático para probar F4H en local igual que Vercel (/ → F4H_Sistema_Beta_v6.html).
// Uso: node tests/mobile/serve.js   → http://localhost:8934
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/F4H_Sistema_Beta_v6.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const type = u === '/manifest.json' ? 'application/manifest+json' : (TYPES[path.extname(f)] || 'application/octet-stream');
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(d);
  });
}).listen(8934, () => console.log('F4H local en http://localhost:8934'));
