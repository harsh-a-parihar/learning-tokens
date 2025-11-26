import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Attempt to load .env from LMS/google-classroom if present
try {
  dotenv.config({ path: path.resolve(process.cwd(), '../../LMS/google-classroom/.env') })
} catch (e) {
  /* ignore */
}

// The connector now talks directly to Google's Classroom API using runtime credentials
// provided by the auth server. We do NOT use a proxy by default.
async function exchangeRefreshForAccessToken({ clientId, clientSecret, refreshToken }: { clientId?: string, clientSecret?: string, refreshToken?: string }) {
  if (!refreshToken || !clientId || !clientSecret) return null;
  try {
    const resp = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      }
    });
    return resp && resp.data ? resp.data : null;
  } catch (e) {
    if (process.env.LTSDK_DEBUG === 'true') console.error('[Google Connector] token exchange failed', String(e));
    return null;
  }
}

async function fetchRuntimeConfigFromLocalServer() {
  try {
    const port = process.env.LTSDK_LOCAL_SERVER_PORT || process.env.PORT || 5001;
    const resp = await axios.get(`http://localhost:${port}/api/config?lms=google-classroom`, { timeout: 2000 });
    return resp && resp.data ? (resp.data.config || null) : null;
  } catch (e) {
    return null;
  }
}

export async function fetchGoogleClassroomCourse(courseId?: string | number, runtimeCreds?: any) {
  // runtimeCreds may contain accessToken OR refreshToken+clientId+clientSecret
  let accessToken = runtimeCreds && runtimeCreds.accessToken;
  let cfg = null;
  if (!accessToken && runtimeCreds && (runtimeCreds.refreshToken || runtimeCreds.refresh_token)) {
    const tokenResp = await exchangeRefreshForAccessToken({ clientId: runtimeCreds.clientId || runtimeCreds.client_id || process.env.GOOGLE_CLIENT_ID, clientSecret: runtimeCreds.clientSecret || runtimeCreds.client_secret || process.env.GOOGLE_CLIENT_SECRET, refreshToken: runtimeCreds.refreshToken || runtimeCreds.refresh_token });
    accessToken = tokenResp && (tokenResp.access_token || tokenResp.accessToken);
  }
  // fallback to reading local-server stored config (dev-only)
  if (!accessToken) {
    cfg = await fetchRuntimeConfigFromLocalServer();
    if (cfg && (cfg.refreshToken || cfg.refresh_token)) {
      const tokenResp = await exchangeRefreshForAccessToken({ clientId: cfg.clientId || cfg.client_id || process.env.GOOGLE_CLIENT_ID, clientSecret: cfg.clientSecret || cfg.client_secret || process.env.GOOGLE_CLIENT_SECRET, refreshToken: cfg.refreshToken || cfg.refresh_token });
      accessToken = tokenResp && (tokenResp.access_token || tokenResp.accessToken);
    }
  }
  if (!accessToken) {
    throw new Error('No runtime credentials available for Google Classroom. Please configure Google Classroom in the LMS setup and complete OAuth.')
  }

  const client = axios.create({ baseURL: 'https://classroom.googleapis.com', headers: { Authorization: `Bearer ${accessToken}` } })

  // If no courseId provided, fetch first course the user can access
  if (!courseId) {
    const res = await client.get('/v1/courses?pageSize=50')
    const list = (res && res.data && res.data.courses) ? res.data.courses : []
    if (!list || list.length === 0) throw new Error('No courses found in Google Classroom for authenticated user')
    courseId = list[0].id
  }

  // Helper to page through list endpoints
  async function fetchAll(path: string) {
    let out: any[] = []
    let next: string | null = null
    do {
      const q = next ? `${path}&pageToken=${encodeURIComponent(next)}` : path
      const r: any = await client.get(q)
      // normalize various response keys
      if (r && r.data) {
        if (Array.isArray(r.data.courses)) out = out.concat(r.data.courses)
        else if (Array.isArray(r.data.teachers)) out = out.concat(r.data.teachers)
        else if (Array.isArray(r.data.students)) out = out.concat(r.data.students)
        else if (Array.isArray(r.data.courseWork)) out = out.concat(r.data.courseWork)
        else if (Array.isArray(r.data.studentSubmissions)) out = out.concat(r.data.studentSubmissions)
        next = r.data.nextPageToken || null
      } else {
        next = null
      }
    } while (next)
    return out
  }

  // Fetch course, teachers, students, coursework and submissions
  const [courseRes, teachers, students, courseWork] = await Promise.all([
    client.get(`/v1/courses/${encodeURIComponent(String(courseId))}`).then((r: any) => r.data).catch(() => null),
    fetchAll(`/v1/courses/${encodeURIComponent(String(courseId))}/teachers?pageSize=200`),
    fetchAll(`/v1/courses/${encodeURIComponent(String(courseId))}/students?pageSize=200`),
    fetchAll(`/v1/courses/${encodeURIComponent(String(courseId))}/courseWork?pageSize=200`)
  ])

  // For each coursework fetch studentSubmissions
  const cwWithSubs = []
  if (Array.isArray(courseWork)) {
    for (const cw of courseWork) {
      const cwId = cw && cw.id ? String(cw.id) : ''
      let submissions: any[] = []
      try {
        submissions = await fetchAll(`/v1/courses/${encodeURIComponent(String(courseId))}/courseWork/${encodeURIComponent(cwId)}/studentSubmissions?pageSize=200`)
      } catch (e) {
        submissions = []
      }
      cwWithSubs.push(Object.assign({}, cw, { submissions }))
    }
  }

  return {
    course: courseRes,
    teachers,
    students,
    courseWork: cwWithSubs
  }
}

export async function listGoogleClassroomCourses(query: string = '', limit: number = 25, runtimeCreds?: any) {
  if (!runtimeCreds || !runtimeCreds.accessToken) {
    throw new Error('No runtime credentials available for Google Classroom. Please configure Google Classroom in the LMS setup and complete OAuth.')
  }
  const client = axios.create({ baseURL: 'https://classroom.googleapis.com', headers: { Authorization: `Bearer ${runtimeCreds.accessToken}` } })
  try {
    const res = await client.get(`/v1/courses?pageSize=${Math.min(100, Math.max(10, limit))}`)
    const courses = (res && res.data && res.data.courses) ? res.data.courses : []
    const filtered = query ? (courses as any[]).filter((c: any) => (c.name && c.name.toLowerCase().includes(query.toLowerCase())) || (c.section && c.section.toLowerCase().includes(query.toLowerCase())) || (c.id && String(c.id).includes(query))) : courses as any[]
    return filtered.slice(0, limit).map((c: any) => ({ id: c.id || null, name: c.name || c.title || null, section: c.section || null, enrollmentCode: c.enrollmentCode || null, description: c.description || null }))
  } catch (e) {
    if (process.env.LTSDK_DEBUG === 'true') {
      console.error('[Google Classroom Connector] Error listing courses:', String(e))
    }
    return []
  }
}

// Default export for backwards compatibility
export default { fetchGoogleClassroomCourse, listGoogleClassroomCourses }
