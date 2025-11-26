# Auth Server (Separate)

This folder contains a **stand‑alone lightweight authentication & configuration server** for the Learning Tokens SDK development flow.

## Why Separate?
The primary `local-server/server.js` focuses on live LMS course normalization via connectors/adapters. Mixing onboarding and credential persistence logic into that file creates coupling and noise. This auth server isolates concerns:

- University discovery (mock list for now)
- LTSDK key validation (mock rules — length >= 8)
- Auth status introspection
- LMS credential storage & retrieval

Later, you can swap the mock pieces with real Learning Tokens backend calls without risking regression in the core local LMS fetch path.

## Endpoints
Base URL (default): `http://localhost:5002`

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/auth/universities` | List available universities (mock) |
| POST | `/auth/validate` | Validate `{ university, key }` and persist session |
| GET | `/auth/status` | Return `{ authenticated, university, userId }` |
| POST | `/auth/lms` | Persist LMS credentials `{ lms, credentials }` |
| GET | `/auth/lms/:lms` | Retrieve previously stored credentials for one LMS |
| GET | `/health` | Simple health probe |

## Data Persistence
State is stored in `local-server/config.auth.json` adjacent to the main server's config (kept separate). Example structure:
```json
{
  "university": "stanford",
  "ltsdkKey": "LTSDK-2024-STANFORD-A1B2C3D4",
  "userId": "user_1731324000000",
  "lms": {
    "canvas": { "baseUrl": "https://canvas.example.edu", "token": "*****" }
  }
}
```

## Valid Access Keys
Pre-configured LTSDK access keys are stored in `local-server/auth/keys.json`. Each key includes:
- `key`: The actual LTSDK access key string
- `university`: The university this key is issued for
- `issueDate`: When the key was issued
- `status`: Either "active" or "inactive"

The auth server validates incoming keys against this list. Keys must:
1. Exist in the `validKeys` array
2. Have status "active"
3. Match the selected university (optional but recommended)

**Current valid keys for testing:**
- Stanford: `LTSDK-2024-STANFORD-A1B2C3D4`
- MIT: `LTSDK-2024-MIT-E5F6G7H8`
- Harvard: `LTSDK-2024-HARVARD-I9J0K1L2`
- Berkeley: `LTSDK-2024-BERKELEY-M3N4O5P6`
- Oxford: `LTSDK-2024-OXFORD-Q7R8S9T0`

## Running
From the SDK root package (where `package.json` lives):
```bash
node local-server/auth/auth-server.js
```
Optionally set a custom port:
```bash
LTSDK_AUTH_PORT=5100 node local-server/auth/auth-server.js
```

## Frontend Integration
Update the frontend auth flow to target `:5002` (already done in `AuthStub.jsx`). If you later remove the auth endpoints from `server.js`, nothing in the frontend breaks — it continues to talk only to the dedicated auth server.

## Customization Hooks
Environment variables:
- `LTSDK_AUTH_PORT` – override port (default 5002)
- `LTSDK_AUTH_ALLOW_ORIGIN` – CORS origin (default `*`)

## Next Steps
- Replace mock university list with real API call.
- Replace key validation stub with signature/remote verification.
- Encrypt or hash LMS credential secrets at rest.
- Consolidate config merging if you later unify state with main server.

## Safety Notes
Do **not** commit real secrets into `config.auth.json`. Add it to `.gitignore` if sensitive values are stored (currently not ignored). For development only.
