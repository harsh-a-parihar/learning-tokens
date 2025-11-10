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

const GOOGLE_PROXY_URL = process.env.GOOGLE_PROXY_URL || process.env.GCLASS_PROXY_URL || process.env.GOOGLE_CLASSROOM_PROXY || process.env.GCLASS_PROXY || 'http://localhost:3002'

export async function fetchGoogleClassroomCourse(courseId?: string | number) {
  const client = axios.create({ baseURL: GOOGLE_PROXY_URL })

  // If no courseId provided, fetch list of courses and pick first
  if (!courseId) {
    const listRes = await client.get(`/api/courses`)
    const courses = listRes.data || []
    if (!courses || courses.length === 0) throw new Error('No courses found from proxy')
    courseId = courses[0].id
  }

  // Fetch course aggregate (proxy returns course, students, courseWork, summary)
  const res = await client.get(`/api/courses/${courseId}`)
  const data = res.data

  // Enrich courseWork with submissions per coursework
  if (Array.isArray(data.courseWork)) {
    for (const w of data.courseWork) {
      try {
        const subs = await client.get(`/api/coursework/${courseId}/${w.id}/submissions`).catch(() => ({ data: { submissions: [] } }))
        w.submissions = subs.data.submissions || []
      } catch (e) {
        w.submissions = []
      }
    }
  }

  return data
}

export async function listGoogleClassroomCourses(query: string = '', limit: number = 25) {
  const client = axios.create({ baseURL: GOOGLE_PROXY_URL })
  
  try {
    // Fetch list of courses from Google Classroom proxy
    const res = await client.get('/api/courses')
    const courses = Array.isArray(res.data) ? res.data : []
    
    // Apply search filter if query provided
    const filtered = query ? courses.filter(c => 
      (c.name && c.name.toLowerCase().includes(query.toLowerCase())) ||
      (c.section && c.section.toLowerCase().includes(query.toLowerCase())) ||
      (c.id && String(c.id).includes(query))
    ) : courses
    
    return filtered.slice(0, limit).map(c => ({
      id: c.id || null,
      name: c.name || c.title || null,
      section: c.section || null,
      enrollmentCode: c.enrollmentCode || null,
      description: c.description || null
    }))
  } catch (e) {
    console.error('[Google Classroom Connector] Error listing courses:', e)
    return []
  }
}

// Default export for backwards compatibility
export default { fetchGoogleClassroomCourse, listGoogleClassroomCourses }
