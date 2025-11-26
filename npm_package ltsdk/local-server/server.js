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
  // When credentials are enabled, we must NOT return '*'. Echo the request
  // Origin header (dev-only) so the browser accepts credentialed responses.
  const envAllowOrigin = process.env.LTSDK_ALLOW_ORIGIN || '*';
  const reqOrigin = req.headers && req.headers.origin;
  let allowOrigin = envAllowOrigin;
  // Allow credentialed requests when explicitly enabled or when the
  // incoming request contains cookies (dev-friendly behavior).
  const allowCredentials = (process.env.LTSDK_ALLOW_CREDENTIALS === 'true') || !!(req.headers && req.headers.cookie);
  if (allowCredentials) {
    // Prefer echoing the incoming Origin when credentials are allowed.
    // Browsers reject '*' when credentials are included, so echo the origin.
    allowOrigin = reqOrigin || envAllowOrigin;
  }
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (allowCredentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  // Handle simple OPTIONS preflight responses centrally
  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    // Minimal response for preflight - headers are already written
    res.writeHead(204);
    res.end();
    return;
  }
  // Simple runtime config endpoints for dev: GET/POST /api/config
  if (parsed.pathname === '/api/config' || parsed.pathname === '/api/config/') {
    if (String(req.method || '').toUpperCase() === 'GET') {
      const lms = parsed.query && parsed.query.lms;
      try {
        const cfgPath = path.join(__dirname, 'configs.json');
        if (!fs.existsSync(cfgPath)) return sendJson(res, { configs: {} });
        const raw = fs.readFileSync(cfgPath, 'utf8');
        const all = raw ? JSON.parse(raw) : {};
        if (lms) return sendJson(res, { lms: lms, config: all[lms] || null });
        return sendJson(res, { configs: all });
      } catch (e) {
        return sendJson(res, { error: 'could not read configs', details: String(e) }, 500);
      }
    }
    if (String(req.method || '').toUpperCase() === 'POST') {
      // collect body
      let body = '';
      req.on('data', (chunk) => body += chunk.toString());
      req.on('end', () => {
        try {
          const obj = body ? JSON.parse(body) : null;
          if (!obj || !obj.lms || !obj.credentials) return sendJson(res, { error: 'invalid payload, require { lms, credentials }' }, 400);
          const cfgPath = path.join(__dirname, 'configs.json');
          let all = {};
          try { if (fs.existsSync(cfgPath)) all = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}') } catch (e) { all = {} }
          all[obj.lms] = obj.credentials;
          fs.writeFileSync(cfgPath, JSON.stringify(all, null, 2), { encoding: 'utf8' });
          return sendJson(res, { ok: true, lms: obj.lms, saved: all[obj.lms] });
        } catch (e) { return sendJson(res, { error: 'invalid json', details: String(e) }, 400); }
      });
      return;
    }
    return sendJson(res, { error: 'method not allowed' }, 405);
  }
  // NOTE: dev-only internal endpoints removed for cleanup. Use explicit
  // debugging (LTSDK_DEBUG / LTSDK_DEBUG_VERBOSE) and the auth server
  // token endpoint for runtime credential inspection instead of exposing
  // internal HTTP endpoints here.
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
        // Attempt to fetch runtime creds so connectors can use authenticated calls
        async function fetchRuntimeCredsForFetch() {
          try {
            const authPort = process.env.LTSDK_AUTH_PORT || 5002;
            const client = require('http');
            const pathStr = `/auth/lms/${encodeURIComponent(lmsName)}/token`;
            const opts = { hostname: 'localhost', port: authPort, path: pathStr, method: 'GET', headers: {} };
            if (req.headers && req.headers.cookie) opts.headers.Cookie = req.headers.cookie;
            return await new Promise((resolve) => {
              const r = client.request(opts, (resp) => {
                let data = '';
                resp.setEncoding('utf8');
                resp.on('data', (c) => data += c);
                resp.on('end', () => {
                  try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
                });
              });
              r.on('error', () => resolve(null));
              r.end();
            });
          } catch (e) { return null; }
        }

        const runtimeResp = await fetchRuntimeCredsForFetch();
        const runtimeCreds = (function (r) {
          if (!r) return null;
          const baseUrl = (r.credentials && r.credentials.baseUrl) || r.baseUrl || undefined;
          const accessToken = (r.token && (r.token.access_token || r.token.accessToken)) || r.accessToken || r.access_token || undefined;
          const out = {};
          if (baseUrl) out.baseUrl = baseUrl;
          if (accessToken) out.accessToken = accessToken;
          return Object.keys(out).length ? out : null;
        })(runtimeResp);

        // call connector then adapter
        if (process.env.LTSDK_DEBUG === 'true') {
          console.log('[LTSDK] invoking connector function:', connectorFn.name || '<anonymous>')
        }
        const raw = await Promise.resolve(connectorFn(courseId, runtimeCreds));
        if (process.env.LTSDK_DEBUG === 'true') {
          console.log('[LTSDK] connector returned raw data keys:', raw && typeof raw === 'object' ? Object.keys(raw).slice(0, 20) : typeof raw)
          try {
            // Print a concise preview (first 1KB) of the raw payload to help
            // triage missing fields and permission issues without flooding logs.
            const preview = (typeof raw === 'object') ? JSON.stringify(raw, Object.keys(raw).slice(0, 20), 2).slice(0, 1024) : String(raw)
            console.log('[LTSDK] raw preview (first 1KB):', preview)
          } catch (pe) { /* ignore preview errors */ }
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
        // When debugging, print a concise notice. Full JSON dumps are gated
        // behind LTSDK_DEBUG_VERBOSE to avoid flooding terminals.
        if (process.env.LTSDK_DEBUG === 'true') {
          try {
            if (process.env.LTSDK_DEBUG_VERBOSE === 'true') {
              console.log('LTSDK live normalized payload for', `${lms}/${courseId}:`, JSON.stringify(live, null, 2));
            }
            else {
              console.log('LTSDK live normalized payload available for', `${lms}/${courseId}`, '(set LTSDK_DEBUG_VERBOSE=true to print full payload)');
            }
          } catch (e) {
            console.log('LTSDK live normalized payload (non-serializable) for', `${lms}/${courseId}`);
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

      // Fetch runtime creds from auth server (if session hints present)
      async function fetchCredsFromAuth() {
        try {
          const authPort = process.env.LTSDK_AUTH_PORT || 5002;
          const client = require('http');
          // Use the token endpoint to obtain the runtime token object
          const pathStr = `/auth/lms/${encodeURIComponent(lmsName)}/token`;
          const opts = { hostname: 'localhost', port: authPort, path: pathStr, method: 'GET', headers: {} };
          if (req.headers && req.headers.cookie) opts.headers.Cookie = req.headers.cookie;
          return await new Promise((resolve) => {
            const r = client.request(opts, (resp) => {
              let data = '';
              resp.setEncoding('utf8');
              resp.on('data', (c) => data += c);
              resp.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
              });
            });
            r.on('error', () => resolve(null));
            r.end();
          });
        } catch (e) { return null; }
      }

      let runtimeCredsResp = null;
      try { runtimeCredsResp = await fetchCredsFromAuth(); } catch (e) { runtimeCredsResp = null }
      const normalizedCreds = (function (r) {
        if (!r) return null;
        const baseUrl = (r.credentials && r.credentials.baseUrl) || r.baseUrl || undefined;
        const accessToken = (r.token && (r.token.access_token || r.token.accessToken)) || r.accessToken || r.access_token || undefined;
        const out = {};
        if (baseUrl) out.baseUrl = baseUrl;
        if (accessToken) out.accessToken = accessToken;
        return Object.keys(out).length ? out : null;
      })(runtimeCredsResp);

      if (process.env.LTSDK_DEBUG === 'true') {
        try {
          console.log('[LTSDK] tryLiveSearch normalizedCreds for', lmsName, ':', JSON.stringify(normalizedCreds));
        } catch (e) { console.log('[LTSDK] tryLiveSearch normalizedCreds (non-serializable)') }
      }

      for (const name of candidates) {
        try {
          const fn = connector[name] || connector[name.charAt(0).toLowerCase() + name.slice(1)] || (connector.default && connector.default[name]);
          if (typeof fn === 'function') {
            // call and log first successful endpoint body when debugging
            const results = await Promise.resolve(fn(query, 25, normalizedCreds));
            if (process.env.LTSDK_DEBUG === 'true') {
              try { console.log('[LTSDK] tryLiveSearch connector result count:', Array.isArray(results) ? results.length : (results ? 1 : 0)); } catch (e) { }
            }
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

  // Logging endpoint for Learning Tokens backend data
  if (parsed.pathname === '/api/log' && String(req.method || '').toUpperCase() === 'POST') {
    let body = '';
    req.on('data', (chunk) => body += chunk.toString());
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : null;
        if (data && data.course) {
          console.log('\n' + '='.repeat(80));
          console.log('📤 Normalized Course Data Being Sent to Learning Tokens Backend');
          console.log('='.repeat(80));
          console.log('Course ID:', data.course.id || 'N/A');
          console.log('Course Name:', data.course.name || 'N/A');
          console.log('Instructors:', data.instructors ? data.instructors.length : 0);
          console.log('Learners:', data.learners ? data.learners.length : 0);
          console.log('\nFull Normalized JSON:');
          console.log(JSON.stringify(data, null, 2));
          console.log('='.repeat(80) + '\n');
        }
        return sendJson(res, { ok: true, logged: true });
      } catch (e) {
        return sendJson(res, { error: 'Invalid JSON', details: String(e) }, 400);
      }
    });
    return;
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
