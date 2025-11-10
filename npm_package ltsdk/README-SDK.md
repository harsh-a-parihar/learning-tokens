# [ltsdk](https://www.npmjs.com/package/ltsdk)

**Learning Tokens SDK** - A unified connector for Learning Management Systems and educational platforms.

Connect to Canvas, Open edX, Moodle, Google Classroom, and Zoom to fetch normalized course data, student information, assignments, grades, and more.

---

## 🎯 Features

- **Multi-LMS Support**: Canvas, Open edX, Moodle, Google Classroom
- **Zoom Integration**: Meeting participant and poll data processing
- **Normalized Data**: Unified JSON schema across all platforms
- **Browser-Based UI**: Easy-to-use web interface for configuration
- **TypeScript Support**: Full type definitions included
- **Local SDK Server**: Built-in HTTP server for frontend integration

---

## 📦 Installation

```bash
npm install ltsdk
```

---

## 🚀 Quick Start

### Step 1: Install the SDK

```bash
npm install ltsdk
```

### Step 2: Start the SDK Server

```bash
cd node_modules/ltsdk
npm run dev-server
```

The SDK server will start on **http://localhost:5001**

### Step 3: Access the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

*(You'll need to have the frontend running - see [Frontend Setup](#frontend-setup) below)*

### Step 4: Configure Your LMS

1. Select your LMS platform (Canvas, edX, Moodle, or Google Classroom)
2. Enter your LMS credentials through the browser interface
3. Start fetching and managing course data

---

## 🔧 Configuration

The SDK requires specific credentials for each LMS platform. You can configure these through the web interface or by setting environment variables.

### Canvas LMS

Required credentials:
- **Canvas API Base URL**: Your Canvas instance URL (e.g., `https://canvas.instructure.com/api/v1/`)
- **Canvas API Token**: Generate from Canvas Account Settings → Approved Integrations

### Open edX

Required credentials:
- **Base URL**: Your Open edX instance URL (e.g., `http://local.openedx.io`)
- **Admin Username**: Your edX administrator username
- **Admin Password**: Your edX administrator password
- **Access Token**: OAuth2 access token
- **Client ID**: OAuth2 client ID
- **Client Secret**: OAuth2 client secret

### Moodle

Required credentials:
- **Moodle URL**: Your Moodle site URL (e.g., `http://localhost:8888/moodle`)
- **Web Services Token**: Generate from Moodle Site Administration → Plugins → Web Services

### Google Classroom

Required credentials:
- **Client ID**: Google OAuth2 client ID
- **Client Secret**: Google OAuth2 client secret
- **Redirect URI**: OAuth callback URL (default: `http://localhost:3002/api/google/callback`)
- **Refresh Token**: Generated during OAuth flow

---

## 💻 Programmatic Usage

### Fetching Course Data

```typescript
import { fetchCanvasCourse, normalizeCanvas } from 'ltsdk';

// Fetch raw Canvas course data
const rawCourse = await fetchCanvasCourse('12345');

// Normalize to standard format
const normalized = await normalizeCanvas(rawCourse);

console.log(normalized);
```

### Using Different LMS Connectors

```typescript
// edX
import { fetchEdxCourse, normalizeEdx } from 'ltsdk';
const edxData = await fetchEdxCourse('course-v1:org+course+run');
const normalized = await normalizeEdx(edxData);

// Moodle
import { fetchMoodleCourse, normalizeMoodle } from 'ltsdk';
const moodleData = await fetchMoodleCourse('42');
const normalized = await normalizeMoodle(moodleData);

// Google Classroom
import { fetchGoogleClassroomCourse, normalizeGoogleClassroom } from 'ltsdk';
const googleData = await fetchGoogleClassroomCourse('809246121636');
const normalized = await normalizeGoogleClassroom(googleData);
```

### Listing Courses

```typescript
import { listCanvasCourses, listEdxCourses, listMoodleCourses } from 'ltsdk';

// List Canvas courses
const canvasCourses = await listCanvasCourses('search term', 25);

// List edX courses
const edxCourses = await listEdxCourses('', 25);

// List Moodle courses
const moodleCourses = await listMoodleCourses('math', 10);
```

### Validating Normalized Data

```typescript
import { validateNormalized } from 'ltsdk';

const result = validateNormalized(normalizedPayload);

if (result.valid) {
  console.log('Data is valid!');
} else {
  console.error('Validation errors:', result.errors);
}
```

---

## 🎥 Zoom Integration

This package also provides functions to interact with the Zoom API, fetch participant and poll data, process this data, and return the processed results.

### Zoom Usage Example

```typescript
import { run } from 'ltsdk';

(async () => {
  const accountId = "YOUR_ACCOUNT_ID";
  const clientId = "YOUR_CLIENT_ID";
  const clientSecret = "YOUR_CLIENT_SECRET";
  const meetingId = "YOUR_MEETING_ID";
  
  try {
    const processedData = await run(accountId, clientId, clientSecret, meetingId);
    console.log(processedData);
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

### Zoom Parameters
- **accountId** (string): The Zoom account ID
- **clientId** (string): The Zoom client ID
- **clientSecret** (string): The Zoom client secret
- **meetingId** (string): The ID of the Zoom meeting

---

## 🌐 Frontend Setup

The SDK includes a web-based interface for easy LMS configuration and course management.

### Prerequisites

The frontend is located in the main Learning Tokens repository:

```bash
git clone https://github.com/harsh-a-parihar/learning-tokens.git
cd learning-tokens/frontend
npm install
npm start
```

The frontend will start on **http://localhost:3000** and communicate with the SDK server on port 5001.

---

## 📚 Normalized Data Schema

All LMS data is normalized to a unified JSON schema for consistency:

```typescript
interface NormalizedPayload {
  source: {
    lms: 'canvas' | 'edx' | 'moodle' | 'google-classroom';
    rawCourseId: string;
    fetchedAt: string;
  };
  institution?: {
    id: string;
    name: string;
  };
  course: {
    id: string;
    name?: string;
    startDate?: string;
    endDate?: string;
    metadata?: any;
  };
  instructors: Person[];
  learners: Person[];
  assignments: Assignment[];
  assessments: Assessment[];
  chat: ChatChannel[];
  transcript: TranscriptRecord[];
}
```

See [TypeScript Types](./types/index.d.ts) for complete type definitions.

---

## 🛠️ Development

### Build the SDK

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Run Smoke Tests

```bash
npm run smoke
```

### Clean Build Artifacts

```bash
npm run clean
```

---

## 🔑 Environment Variables

Create a `.env` file in your project root with the following variables:

```bash
# Canvas LMS
CANVAS_API_BASE=https://canvas.instructure.com/api/v1/
CANVAS_API_TOKEN=your_canvas_token

# Open edX
BASE_URL=http://local.openedx.io
EDX_ADMIN_USERNAME=your_username
EDX_ADMIN_PASSWORD=your_password
EDX_ACCESS_TOKEN=your_token
EDX_CLIENT_ID=your_client_id
EDX_CLIENT_SECRET=your_client_secret

# Moodle
MOODLE_URL=http://localhost:8888/moodle
MOODLE_TOKEN=your_moodle_token

# Google Classroom
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=http://localhost:3002/api/google/callback
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

*(Note: The web interface will help you configure these without manually editing files)*

---

