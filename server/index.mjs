import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, databaseMode, initializeDatabase, readSave, writeSave } from './db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(root, 'dist', 'tibia-dungeons', 'browser');
const port = Number(process.env.PORT ?? 3001);
const types = { '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function sendJson(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function bodyJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function serveStatic(response, pathname) {
  let filePath = pathname === '/'
    ? path.join(webRoot, 'index.html')
    : path.resolve(webRoot, `.${decodeURIComponent(pathname)}`);
  if (!filePath.startsWith(webRoot + path.sep) && filePath !== path.join(webRoot, 'index.html')) return false;
  try { if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html'); }
  catch { filePath = path.join(webRoot, 'index.html'); }
  try {
    const contents = await readFile(filePath);
    response.writeHead(200, { 'content-type': `${types[path.extname(filePath)] ?? 'application/octet-stream'}; charset=utf-8` });
    response.end(contents);
    return true;
  } catch { return false; }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname === '/api/health' && request.method === 'GET') {
      sendJson(response, 200, { ok: true, database: databaseMode });
      return;
    }
    if (url.pathname === '/api/games' && request.method === 'POST') {
      const id = randomUUID();
      const state = await bodyJson(request);
      await writeSave(id, state);
      sendJson(response, 201, { id, state });
      return;
    }
    const gameMatch = url.pathname.match(/^\/api\/games\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    if (gameMatch && request.method === 'GET') {
      const state = await readSave(gameMatch[1]);
      sendJson(response, state ? 200 : 404, state ? { id: gameMatch[1], state } : { error: 'Game save not found' });
      return;
    }
    if (gameMatch && request.method === 'PUT') {
      if (!await readSave(gameMatch[1])) {
        sendJson(response, 404, { error: 'Game save not found' });
        return;
      }
      const state = await bodyJson(request);
      await writeSave(gameMatch[1], state);
      sendJson(response, 200, { id: gameMatch[1], state });
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'API route not found' });
      return;
    }
    if (await serveStatic(response, url.pathname)) return;
    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, error.status ?? 500, { error: error.status ? error.message : 'Internal server error' });
    if (!error.status) console.error(error);
  }
});

await initializeDatabase();
server.listen(port, '0.0.0.0', () => console.log(`Tibia Dungeons API listening on ${port} (${databaseMode})`));
process.on('SIGTERM', async () => { server.close(); await closeDatabase(); });
