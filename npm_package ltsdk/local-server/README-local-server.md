ltsdk local dev server
======================

Purpose
-------
Small, dependency-free server to provide live, normalized SDK JSON to the frontend. The server invokes connectors and adapters on each request to produce authentic, real-time normalized payloads.

Install & Run
-------------
Run from the SDK package root:

```bash
cd npm_package\ ltsdk
node local-server/server.js
# or with npm script
npm run dev-server
```

Default behavior
----------------
- Listens on port 4001 by default.
- Routes:
  - GET /api/:lms/courses/:id — invokes connectors/adapters to fetch and normalize live LMS data for the course
  - GET / or /health — basic health check

Environment variables
---------------------
- PORT — override the server port
- LTSDK_REMOTE_URL — optional remote SDK base URL to proxy misses (e.g. http://localhost:5000)
- LTSDK_CACHE_TTL — cache TTL in seconds (default 30)

Examples
--------
Run the server and point the frontend at it (example uses port 5001 used by repo scripts):

```bash
PORT=5001 node -r dotenv/config local-server/server.js
```

Proxy misses to a remote SDK server:

```bash
LTSDK_REMOTE_URL=http://remote-sdk.example.com node -r dotenv/config local-server/server.js
```

Notes
-----
Notes
-----
- The server now performs live normalization for each request. It will return `source: "live"` on successful live fetches. If live fetch fails and `LTSDK_REMOTE_URL` is configured, it will proxy to the remote SDK.
