import type { IncomingMessage, ServerResponse } from 'node:http';
const attempts = new Map<string, { count: number; reset: number }>();
export function secureRequest(req: IncomingMessage & {body?: any}, res: ServerResponse, maxBytes = 32_000): any | undefined {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    let sameOrigin = false;
    try { sameOrigin = new URL(origin).host === host; } catch { /* invalid origin */ }
    if (!sameOrigin) { res.statusCode = 403; res.end(JSON.stringify({error: 'Cross-origin requests are not allowed.'})); return undefined; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return undefined; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({error: 'POST required.'})); return undefined; }
  const ip = (req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  if (attempts.size > 10000) attempts.clear();
  const rec = attempts.get(ip);
  const next = !rec || now > rec.reset ? {count: 1, reset: now + 60_000} : {count: rec.count + 1, reset: rec.reset};
  attempts.set(ip, next);
  if (next.count > 20) { res.statusCode = 429; res.end(JSON.stringify({error: 'Too many requests; try again later.'})); return undefined; }
  if (Number(req.headers['content-length'] || 0) > maxBytes) { res.statusCode = 413; res.end(JSON.stringify({error: 'Request too large.'})); return undefined; }
  // In Vercel, req.body is parsed by the runtime. Unparsed streaming bodies are rejected explicitly.
  const raw = req.body;
  if (raw === undefined) { res.statusCode = 400; res.end(JSON.stringify({error: 'Missing JSON body.'})); return undefined; }
  if (Buffer.byteLength(typeof raw === 'string' ? raw : JSON.stringify(raw)) > maxBytes) {
    res.statusCode = 413; res.end(JSON.stringify({error: 'Request too large.'})); return undefined;
  }
  try { const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    return body;
  } catch { res.statusCode = 400; res.end(JSON.stringify({error: 'Invalid JSON object.'})); return undefined; }
}
