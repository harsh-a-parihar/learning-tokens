#!/usr/bin/env node
// Tiny SDK local dev server
// Serves normalized JSON fixtures for frontend `local` mode at /api/:lms/courses/:id

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 5001;
const REMOTE_SDK = process.env.LTSDK_REMOTE_URL; // optional remote SDK base URL to proxy misses
const CACHE_TTL = Number(process.env.LTSDK_CACHE_TTL || 30); // seconds

const cache = new Map();

// Suppress noisy DeprecationWarning for util._extend from dependencies
process.on('warning', (warning) => {
  try {
    if (warning && warning.name === 'DeprecationWarning' && warning.message && warning.message.includes('util._extend')) {
      // ignore this specific deprecation warning
      return;
    }
  } catch (e) { /* ignore */ }
  // otherwise print as usual
  console.warn(warning.name || 'Warning', warning.message || '')
});

// Cache loaded connectors to avoid repeated require and logs
const connectorCache = new Map();

function sendJson(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// Fixtures have been removed. The server now always attempts a live fetch via
// the connector/adapters. If a remote SDK base is configured, misses will be
// proxied there. This keeps responses authentic and real-time.

function nowSec() { return Math.floor(Date.now() / 1000); }

async function proxyFetch(remoteBase, lms, courseId) {
  return new Promise((resolve, reject) => {
    const fetchUrl = `${remoteBase.replace(/\/$/, '')}/api/${encodeURIComponent(lms)}/courses/${encodeURIComponent(courseId)}`;
    const client = require('http');
    const parsed = url.parse(fetchUrl);
    const opts = { hostname: parsed.hostname, port: parsed.port || 80, path: parsed.path, method: 'GET' };
    const req = client.request(opts, (resp) => {
      let data = '';
      resp.setEncoding('utf8');
      resp.on('data', (chunk) => data += chunk);
      resp.on('end', () => {
        if (resp.statusCode >= 200 && resp.statusCode < 300) return resolve(data);
        return reject(new Error(`Remote SDK returned ${resp.statusCode}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  // CORS: allow frontend dev origin or any origin via env override
  const ALLOW_ORIGIN = process.env.LTSDK_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  // If you want credentials (cookies) enabled, set LTSDK_ALLOW_CREDENTIALS=true
  if (process.env.LTSDK_ALLOW_CREDENTIALS === 'true') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const parts = parsed.pathname.split('/').filter(Boolean);

  // Only basic route
  if (parts.length === 4 && parts[0] === 'api' && parts[2] === 'courses') {
    const lms = parts[1];
    const courseId = decodeURIComponent(parts[3]);
    const fresh = parsed.query && (parsed.query.fresh === 'true' || parsed.query.fresh === '1');

    const cacheKey = `${lms}::${courseId}`;
    const cached = cache.get(cacheKey);
    if (!fresh && cached && (nowSec() - cached.ts) < CACHE_TTL) {
      return sendJson(res, { source: 'local-cache', ...cached.payload });
    }

    // Always prefer live fetch using SDK connectors/adapters (connector-first).
    // We no longer fall back to local fixtures; fixtures should not be used at
    // runtime to ensure authenticity. If live fetch fails, we optionally
    // proxy to a remote SDK if configured.
    async function tryLiveFetch(lmsName, courseId) {
      const moduleMap = {
        'canvas': 'canvas',
        'edx': 'edx',
        'moodle': 'moodle',
        'google-classroom': 'googleClassroom',
        'googleclassroom': 'googleClassroom'
      };
      const mod = moduleMap[lmsName] || lmsName;

      // helper to pascal-case module for function name heuristics
      function pascal(s) {
        return s.replace(/(^|[-_])(\w)/g, (_, __, ch) => ch.toUpperCase());
      }

      const distConnectorPath = path.join(__dirname, '..', 'dist', 'src', 'connectors', `${mod}.js`);
      const distAdapterPath = path.join(__dirname, '..', 'dist', 'src', 'adapters', `${mod}.js`);

      let connector = null;
      let adapter = null;

      // Try cached connector first
      try {
        if (connectorCache.has(mod)) {
          const c = connectorCache.get(mod);
          connector = c.connector || null;
          adapter = c.adapter || null;
        }
      } catch (e) { /* ignore */ }

      // If no cache, load once and store
      if (!connector) {
        try { if (fs.existsSync(distConnectorPath)) connector = require(distConnectorPath); } catch (e) { connector = null }
        try { if (!connector) connector = require(path.join(__dirname, '..', 'src', 'connectors', `${mod}.js`)); } catch (e) { connector = connector || null }
      }
      if (!adapter) {
        try { if (fs.existsSync(distAdapterPath)) adapter = require(distAdapterPath); } catch (e) { adapter = null }
        try { if (!adapter) adapter = require(path.join(__dirname, '..', 'src', 'adapters', `${mod}.js`)); } catch (e) { adapter = adapter || null }
      }

      if (!connector && !adapter) return null;

      // Cache what we found (even nulls) to avoid repeated filesystem hits
      try { connectorCache.set(mod, { connector, adapter }); } catch (e) { /* ignore */ }

      if (!connector && !adapter) return null;

      // Resolve connector function
      const pascalName = pascal(mod);
      const connectorCandidates = [
        `fetch${pascalName}Course`,
        `fetch${pascalName}`,
        'default'
      ];
      const adapterCandidates = [
        `normalize${pascalName}`,
        'default'
      ];

      let connectorFn = null;
      for (const c of connectorCandidates) {
        if (connector && connector[c]) { connectorFn = connector[c]; break }
      }
      if (!connectorFn && connector && typeof connector === 'function') connectorFn = connector;

      let adapterFn = null;
      for (const a of adapterCandidates) {
        if (adapter && adapter[a]) { adapterFn = adapter[a]; break }
      }
      if (!adapterFn && adapter && typeof adapter === 'function') adapterFn = adapter;

      // If we have an adapter but no connector, we can't fetch live raw data here
      if (!connectorFn || !adapterFn) return null;

      try {
        // call connector then adapter
        if (process.env.LTSDK_DEBUG === 'true') {
          console.log('[LTSDK] invoking connector function:', connectorFn.name || '<anonymous>')
        }
        const raw = await Promise.resolve(connectorFn(courseId));
        if (process.env.LTSDK_DEBUG === 'true') {
          console.log('[LTSDK] connector returned raw data keys:', raw && typeof raw === 'object' ? Object.keys(raw).slice(0,20) : typeof raw)
        }
        const normalized = await Promise.resolve(adapterFn(raw));
        return normalized;
      } catch (e) {
        // Log error details when debugging so developers can triage quickly
        if (process.env.LTSDK_DEBUG === 'true') {
          try { console.error('[LTSDK] connector/adapter invocation error:', e && (e.stack || e.message || String(e))) } catch (ee) { console.error('[LTSDK] error logging failed', String(ee)) }
        }
        // swallow and return null so proxy/404 behavior can continue
        return null;
      }
    }

    try {
      const live = await tryLiveFetch(lms, courseId);
      if (live) {
        // When debugging, print the complete normalized payload to the server terminal
        if (process.env.LTSDK_DEBUG === 'true') {
          try {
            console.log('LTSDK live normalized payload for', `${lms}/${courseId}:`, JSON.stringify(live, null, 2))
          } catch (e) {
            // fallback to a simple log if payload isn't serializable for any reason
            console.log('LTSDK live normalized payload (non-serializable) for', `${lms}/${courseId}`)
          }
        }
        cache.set(cacheKey, { ts: nowSec(), payload: live });
        return sendJson(res, { source: 'live', ...live });
      }
    } catch (e) {
      // ignore and proceed to proxy/404
    }

    // Optionally proxy to remote SDK server if configured
    if (REMOTE_SDK) {
      try {
        const text = await proxyFetch(REMOTE_SDK, lms, courseId);
        const payload = JSON.parse(text);
        cache.set(cacheKey, { ts: nowSec(), payload });
        return sendJson(res, { source: 'remote', ...payload });
      } catch (err) {
        return sendJson(res, { error: 'Remote fetch failed', details: String(err) }, 502);
      }
    }
    return sendJson(res, { error: 'Live fetch failed', message: `Could not fetch live data for ${lms}/${courseId}` }, 502);
  }

  // List / search courses: GET /api/:lms/courses?search=...
  if (parts.length === 3 && parts[0] === 'api' && parts[2] === 'courses') {
    const lms = parts[1];
    const q = (parsed.query && (parsed.query.search || parsed.query.q || parsed.query.query)) || '';
    const fresh = parsed.query && (parsed.query.fresh === 'true' || parsed.query.fresh === '1');

    // Listing/search is not supported without fixtures. To discover courses,
      // Try to call a connector-provided list/search function (connector-first).
      async function tryLiveSearch(lmsName, query) {
        const moduleMap = {
          'canvas': 'canvas',
          'edx': 'edx',
          'moodle': 'moodle',
          'google-classroom': 'googleClassroom',
          'googleclassroom': 'googleClassroom'
        };
        const mod = moduleMap[lmsName] || lmsName;
        const distConnectorPath = path.join(__dirname, '..', 'dist', 'src', 'connectors', `${mod}.js`);

        let connector = null;
        // reuse cached connector if available to avoid repeated filesystem requires
        try {
          if (connectorCache.has(mod)) {
            const cached = connectorCache.get(mod);
            connector = cached.connector || null;
          }
        } catch (e) { /* ignore */ }
        if (!connector) {
          try { if (fs.existsSync(distConnectorPath)) connector = require(distConnectorPath) } catch (e) { connector = null }
          if (!connector) {
            try { connector = require(path.join(__dirname, '..', 'src', 'connectors', `${mod}.js`)) } catch (e) { connector = null }
          }
          try { connectorCache.set(mod, { connector }); } catch (e) { /* ignore */ }
        }
        if (!connector) return null;

        function pascal(s) { return s.replace(/(^|[-_])(\w)/g, (_, __, ch) => ch.toUpperCase()) }
        const pascalName = pascal(mod);
        const candidates = [`list${pascalName}Courses`, `list${pascalName}`, 'listCourses', 'searchCourses', 'list'];
        for (const name of candidates) {
            try {
            const fn = connector[name] || connector[name.charAt(0).toLowerCase() + name.slice(1)] || (connector.default && connector.default[name]);
            if (typeof fn === 'function') {
              const results = await Promise.resolve(fn(query));
              return results;
            }
          } catch (e) {
            // ignore and try next
          }
        }
        return null;
      }

    try {
      const results = await tryLiveSearch(lms, q);
      if (results) {
        const out = Array.isArray(results) ? results : [results];
        return sendJson(res, { source: 'live-index', results: out });
      }
    } catch (e) {
        // ignore and fall through to proxy
      }

      // Optionally proxy to remote SDK server if configured
      if (REMOTE_SDK) {
        try {
          const text = await proxyFetch(REMOTE_SDK, lms, `?search=${encodeURIComponent(q)}`);
          const payload = JSON.parse(text);
          return sendJson(res, { source: 'remote', results: payload.results || [] });
        } catch (err) {
          return sendJson(res, { error: 'Remote fetch failed', details: String(err) }, 502);
        }
      }

      return sendJson(res, { error: 'Index not supported', message: 'No live search available for this LMS' }, 501);
  }

  // Health and index
  if (parsed.pathname === '/' || parsed.pathname === '/health') {
    return sendJson(res, { status: 'ok', mode: 'live-only', remoteSdk: REMOTE_SDK || null });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  if (process.env.LTSDK_DEBUG === 'true') {
    console.log(`ltsdk local server listening on http://localhost:${PORT}`);
    console.log('Operating in live-first mode: will invoke connectors/adapters for each request');
    if (REMOTE_SDK) console.log(`Proxying misses to ${REMOTE_SDK}`);
  }
});
