#!/usr/bin/env node
// Separate Auth & Configuration Server
// Provides university listing, LTSDK key validation, auth status, and LMS credential persistence.
// Intentionally isolated from main local development server.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.LTSDK_AUTH_PORT || 5002;
const CONFIG_PATH = path.join(__dirname, '..', 'config.auth.json');
const KEYS_PATH = path.join(__dirname, 'keys.json');

let state = {
  university: null,
  ltsdkKey: null,
  userId: null,
  lms: {},
  sessions: {}
};

// Temporary pending OAuth flows keyed by state -> { lms, clientId, clientSecret, redirectUri, createdAt }
const pendingAuths = {};

let validKeys = [];

function loadState() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      state = { university: null, ltsdkKey: null, userId: null, lms: {}, ...parsed };
      if (!state.lms) state.lms = {};
    }
  } catch (e) {
    console.error('[auth-server] loadState error:', e.message);
  }
}

function loadKeys() {
  try {
    if (fs.existsSync(KEYS_PATH)) {
      const raw = fs.readFileSync(KEYS_PATH, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      validKeys = parsed.validKeys || [];
      console.log(`[auth-server] Loaded ${validKeys.length} valid LTSDK keys`);
    } else {
      console.warn('[auth-server] keys.json not found - no valid keys loaded');
    }
  } catch (e) {
    console.error('[auth-server] loadKeys error:', e.message);
    validKeys = [];
  }
}

function saveState() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[auth-server] saveState error:', e.message);
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (_) { resolve({}); }
    });
  });
}

// Helper to POST x-www-form-urlencoded using native http/https (top-level)
function postForm(urlStr, params) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr)
      const isHttps = u.protocol === 'https:'
      const bodyStr = new URLSearchParams(params).toString()
      const lib = isHttps ? require('https') : require('http')
      const opts = {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      }
      if (process.env.LTSDK_DEBUG === 'true') {
        try { console.debug('[auth-server] POST', urlStr, '(x-www-form-urlencoded)') } catch (e) { }
      }
      const r = lib.request(opts, (resp) => {
        let data = ''
        resp.setEncoding('utf8')
        resp.on('data', (c) => data += c)
        resp.on('end', () => {
          let parsed = null
          try { parsed = data ? JSON.parse(data) : null } catch (e) { parsed = data }
          if (resp.statusCode >= 200 && resp.statusCode < 300) return resolve({ status: resp.statusCode, data: parsed })
          return reject({ status: resp.statusCode, data: parsed })
        })
      })
      r.on('error', reject)
      r.write(bodyStr)
      r.end()
    } catch (e) { reject(e) }
  })
}

const UNIVERSITIES = [
  { id: 'stanford', name: 'Stanford University' },
  { id: 'mit', name: 'Massachusetts Institute of Technology' },
  { id: 'harvard', name: 'Harvard University' },
  { id: 'berkeley', name: 'UC Berkeley' },
  { id: 'oxford', name: 'University of Oxford' }
];

// Build CORS headers for a request (echo Origin when present so credentials can be used)
function getCorsHeaders(req, extra = {}) {
  const originHeader = (req && req.headers && req.headers.origin) ? req.headers.origin : (process.env.LTSDK_AUTH_ALLOW_ORIGIN || '*');
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...extra
  };
}

function sendJson(req, res, obj, status = 200, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  const headers = getCorsHeaders(req, { 'Content-Length': Buffer.byteLength(body), ...extraHeaders });
  res.writeHead(status, headers);
  res.end(body);
}

// ============================================================================
// Unified Helper Functions for LMS Authentication
// ============================================================================

/**
 * Makes an HTTP/HTTPS request with unified error handling
 * @param {string} url - Full URL to request
 * @param {Object} options - Request options (method, headers, body)
 * @returns {Promise<Object>} Response object with status, data, and raw response
 */
async function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? require('https') : require('http');
      const opts = {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: options.method || 'GET',
        headers: options.headers || {}
      };
      if (process.env.LTSDK_DEBUG === 'true') {
        console.debug(`[auth-server] ${opts.method} ${url}`);
      }
      const r = lib.request(opts, (resp) => {
        let data = '';
        resp.setEncoding('utf8');
        resp.on('data', (c) => data += c);
        resp.on('end', () => {
          let parsed = null;
          try { parsed = data ? JSON.parse(data) : null; } catch (e) { parsed = data; }
          resolve({ status: resp.statusCode, data: parsed, raw: data });
        });
      });
      r.on('error', reject);
      if (options.body) r.write(options.body);
      r.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Validates an access token by making a test API call to the LMS
 * @param {string} lms - LMS name
 * @param {string} baseUrl - Base URL of the LMS
 * @param {string} token - Access token to validate
 * @param {Object} config - Optional config (testUrl, custom headers)
 * @returns {Promise<Object>} { valid: boolean, error?: Object }
 */
async function validateToken(lms, baseUrl, token, config = {}) {
  try {
    let testUrl = config.testUrl;
    let headers = config.headers || {};

    // Build test URL if not provided
    if (!testUrl) {
      if (lms === 'canvas') {
        const testBase = baseUrl.replace(/(\/api\/v1)$/i, '') + '/api/v1';
        testUrl = `${testBase.replace(/\/$/, '')}/courses?per_page=1`;
        headers['Authorization'] = `Bearer ${token}`;
      } else if (lms === 'moodle') {
        testUrl = `${baseUrl.replace(/\/$/, '')}/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&moodlewsrestformat=json&wstoken=${encodeURIComponent(token)}`;
      } else if (lms === 'edx') {
        testUrl = `${baseUrl}/api/courses/v1/courses/?page_size=1`;
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        return { valid: false, error: { message: `No validation method for LMS: ${lms}` } };
      }
    }

    const response = await makeHttpRequest(testUrl, { method: 'GET', headers });

    // Check status code
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: { status: response.status, data: response.data } };
    }

    // LMS-specific validation
    if (lms === 'moodle' && response.data && response.data.error && response.data.errorcode) {
      return { valid: false, error: { status: 401, data: response.data } };
    }

    return { valid: true, response };
  } catch (err) {
    return { valid: false, error: err };
  }
}

/**
 * Extracts and normalizes credentials from input, applying defaults
 * @param {Object} credentials - Raw credentials object
 * @param {string} lms - LMS name
 * @returns {Object} Normalized credentials object
 */
function extractCredentials(credentials, lms) {
  const normalized = {};

  // Base URL extraction with defaults
  const baseUrlDefaults = {
    canvas: process.env.CANVAS_API_BASE || 'https://canvas.instructure.com',
    edx: process.env.EDX_BASE_URL || process.env.BASE_URL || '',
    moodle: process.env.MOODLE_URL || 'http://localhost:8888/moodle500'
  };

  normalized.baseUrl = (credentials.baseUrl || credentials.base_url || baseUrlDefaults[lms] || '')
    .replace(/\/$/, '');

  // Token extraction (multiple aliases supported)
  normalized.token = credentials.accessToken || credentials.token ||
    credentials.apiToken || credentials.api_token || null;

  // OAuth credentials
  normalized.clientId = credentials.clientId || credentials.client_id || null;
  normalized.clientSecret = credentials.clientSecret || credentials.client_secret || null;

  // User credentials
  normalized.username = credentials.username || null;
  normalized.password = credentials.password || null;

  // OAuth redirect URI
  normalized.redirectUri = credentials.redirectUri || credentials.redirect_uri || null;

  return normalized;
}

// ============================================================================
// Token Acquisition Strategies
// ============================================================================

/**
 * Strategy 1: Direct Token - Token is already the access token
 * Used by: Canvas, Moodle, edX (Path A)
 * @param {string} lms - LMS name
 * @param {Object} credentials - Normalized credentials
 * @returns {Promise<Object>} { access_token, refresh_token?, expires_in? }
 */
async function acquireTokenDirect(lms, credentials) {
  const token = credentials.token || credentials.accessToken;
  if (!token) {
    throw new Error(`${lms} requires an access token (accessToken, token, or apiToken)`);
  }

  return {
    access_token: token,
    refresh_token: null,
    expires_in: null
  };
}

/**
 * Strategy 2: Password Grant OAuth - Exchange username/password for token
 * Used by: edX (Path B)
 * @param {string} lms - LMS name
 * @param {Object} credentials - Normalized credentials
 * @returns {Promise<Object>} { access_token, refresh_token?, expires_in? }
 */
async function acquireTokenPasswordGrant(lms, credentials) {
  const { baseUrl, clientId, clientSecret, username, password } = credentials;

  if (!baseUrl || !clientId || !clientSecret || !username || !password) {
    throw new Error(`${lms} password grant requires baseUrl, clientId, clientSecret, username, and password`);
  }

  const tokenEndpoint = `${baseUrl}/oauth2/access_token/`;
  if (process.env.LTSDK_DEBUG === 'true') {
    console.debug(`[auth-server] attempting password-grant token exchange for ${lms} at`, tokenEndpoint, 'clientId=', clientId, 'username=', username);
  }

  const result = await postForm(tokenEndpoint, {
    grant_type: 'password',
    username: username,
    password: password,
    client_id: clientId,
    client_secret: clientSecret
  });

  if (!result || !result.data || !result.data.access_token) {
    throw new Error('Token exchange did not return an access_token');
  }

  if (process.env.LTSDK_DEBUG === 'true') {
    console.debug(`[auth-server] password-grant exchange succeeded for ${lms}`, 'expires_in=', result.data.expires_in);
  }

  return {
    access_token: result.data.access_token,
    refresh_token: result.data.refresh_token || null,
    expires_in: result.data.expires_in || null
  };
}

/**
 * Unified Token Acquisition Router
 * Routes to appropriate strategy based on LMS and available credentials
 * @param {string} lms - LMS name
 * @param {Object} credentials - Normalized credentials
 * @returns {Promise<Object>} { access_token, refresh_token?, expires_in? }
 */
async function acquireToken(lms, credentials) {
  const lmsLower = String(lms).toLowerCase();

  // Canvas: Direct token
  if (lmsLower === 'canvas') {
    return acquireTokenDirect('canvas', credentials);
  }

  // Moodle: Direct token
  if (lmsLower === 'moodle') {
    return acquireTokenDirect('moodle', credentials);
  }

  // edX: Direct token OR OAuth (password grant removed - OAuth is preferred)
  if (lmsLower === 'edx') {
    // Path A: Direct token provided
    if (credentials.token || credentials.accessToken) {
      return acquireTokenDirect('edx', credentials);
    }
    // Path B: OAuth flow (handled separately - returns oauthUrl, not token)
    throw new Error('edX requires either accessToken or OAuth flow (clientId+clientSecret+redirectUri)');
  }

  // Google Classroom: OAuth (handled separately - returns oauthUrl, not token)
  if (lmsLower === 'google-classroom' || lmsLower === 'googleclassroom') {
    throw new Error('Google Classroom uses OAuth flow - use initiateOAuth() first');
  }

  throw new Error(`Unsupported LMS: ${lms}`);
}

/**
 * Creates a successful authentication response with session and cookie
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 * @param {string} lms - LMS name
 * @param {Object} credentials - Credentials to persist
 * @param {Object} tokenResult - Token object from acquireToken
 * @param {Function} createSessionFn - Function to create a session
 * @param {Object} extraResponseData - Additional data to include in response
 * @returns {void} Sends response and returns
 */
function respondWithAuthSuccess(req, res, lms, credentials, tokenResult, createSessionFn, extraResponseData = {}) {
  // Prepare credentials for storage (exclude password for security)
  const credentialsToStore = { ...credentials };
  delete credentialsToStore.password;

  // Persist credentials and token
  state.lms[lms] = {
    credentials: credentialsToStore,
    token: {
      access_token: tokenResult.access_token,
      refresh_token: tokenResult.refresh_token || null,
      expires_in: tokenResult.expires_in || null
    },
    obtainedAt: Date.now()
  };
  saveState();

  // Create session and set cookie (24 hours to match session expiry)
  const sess = createSessionFn({ userId: state.userId, allowedLms: lms });
  const cookieValue = `ltsdk_session=${encodeURIComponent(sess.id)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24}`;
  res.setHeader('Set-Cookie', cookieValue);

  // Build response
  const responseData = {
    success: true,
    authenticated: true,
    sessionId: sess.id,
    ...extraResponseData
  };

  // Include token info if available
  if (tokenResult && tokenResult.access_token) {
    responseData.token = {
      access_token: tokenResult.access_token,
      refresh_token: tokenResult.refresh_token || null
    };
  }

  return sendJson(req, res, responseData);
}

loadState();
loadKeys();

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    // respond to preflight with CORS headers that echo the request origin when present
    const headers = getCorsHeaders(req);
    // remove Content-Type/Length for OPTIONS response body-less reply
    delete headers['Content-Type'];
    delete headers['Content-Length'];
    res.writeHead(204, headers);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname;
  // Accept both /api/google/callback (what the UI registers) and /auth/google/callback
  // (internal handler). Normalize to /auth/google/callback so the existing handler
  // code works without duplicatingh logic.
  if (pathname === '/api/google/callback') {
    try { console.log('[auth-server] Normalizing incoming callback path /api/google/callback -> /auth/google/callback') } catch (e) { }
    pathname = '/auth/google/callback';
  }
  // Also normalize edX callback paths
  if (pathname === '/api/edx/callback') {
    try { console.log('[auth-server] Normalizing incoming callback path /api/edx/callback -> /auth/edx/callback') } catch (e) { }
    pathname = '/auth/edx/callback';
  }
  const parts = pathname.split('/').filter(Boolean);

  // Helper: parse cookies from request
  function parseCookies(req) {
    const header = req.headers && req.headers.cookie;
    const out = {};
    if (!header) return out;
    header.split(';').forEach(part => {
      const idx = part.indexOf('=');
      if (idx < 0) return;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    });
    return out;
  }

  // Helper: create a session and persist it
  function createSession(sessionObj) {
    const crypto = require('crypto');
    const id = `s_${crypto.randomBytes(12).toString('hex')}`;
    const now = Date.now();
    const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    const entry = {
      id,
      ...sessionObj,
      createdAt: now,
      lastActive: now,
      expiresAt: now + SESSION_EXPIRY_MS
    };
    state.sessions = state.sessions || {};
    state.sessions[id] = entry;
    saveState();
    return entry;
  }

  // Helper: check if session is expired
  function isSessionExpired(session) {
    if (!session || !session.expiresAt) return true;
    return Date.now() >= session.expiresAt;
  }

  // Helper: cleanup expired sessions
  function cleanupExpiredSessions() {
    if (!state.sessions) return;
    const now = Date.now();
    let cleaned = false;
    for (const [id, session] of Object.entries(state.sessions)) {
      if (session.expiresAt && now >= session.expiresAt) {
        delete state.sessions[id];
        cleaned = true;
      }
    }
    if (cleaned) saveState();
  }

  // Helper: clear session by id
  function clearSession(id) {
    if (!id) return;
    state.sessions = state.sessions || {};
    delete state.sessions[id];
    saveState();
  }

  // Helper: lookup session from request cookie
  function sessionFromRequest(req) {
    // Cleanup expired sessions periodically (every request, but lightweight check)
    cleanupExpiredSessions();

    const cookies = parseCookies(req);
    let sid = cookies.ltsdk_session;
    // Dev/testing fallback: accept X-LTSDK-SESSION header when cookie isn't present
    if (!sid && req && req.headers) {
      const alt = req.headers['x-ltsdk-session'] || req.headers['x-ltsdk_session'];
      if (alt && typeof alt === 'string' && alt.trim()) sid = alt.trim();
    }
    if (!sid) return null;
    state.sessions = state.sessions || {};
    const s = state.sessions[sid];
    if (!s) return null;

    // Check if session is expired
    if (isSessionExpired(s)) {
      delete state.sessions[sid];
      saveState();
      return null;
    }

    // Check if session is expired
    if (isSessionExpired(s)) {
      delete state.sessions[sid];
      saveState();
      return null;
    }

    s.lastActive = Date.now();
    saveState();
    return s;
  }

  // GET /auth/universities
  if (pathname === '/auth/universities' && req.method === 'GET') {
    return sendJson(req, res, { universities: UNIVERSITIES });
  }

  // POST /auth/validate { university, key }
  if (pathname === '/auth/validate' && req.method === 'POST') {
    const body = await readBody(req);
    const { university, key } = body;

    if (!university || !key) {
      return sendJson(req, res, { error: 'University and key required' }, 400);
    }

    const trimmedKey = String(key).trim();

    // Validate key format (basic check)
    if (trimmedKey.length < 8) {
      return sendJson(req, res, { error: 'Invalid key format. Key must be at least 8 characters.' }, 422);
    }

    // Check if key exists in valid keys list
    const matchedKey = validKeys.find(k =>
      k.key === trimmedKey &&
      k.status === 'active'
    );

    if (!matchedKey) {
      return sendJson(req, res, {
        error: 'Invalid LTSDK access key. Please check your key and try again.',
        valid: false
      }, 401);
    }

    // Optional: Check if university matches the key's assigned university
    if (matchedKey.university && matchedKey.university !== university) {
      return sendJson(req, res, {
        error: `This key is issued for ${matchedKey.university}, but you selected ${university}. Please use the correct university.`,
        valid: false
      }, 403);
    }

    // Key is valid - store auth info
    state.university = university;
    state.ltsdkKey = trimmedKey;
    state.userId = state.userId || `user_${Date.now()}`;
    saveState();

    return sendJson(req, res, {
      valid: true,
      university: state.university,
      userId: state.userId
    });
  }

  // GET /auth/status
  if (pathname === '/auth/status' && req.method === 'GET') {
    return sendJson(req, res, {
      authenticated: !!state.ltsdkKey,
      university: state.university,
      userId: state.userId
    });
  }

  // POST /auth/login { lms, username, password }
  if (pathname === '/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const { lms, username, password } = body || {};
    if (!lms || !username || !password) return sendJson(req, res, { error: 'lms, username and password required' }, 400);
    const entry = state.lms[lms];
    if (!entry || !entry.credentials) return sendJson(req, res, { error: 'No stored credentials for this LMS' }, 404);
    const stored = entry.credentials;
    // For dev-mode we stored password on initial save (INSECURE). Compare directly.
    if (String(stored.username) === String(username) && String(stored.password) === String(password)) {
      const sess = createSession({ userId: state.userId, allowedLms: lms });
      res.setHeader('Set-Cookie', `ltsdk_session=${encodeURIComponent(sess.id)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24}`)
      return sendJson(req, res, { success: true, sessionId: sess.id })
    }
    return sendJson(req, res, { error: 'Invalid username/password' }, 401)
  }

  // POST /auth/logout - clear session cookie and server-side session
  if (pathname === '/auth/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    const sid = cookies.ltsdk_session;
    if (sid) clearSession(sid);
    // instruct client to remove cookie
    res.setHeader('Set-Cookie', `ltsdk_session=; HttpOnly; Path=/; Max-Age=0`)
    return sendJson(req, res, { success: true })
  }

  // GET /auth/session - return session info for current cookie
  if (pathname === '/auth/session' && req.method === 'GET') {
    const s = sessionFromRequest(req);
    if (!s) return sendJson(req, res, { authenticated: false }, 401);
    return sendJson(req, res, { authenticated: true, session: s })
  }

  // POST /auth/lms { lms, credentials }
  if (pathname === '/auth/lms' && req.method === 'POST') {
    const body = await readBody(req);
    const { lms, credentials } = body;
    if (!lms || !credentials) return sendJson(req, res, { error: 'lms and credentials required' }, 400);

    const lmsLower = String(lms).toLowerCase();

    // edX OAuth initiation (Authorization Code flow)
    if (lmsLower === 'edx') {
      const creds = credentials || {};
      const normalizedCreds = extractCredentials(creds, 'edx');
      const baseUrl = normalizedCreds.baseUrl;
      const clientId = normalizedCreds.clientId;
      const clientSecret = normalizedCreds.clientSecret;
      // Normalize redirect URI: remove trailing slashes, ensure exact format
      let redirectUri = normalizedCreds.redirectUri || `http://localhost:${PORT}/auth/edx/callback`;
      redirectUri = redirectUri.trim().replace(/\/$/, ''); // Remove trailing slash

      // edX now only supports OAuth flow (password grant removed)
      if (clientId && clientSecret) {
        if (!baseUrl || !clientId || !clientSecret) {
          return sendJson(req, res, { error: 'edX OAuth requires baseUrl, clientId, and clientSecret' }, 422);
        }

        // Create a short-lived pending auth entry and a random state to validate callback
        const crypto = require('crypto');
        const stateToken = `st_${crypto.randomBytes(12).toString('hex')}`;
        pendingAuths[stateToken] = { lms: 'edx', baseUrl, clientId, clientSecret, redirectUri, createdAt: Date.now() };

        // Build OAuth consent URL with state to validate callback
        // edX OAuth scopes (adjust based on your edX instance requirements)
        const scopes = [
          'read',
          'write'
        ];
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scopes.join(' '),
          state: stateToken,
          // Force consent screen to show (even if user previously authorized)
          // Try both 'prompt' (OIDC/OAuth 2.1) and 'approval_prompt' (OAuth 2.0)
          prompt: 'consent',
          approval_prompt: 'force'
        });
        const oauthUrl = `${baseUrl}/oauth2/authorize/?${params.toString()}`;

        // Log the OAuth url and redirectUri to aid debugging
        console.log(`[auth-server] edX OAuth start: redirectUri=${redirectUri} clientId=${clientId} state=${stateToken}`);
        console.log(`[auth-server] edX OAuth start: oauthUrl=${oauthUrl}`);
        console.log(`[auth-server] IMPORTANT: Make sure this exact redirect URI is configured in your edX OAuth client: ${redirectUri}`);

        // Create a temporary session bound to this LMS so that the polling
        // token endpoint will authorize requests during the OAuth roundtrip.
        try {
          const sess = createSession({ userId: state.userId, allowedLms: 'edx' });
          res.setHeader('Set-Cookie', `ltsdk_session=${encodeURIComponent(sess.id)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24}`);
        } catch (e) {
          if (process.env.LTSDK_DEBUG === 'true') console.debug('[auth-server] failed to create temp session for edx', e && e.message ? e.message : String(e));
        }

        return sendJson(req, res, { success: true, oauthUrl, state: stateToken });
      }
      // If no clientId/clientSecret, fall through to unified flow (for direct token)
    }

    // Google Classroom OAuth initiation (special case - returns oauthUrl, not token)
    if (lmsLower === 'google-classroom' || lmsLower === 'googleclassroom') {
      const creds = credentials || {};
      const clientId = creds.clientId || creds.client_id || null;
      const clientSecret = creds.clientSecret || creds.client_secret || null;
      // prefer an explicit redirectUri if provided, otherwise use auth server callback
      const redirectUri = creds.redirectUri || creds.redirect_uri || `http://localhost:${PORT}/auth/google/callback`;

      if (!clientId || !clientSecret) {
        return sendJson(req, res, { error: 'Google Classroom requires clientId and clientSecret' }, 422);
      }

      // Create a short-lived pending auth entry and a random state to validate callback
      const crypto = require('crypto');
      const stateToken = `st_${crypto.randomBytes(12).toString('hex')}`;
      pendingAuths[stateToken] = { lms: 'google-classroom', clientId, clientSecret, redirectUri, createdAt: Date.now() };

      // Build OAuth consent URL with state to validate callback
      const scopes = [
        'https://www.googleapis.com/auth/classroom.courses.readonly',
        'https://www.googleapis.com/auth/classroom.rosters.readonly',
        'https://www.googleapis.com/auth/classroom.coursework.students'
      ];
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: stateToken
      });
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      // Log the OAuth url and redirectUri to aid debugging redirect_uri_mismatch issues
      try {
        console.log(`[auth-server] Google OAuth start: oauthUrl=${oauthUrl}`);
        console.log(`[auth-server] Google OAuth start: redirectUri=${redirectUri} clientId=${clientId} state=${stateToken}`);
      } catch (e) { }

      // Don't persist client creds yet — persist only after a successful token exchange.
      // However, create a temporary session bound to this LMS so that the polling
      // token endpoint will authorize requests during the OAuth roundtrip.
      try {
        const sess = createSession({ userId: state.userId, allowedLms: 'google-classroom' });
        res.setHeader('Set-Cookie', `ltsdk_session=${encodeURIComponent(sess.id)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24}`);
      } catch (e) {
        if (process.env.LTSDK_DEBUG === 'true') console.debug('[auth-server] failed to create temp session for google-classroom', e && e.message ? e.message : String(e));
      }

      return sendJson(req, res, { success: true, oauthUrl, state: stateToken });
    }

    // Unified authentication flow for Canvas, Moodle, and edX
    try {
      // Step 1: Normalize credentials
      const normalizedCreds = extractCredentials(credentials, lmsLower);

      // Step 2: Acquire token using LMS-specific strategy
      const tokenResult = await acquireToken(lmsLower, normalizedCreds);

      // Step 3: Validate token (recommended for all LMS)
      const validation = await validateToken(lmsLower, normalizedCreds.baseUrl, tokenResult.access_token);
      if (!validation.valid) {
        if (process.env.LTSDK_DEBUG === 'true') {
          console.debug(`[auth-server] ${lmsLower} token validation failed`, validation.error);
        }
        const errorMsg = validation.error?.data?.error || validation.error?.message || 'Token validation failed';
        return sendJson(req, res, {
          error: `${lmsLower} token is invalid or rejected`,
          details: errorMsg
        }, 401);
      }

      // Step 4-6: Store, create session, set cookie (unified)
      return respondWithAuthSuccess(req, res, lmsLower, normalizedCreds, tokenResult, createSession);

    } catch (error) {
      if (process.env.LTSDK_DEBUG === 'true') {
        console.debug(`[auth-server] ${lmsLower} authentication error`, error);
      }
      const errorMsg = error.message || String(error);
      const status = error.status || 401;
      return sendJson(req, res, {
        error: `${lmsLower} authentication failed`,
        details: errorMsg
      }, status);
    }

    // Generic fallback: persist credentials without validation
    state.lms[lms] = credentials;
    saveState();
    return sendJson(req, res, { success: true });
  }

  // OAuth callback for Google Classroom
  if (pathname === '/auth/google/callback' && req.method === 'GET') {
    const code = url.searchParams.get('code')
    const stateToken = url.searchParams.get('state')
    try { console.log(`[auth-server] Google callback received: code=${code ? '[REDACTED]' : '<missing>'} state=${stateToken}`) } catch (e) { }
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' })
      return res.end(`<html><body><h3>Google OAuth error</h3><p>Missing authorization code.</p></body></html>`)
    }

    // Validate pending auth by state token first
    const pending = stateToken ? pendingAuths[stateToken] : null
    if (!pending) {
      // No pending entry — reject with an explanatory HTML page
      res.writeHead(400, { 'Content-Type': 'text/html' })
      return res.end(`<html><body><h3>Google OAuth error</h3><p>Invalid or expired OAuth session. Please retry from the SDK setup page.</p></body></html>`)
    }

    const clientId = pending.clientId
    const clientSecret = pending.clientSecret
    const redirectUri = pending.redirectUri || `http://localhost:${PORT}/auth/google/callback`

    try {
      // Exchange code for tokens
      const tokenRes = await postForm('https://oauth2.googleapis.com/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })

      const tokenData = tokenRes && tokenRes.data ? tokenRes.data : null
      if (!tokenData || !tokenData.access_token) {
        // Show an HTML error page
        res.writeHead(500, { 'Content-Type': 'text/html' })
        return res.end(`<html><body><h3>Google OAuth error</h3><p>Token exchange failed. Details: ${JSON.stringify(tokenData || {})}</p></body></html>`)
      }

      // Persist credentials + token now that exchange succeeded
      const entry = { credentials: { clientId, clientSecret, redirectUri }, token: tokenData, obtainedAt: Date.now() }
      state.lms['google-classroom'] = entry
      // Guard saveState to avoid runtime errors; if not available, fallback to writing file
      try {
        if (typeof saveState === 'function') saveState();
        else {
          try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(state, null, 2)); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(state, null, 2)); } catch (ee) { if (process.env.LTSDK_DEBUG === 'true') console.error('[auth-server] failed to persist state', String(ee)); }
      }

      // Attempt to notify local SDK server (dev-only) so it can use the refresh token directly
      (async function notifyLocalServer() {
        try {
          const localPort = process.env.LTSDK_LOCAL_SERVER_PORT || process.env.LTSDK_LOCAL_PORT || 5001;
          const http = require('http');
          const payload = JSON.stringify({ lms: 'google-classroom', credentials: { clientId, clientSecret, refreshToken: tokenData.refresh_token, redirectUri } });
          const opts = { hostname: 'localhost', port: localPort, path: '/api/config', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, timeout: 2000 };
          const r = http.request(opts, (resp) => {
            // drain
            resp.on('data', () => { });
            resp.on('end', () => { });
          });
          r.on('error', (err) => { if (process.env.LTSDK_DEBUG === 'true') console.debug('[auth-server] notifyLocalServer error', String(err)); });
          r.write(payload);
          r.end();
        } catch (e) {
          if (process.env.LTSDK_DEBUG === 'true') console.debug('[auth-server] notifyLocalServer exception', String(e));
        }
      })();

      // Clear pending auth
      try { delete pendingAuths[stateToken] } catch (e) { }

      // Create session and set cookie for dev flow
      const sess = createSession({ userId: state.userId, allowedLms: 'google-classroom' })
      res.setHeader('Set-Cookie', `ltsdk_session=${encodeURIComponent(sess.id)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24}`)

      // Return a small styled HTML page notifying success and posting session id
      try {
        const safeSessId = String(sess.id).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Authorization Complete</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html,body{height:100%;margin:0;font-family:Inter,Arial,Helvetica,sans-serif;background:#f6f9fb}
      .wrap{height:100%;display:flex;align-items:center;justify-content:center}
      .card{max-width:720px;width:100%;padding:28px;border-radius:12px;background:#e6ffed;border:1px solid #c8f6d0;box-shadow:0 6px 20px rgba(12,45,22,0.06);text-align:center}
      .card h1{margin:0 0 8px;font-size:20px;color:#0b6b2d}
      .card p{margin:0;color:#084b2a}
      .note{margin-top:14px;color:#0b6b2d}
      .close-hint{margin-top:18px;color:#2d6b3a;font-size:13px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Google Classroom authorization complete</h1>
        <p class="note">The Learning Tokens SDK has been configured successfully. You may safely close this window.</p>
        <div class="close-hint">If this window does not close automatically, return to the Learning Tokens app.</div>
      </div>
    </div>
    <!-- No opener communication here to avoid Cross-Origin-Opener-Policy warnings. -->
  </body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body><h3>Authorization complete. You may close this window and return to the SDK.</h3></body></html>');
      }
    } catch (err) {
      // Clear pending auth to avoid stale entries
      try { delete pendingAuths[stateToken] } catch (e) { }
      // Render a friendly error page (styled) and postMessage failure to opener if possible
      try {
        const safeMsg = String(err).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Authorization Failed</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html,body{height:100%;margin:0;font-family:Inter,Arial,Helvetica,sans-serif;background:#fff6f6}
      .wrap{height:100%;display:flex;align-items:center;justify-content:center}
      .card{max-width:720px;width:100%;padding:28px;border-radius:12px;background:#ffecec;border:1px solid #ffbcbc;box-shadow:0 6px 20px rgba(80,20,20,0.06);text-align:center}
      .card h1{margin:0 0 8px;font-size:20px;color:#8b1f1f}
      .card p{margin:0;color:#6a1a1a}
      .details{margin-top:12px;color:#4a1515;font-size:13px;word-break:break-word;max-height:120px;overflow:auto}
      .hint{margin-top:16px;color:#6a1a1a;font-size:13px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Authorization failed</h1>
        <p>Unable to complete Google Classroom authorization. Please retry from the SDK setup page.</p>
        <div class="details">${safeMsg}</div>
        <div class="hint">Close this window and return to the Learning Tokens app to try again.</div>
      </div>
    </div>
    <!-- No opener communication here to avoid Cross-Origin-Opener-Policy warnings. -->
  </body>
</html>`;
        res.writeHead(500, { 'Content-Type': 'text/html' });
        return res.end(html);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        return res.end(`<html><body><h3>Google OAuth error</h3><p>Token exchange failed: ${String(err)}</p></body></html>`)
      }
    }
  }

  // OAuth callback for edX
  if (pathname === '/auth/edx/callback' && req.method === 'GET') {
    const code = url.searchParams.get('code');
    const stateToken = url.searchParams.get('state');
    console.log(`[auth-server] edX callback received: code=${code ? '[REDACTED]' : '<missing>'} state=${stateToken}`);
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      return res.end(`<html><body><h3>edX OAuth error</h3><p>Missing authorization code.</p></body></html>`);
    }

    // Validate pending auth by state token first
    const pending = stateToken ? pendingAuths[stateToken] : null;
    if (!pending) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      return res.end(`<html><body><h3>edX OAuth error</h3><p>Invalid or expired OAuth session. Please retry from the SDK setup page.</p></body></html>`);
    }

    const baseUrl = pending.baseUrl;
    const clientId = pending.clientId;
    const clientSecret = pending.clientSecret;
    const redirectUri = pending.redirectUri || `http://localhost:${PORT}/auth/edx/callback`;

    try {
      // Exchange code for tokens
      const tokenEndpoint = `${baseUrl}/oauth2/access_token/`;
      const tokenRes = await postForm(tokenEndpoint, {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      const tokenData = tokenRes && tokenRes.data ? tokenRes.data : null;
      if (!tokenData || !tokenData.access_token) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        return res.end(`<html><body><h3>edX OAuth error</h3><p>Token exchange failed. Details: ${JSON.stringify(tokenData || {})}</p></body></html>`);
      }

      // Persist credentials + token now that exchange succeeded
      const entry = {
        credentials: { baseUrl, clientId, clientSecret, redirectUri },
        token: tokenData,
        obtainedAt: Date.now()
      };
      state.lms['edx'] = entry;
      saveState();

      // Clear pending auth
      try { delete pendingAuths[stateToken]; } catch (e) { }

      // Create session and set cookie
      const sess = createSession({ userId: state.userId, allowedLms: 'edx' });
      res.setHeader('Set-Cookie', `ltsdk_session=${encodeURIComponent(sess.id)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24}`);

      // Return a styled HTML success page
      try {
        const safeSessId = String(sess.id).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Authorization Complete</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html,body{height:100%;margin:0;font-family:Inter,Arial,Helvetica,sans-serif;background:#f6f9fb}
      .wrap{height:100%;display:flex;align-items:center;justify-content:center}
      .card{max-width:720px;width:100%;padding:28px;border-radius:12px;background:#e6ffed;border:1px solid #c8f6d0;box-shadow:0 6px 20px rgba(12,45,22,0.06);text-align:center}
      .card h1{margin:0 0 8px;font-size:20px;color:#0b6b2d}
      .card p{margin:0;color:#084b2a}
      .note{margin-top:14px;color:#0b6b2d}
      .close-hint{margin-top:18px;color:#2d6b3a;font-size:13px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>edX authorization complete</h1>
        <p class="note">The Learning Tokens SDK has been configured successfully. You may safely close this window.</p>
        <div class="close-hint">If this window does not close automatically, return to the Learning Tokens app.</div>
      </div>
    </div>
  </body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body><h3>Authorization complete. You may close this window and return to the SDK.</h3></body></html>');
      }
    } catch (err) {
      // Clear pending auth to avoid stale entries
      try { delete pendingAuths[stateToken]; } catch (e) { }
      // Render a friendly error page
      try {
        const safeMsg = String(err).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Authorization Failed</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html,body{height:100%;margin:0;font-family:Inter,Arial,Helvetica,sans-serif;background:#fff6f6}
      .wrap{height:100%;display:flex;align-items:center;justify-content:center}
      .card{max-width:720px;width:100%;padding:28px;border-radius:12px;background:#ffecec;border:1px solid #ffbcbc;box-shadow:0 6px 20px rgba(80,20,20,0.06);text-align:center}
      .card h1{margin:0 0 8px;font-size:20px;color:#8b1f1f}
      .card p{margin:0;color:#6a1a1a}
      .details{margin-top:12px;color:#4a1515;font-size:13px;word-break:break-word;max-height:120px;overflow:auto}
      .hint{margin-top:16px;color:#6a1a1a;font-size:13px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Authorization failed</h1>
        <p>Unable to complete edX authorization. Please retry from the SDK setup page.</p>
        <div class="details">${safeMsg}</div>
        <div class="hint">Close this window and return to the Learning Tokens app to try again.</div>
      </div>
    </div>
  </body>
</html>`;
        res.writeHead(500, { 'Content-Type': 'text/html' });
        return res.end(html);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        return res.end(`<html><body><h3>edX OAuth error</h3><p>Token exchange failed: ${String(err)}</p></body></html>`);
      }
    }
  }

  // GET /auth/lms/:name - return stored credentials for that LMS (requires session)
  if (parts.length === 3 && parts[0] === 'auth' && parts[1] === 'lms' && req.method === 'GET') {
    const name = parts[2];
    const s = sessionFromRequest(req);
    if (!s) return sendJson(req, res, { error: 'Not authenticated' }, 401);
    if (s.allowedLms !== name) return sendJson(req, res, { error: 'Forbidden for this LMS' }, 403);
    return sendJson(req, res, { lms: name, credentials: state.lms[name] || null });
  }

  // GET /auth/lms/:name/token - return a valid access token (attempt refresh if needed)
  if (parts.length === 4 && parts[0] === 'auth' && parts[1] === 'lms' && parts[3] === 'token' && req.method === 'GET') {
    const name = parts[2];
    const s = sessionFromRequest(req);
    if (!s) return sendJson(req, res, { error: 'Not authenticated' }, 401);
    if (s.allowedLms !== name) return sendJson(req, res, { error: 'Forbidden for this LMS' }, 403);
    const entry = state.lms[name];
    if (!entry) return sendJson(req, res, { error: 'No credentials for this LMS' }, 404);

    const creds = entry.credentials || entry;
    const tokenObj = entry.token || null;
    const obtainedAt = entry.obtainedAt || entry.obtainedAt === 0 ? entry.obtainedAt : null;

    // Helper to determine expiry
    const isTokenExpired = (t, obtainedAtMs) => {
      if (!t) return true
      if (!t.expires_in) return false
      if (!obtainedAtMs) return true
      const age = Date.now() - obtainedAtMs
      // consider token expired 30s before actual expiry to allow refresh
      return age >= (t.expires_in * 1000 - 30000)
    }

    // If we have a token and it's not expired, return it
    if (tokenObj && tokenObj.access_token && !isTokenExpired(tokenObj, obtainedAt)) {
      return sendJson(req, res, { token: tokenObj, obtainedAt, credentials: creds });
    }

    // If token expired and we have a refresh_token, attempt refresh
    if (tokenObj && tokenObj.refresh_token && creds && (creds.clientId || creds.client_id) && (creds.clientSecret || creds.client_secret)) {
      // Special-case Google Classroom token refresh (uses Google's token endpoint)
      if (String(name).toLowerCase() === 'google-classroom' || String(name).toLowerCase() === 'googleclassroom') {
        try {
          const tokenEndpoint = 'https://oauth2.googleapis.com/token'
          const refreshRes = await postForm(tokenEndpoint, {
            grant_type: 'refresh_token',
            refresh_token: tokenObj.refresh_token,
            client_id: creds.clientId || creds.client_id,
            client_secret: creds.clientSecret || creds.client_secret
          })
          if (refreshRes && refreshRes.data && refreshRes.data.access_token) {
            const newToken = Object.assign({}, tokenObj, refreshRes.data)
            entry.token = newToken
            entry.obtainedAt = Date.now()
            state.lms[name] = entry
            saveState()
            return sendJson(req, res, { token: newToken, obtainedAt: entry.obtainedAt, credentials: creds })
          }
          return sendJson(req, res, { error: 'Refresh did not return access_token' }, 401)
        } catch (err) {
          const status = err && err.status ? err.status : 401
          const details = err && err.data ? err.data : String(err)
          return sendJson(req, res, { error: 'Refresh failed', details }, status)
        }
      }

      // Fallback: other LMS token refresh logic (e.g., edX)
      const baseUrl = (creds.baseUrl || process.env.EDX_BASE_URL || '').replace(/\/$/, '')
      const tokenEndpoint = `${baseUrl}/oauth2/access_token/`
      try {
        const refreshRes = await postForm(tokenEndpoint, {
          grant_type: 'refresh_token',
          refresh_token: tokenObj.refresh_token,
          client_id: creds.clientId || creds.client_id,
          client_secret: creds.clientSecret || creds.client_secret
        })
        if (refreshRes && refreshRes.data && refreshRes.data.access_token) {
          const newToken = refreshRes.data
          entry.token = newToken
          entry.obtainedAt = Date.now()
          state.lms[name] = entry
          saveState()
          return sendJson(req, res, { token: newToken, obtainedAt: entry.obtainedAt, credentials: creds })
        }
        return sendJson(req, res, { error: 'Refresh did not return access_token' }, 401)
      } catch (err) {
        const status = err && err.status ? err.status : 401
        const details = err && err.data ? err.data : String(err)
        return sendJson(req, res, { error: 'Refresh failed', details }, status)
      }
    }

    // Password grant removed for edX - use OAuth flow instead

    // No way to provide a token
    return sendJson(req, res, { error: 'No token available and no credentials to obtain one' }, 404)
  }

  if (pathname === '/' || pathname === '/health') {
    return sendJson(req, res, { status: 'ok', role: 'auth-server' });
  }

  sendJson(req, res, { error: 'Not Found' }, 404);
});

server.listen(PORT, () => {
  console.log(`[auth-server] listening on http://localhost:${PORT}`);
});
