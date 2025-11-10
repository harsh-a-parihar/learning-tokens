import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Robust .env loader: decode file URL path and add CWD fallback
const decodedDir = decodeURIComponent(path.dirname(new URL(import.meta.url).pathname));
let envPath = path.join(decodedDir, ".env");
if (!fs.existsSync(envPath)) {
  const fallback = path.join(decodedDir, "env");
  if (fs.existsSync(fallback)) envPath = fallback;
}
if (!fs.existsSync(envPath)) {
  const cwdEnv = path.join(process.cwd(), ".env");
  const cwdEnvAlt = path.join(process.cwd(), "env");
  if (fs.existsSync(cwdEnv)) envPath = cwdEnv;
  else if (fs.existsSync(cwdEnvAlt)) envPath = cwdEnvAlt;
}
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3002;

// ============================================================================
// GOOGLE CLASSROOM AUTH SETUP
// ============================================================================

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.error("❌ Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in .env file");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Allow using a stored refresh token to run without browser consent every time
if (GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
}

// Classroom API instance
function getClassroom() {
  return google.classroom({ version: "v1", auth: oauth2Client });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function stripHtml(text = "") {
  return text.replace(/<[^>]*>/g, "").trim();
}

function calculateTokens(score) {
  return Math.max(1, Math.floor(score / 10));
}

async function ensureAuthenticated(req, res, next) {
  // Skip auth endpoints
  if (req.path.startsWith("/api/google/auth") || req.path.startsWith("/api/google/callback")) {
    return next();
  }

  // If credentials already have a refresh token, proceed
  if (oauth2Client.credentials && oauth2Client.credentials.access_token) {
    return next();
  }

  if (GOOGLE_REFRESH_TOKEN) {
    // refresh token was supplied but no access token yet -> get new access token silently
    try {
      await oauth2Client.getAccessToken();
      return next();
    } catch (err) {
      console.error("Failed to refresh access token", err);
    }
  }

  // Not authenticated
  return res.status(401).json({
    error: "Authentication required",
    message: "Visit /api/google/auth to connect your Google account.",
  });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(ensureAuthenticated);

// ============================================================================
// AUTH ROUTES
// =========================================================================
app.get("/api/google/auth", (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students",
    "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
    // allow reading student profile emails (requires re-consent)
    "https://www.googleapis.com/auth/classroom.profile.emails",
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
  res.redirect(url);
});

app.get("/api/google/callback", async (req, res) => {
  if (!req.query.code) return res.status(400).send("Missing code param");
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);
    if (tokens.refresh_token) {
      console.log("✅ Received refresh token. Store it in .env as GOOGLE_REFRESH_TOKEN:");
      console.log(tokens.refresh_token);
    }
    res.send("Authentication successful. You can now access /api endpoints.");
  } catch (error) {
    console.error("Callback error", error);
    res.status(500).send("OAuth2 callback failed");
  }
});

// ============================================================================
// API ROUTES (mirroring Moodle service)
// ============================================================================

// GET /api/courses – list all active Classroom courses for the teacher/account
app.get("/api/courses", async (req, res) => {
  try {
    const classroom = getClassroom();
    const { data } = await classroom.courses.list({ teacherId: "me" });
    res.json(data.courses || []);
  } catch (error) {
    console.error("Error fetching courses", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/courses/:courseId – detailed info with students + tokens summary
app.get("/api/courses/:courseId", async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const classroom = getClassroom();

    // Course info
    const { data: course } = await classroom.courses.get({ id: courseId });

    // Students
    const { data: roster } = await classroom.courses.students.list({ courseId });
    const students = roster.students || [];

    // Best-effort: fetch userProfiles to enrich student profile with email when missing.
    for (const s of students) {
      try {
        if (!s.profile || !s.profile.emailAddress) {
          const { data: profile } = await classroom.userProfiles.get({ userId: s.userId });
          if (profile) {
            s.profile = s.profile || {};
            if (profile.emailAddress) s.profile.emailAddress = profile.emailAddress;
            if (profile.name) s.profile.name = profile.name;
          }
        }
      } catch (err) {
        // ignore failures (insufficient scopes or profile not accessible)
      }
    }

    // Coursework (assignments, quizzes, etc.)
    const { data: cw } = await classroom.courses.courseWork.list({ courseId });
    const courseWork = cw.courseWork || [];

    // For each student, compute average percentage and tokens based on submissions
    const processedStudents = [];
    for (const student of students) {
      let totalScore = 0;
      let workCount = 0;

      for (const work of courseWork) {
        try {
          const { data: submissions } = await classroom.courses.courseWork.studentSubmissions.list({
            courseId,
            courseWorkId: work.id,
            userId: student.userId,
          });

          if (submissions.studentSubmissions && submissions.studentSubmissions.length > 0) {
            const best = submissions.studentSubmissions.reduce((a, b) =>
              (b.assignedGrade || 0) > (a.assignedGrade || 0) ? b : a
            );
            if (best.assignedGrade != null && work.maxPoints) {
              const percentage = (best.assignedGrade / work.maxPoints) * 100;
              totalScore += percentage;
              workCount++;
            }
          }
        } catch (err) {
          console.warn(`Could not fetch submission for student ${student.userId} work ${work.id}`);
        }
      }

      const averageScore = workCount > 0 ? totalScore / workCount : 0;
      const tokens = calculateTokens(averageScore);

      processedStudents.push({
        id: student.userId,
        name: stripHtml(student.profile?.name?.fullName || "Unnamed"),
        email: student.profile?.emailAddress,
        score: Math.round(averageScore * 100) / 100,
        tokens,
        workCompleted: workCount,
      });
    }

    processedStudents.sort((a, b) => b.score - a.score);

    const totalTokens = processedStudents.reduce((sum, s) => sum + s.tokens, 0);
    const averageScore = processedStudents.length > 0 ? processedStudents.reduce((sum, s) => sum + s.score, 0) / processedStudents.length : 0;

    res.json({
      course: {
        id: course.id,
        name: course.name,
        section: course.section,
        room: course.room,
        description: course.descriptionPlainText,
        enrollmentCode: course.enrollmentCode,
        studentCount: processedStudents.length,
      },
      students: processedStudents,
      summary: {
        totalStudents: processedStudents.length,
        totalTokens,
        averageScore: Math.round(averageScore * 100) / 100,
        totalCourseWork: courseWork.length,
      },
      courseWork: courseWork.map((w) => ({
        id: w.id,
        title: w.title,
        maxPoints: w.maxPoints,
        state: w.state,
        dueDate: w.dueDate,
      })),
    });
  } catch (error) {
    console.error("Error processing course", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/coursework/:courseId/:workId/submissions - list studentSubmissions for a coursework
app.get('/api/coursework/:courseId/:workId/submissions', async (req, res) => {
  try {
    const { courseId, workId } = req.params;
    const classroom = getClassroom();
    const { data } = await classroom.courses.courseWork.studentSubmissions.list({ courseId, courseWorkId: workId, pageSize: 500 });
    res.json({ submissions: data.studentSubmissions || [] });
  } catch (error) {
    console.error('Error fetching coursework submissions', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new endpoint for student's performance in a course
// GET /api/students/:userId/course/:courseId
app.get("/api/students/:userId/course/:courseId", async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const classroom = getClassroom();

    // Get user profile
    const { data: profile } = await classroom.userProfiles.get({ userId });

    // CourseWork for the course
    const { data: cw } = await classroom.courses.courseWork.list({ courseId });
    const courseWork = cw.courseWork || [];

    const cwResults = [];
    let totalScore = 0;
    let workCount = 0;

    for (const work of courseWork) {
      try {
        const { data: submissions } = await classroom.courses.courseWork.studentSubmissions.list({
          courseId,
          courseWorkId: work.id,
          userId,
        });

        let bestPerc = 0;
        if (submissions.studentSubmissions && submissions.studentSubmissions.length > 0 && work.maxPoints) {
          const best = submissions.studentSubmissions.reduce((a, b) => (b.assignedGrade || 0) > (a.assignedGrade || 0) ? b : a);
          bestPerc = (best.assignedGrade / work.maxPoints) * 100;
          totalScore += bestPerc;
          workCount++;
        }

        cwResults.push({
          id: work.id,
          title: work.title,
          maxPoints: work.maxPoints,
          bestPercentage: Math.round(bestPerc * 100) / 100,
          tokens: calculateTokens(bestPerc),
        });
      } catch (e) {
        console.warn(`Could not fetch submissions for work ${work.id} user ${userId}`);
      }
    }

    const averageScore = workCount > 0 ? totalScore / workCount : 0;

    res.json({
      student: {
        id: profile.id,
        name: profile.name?.fullName,
        email: profile.emailAddress,
      },
      courseId,
      performance: {
        averageScore: Math.round(averageScore * 100) / 100,
        totalTokens: calculateTokens(averageScore),
        workCompleted: workCount,
        totalCourseWork: courseWork.length,
      },
      courseWorkResults: cwResults,
    });
  } catch (error) {
    console.error("Error getting student course data", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check /api/test
app.get("/api/test", async (req, res) => {
  try {
    const classroom = getClassroom();
    const { data } = await classroom.courses.list({ pageSize: 1 });
    res.json({ status: "success", message: "Google Classroom API reachable", sampleCourseCount: (data.courses || []).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SERVE FRONTEND PLACEHOLDER
// ============================================================================

app.get("/", (req, res) => {
  res.send("<h1>Google Classroom Learning Tokens API</h1><p>Use the /api endpoints.</p>");
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`\n🚀 Google Classroom Learning Tokens API Server Started\n📍 http://localhost:${PORT}\n`);
});
