# 📚 Google Classroom Learning Tokens API

This service connects to **Google Classroom** to analyse coursework grades and award *learning tokens* — mirroring the Moodle integration located in `lms/Moodle`.

## ✨ Features

- **Google OAuth2 Authentication** (with offline refresh‐token)
- **Course Listing** `GET /api/courses`
- **Detailed Course Dashboard** `GET /api/courses/:id` ─ students, scores, tokens
- **Health Check** `GET /api/test`

## 🏃‍♂️ Quick Start

### 1. Prerequisites

1. Node.js 16+
2. A Google account that is **teacher** in the target Classroom courses
3. OAuth2 credentials (Client ID & Secret) created in Google Cloud Console

### 0. Environment variables

An `env.sample` file is provided. Copy it as `.env` (or leave as `env` – the server loads both) and fill your credentials:

```bash
cp env.sample .env # or rename
```

### 2. Configuration

Create `.env` (see sample below):

```env
GOOGLE_CLIENT_ID="<your client id>"
GOOGLE_CLIENT_SECRET="<your client secret>"
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
# Optional — filled automatically after first consent
GOOGLE_REFRESH_TOKEN="<paste refresh token here>"

PORT=3000
```

### 3. Install & Run

```bash
cd lms/google-classroom
npm install
npm start
```

First run will open a browser for consent. Copy the *refresh token* printed in the console into `.env` so future runs are headless.

### 4. API Endpoints

- `GET /api/courses` – List teacher’s courses
- `GET /api/courses/:id` – Course details incl. students, tokens, coursework
- `GET /api/students/:userId/course/:courseId` – Specific student’s performance in a course
- `GET /api/test` – Simple connectivity check

Example:

```bash
curl http://localhost:3000/api/courses
curl http://localhost:3000/api/courses/123456789
```

## 🛠️ Internals

`server.js` mirrors the structure of the Moodle service:

1. Creates an OAuth2 client (`googleapis`)
2. `ensureAuthenticated` middleware exchanges `code` for tokens or redirects
3. Helper `calculateTokens(score)` matches the Moodle formula
4. Routes fetch data via Classroom API and build summary JSON


