import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'

// Attempt to load a .env file from the LMS/canvas/backend folder if present
try {
  dotenv.config({ path: path.resolve(process.cwd(), '../../LMS/canvas/backend/.env') })
} catch (e) {
  /* ignore */
}

const CANVAS_API_BASE = process.env.CANVAS_API_BASE || process.env.CANVAS_BASE_URL
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN || process.env.CANVAS_TOKEN
const CANVAS_PROXY_URL = process.env.CANVAS_PROXY_URL

export async function fetchCanvasCourse(courseId: string | number) {
  if (process.env.LTSDK_DEBUG) {
    console.log('[LTSDK] Canvas env check - CANVAS_PROXY_URL:', CANVAS_PROXY_URL)
    console.log('[LTSDK] Canvas env check - CANVAS_API_BASE:', CANVAS_API_BASE)
    console.log('[LTSDK] Canvas env check - CANVAS_API_TOKEN length:', (CANVAS_API_TOKEN || '').length)
  }

  // If a local proxy is provided, use it (no token required)
  if (CANVAS_PROXY_URL) {
    const client = axios.create({ baseURL: CANVAS_PROXY_URL })
    const [courseRes, studentsRes, assignmentsRes, discussionsRes] = await Promise.all([
      client.get(`/courses/${courseId}`),
      client.get(`/courses/${courseId}/students`),
      client.get(`/courses/${courseId}/assignments`),
      client.get(`/courses/${courseId}/discussion_topics`).catch(() => ({ data: [] }))
    ])
    const assignments = assignmentsRes.data || []

    // Try to fetch submissions for each assignment (proxy may not implement; fall back to Canvas API when token present)
    for (const a of assignments) {
      try {
        const subRes = await client.get(`/courses/${courseId}/assignments/${a.id}/submissions?per_page=100`)
        // proxy may return different shape; attach raw submissions
        a.submissions = subRes.data.submissions || subRes.data || []
      } catch (err) {
        // ignore proxy errors; leave submissions empty for now — fallback below will try real API
        a.submissions = []
      }
      // If assignment is a quiz, try to fetch quiz grades via proxy helper
      if (a.quiz_id) {
        try {
          const quizRes = await client.get(`/courses/${courseId}/quizzes/${a.quiz_id}/grades`)
          a.quizGrades = quizRes.data // { quiz_info, grades }
        } catch (err) {
          // ignore - not all proxies implement this helper
        }
      }
    }

    // If some assignments have empty submissions and a real API is configured, try fetching from Canvas directly
    if ((process.env.CANVAS_API_BASE || process.env.CANVAS_BASE_URL) && (process.env.CANVAS_API_TOKEN || process.env.CANVAS_TOKEN)) {
      // Normalize base to ensure there is exactly one /api/v1 segment
      const rawBase = (process.env.CANVAS_API_BASE || process.env.CANVAS_BASE_URL || '').replace(/\/+$/, '')
      const apiBase = rawBase.replace(/(\/api\/v1)$/i, '') + '/api/v1'
      const realClient = axios.create({ baseURL: apiBase, headers: { Authorization: `Bearer ${process.env.CANVAS_API_TOKEN || process.env.CANVAS_TOKEN}` } })
      for (const a of assignments) {
        if (!a.submissions || a.submissions.length === 0) {
          try {
            // request paths are relative to baseURL (which now contains /api/v1)
            const subRes = await realClient.get(`/courses/${courseId}/assignments/${a.id}/submissions?per_page=100`)
            a.submissions = subRes.data.submissions || subRes.data || []
          } catch (err) {
            // still ignore
          }
        }
      }
    }

    return {
      ...courseRes.data,
      teachers: [],
      students: studentsRes.data,
      assignments,
      discussion_topics: discussionsRes.data || []
    }
  }

  if (!CANVAS_API_BASE || !CANVAS_API_TOKEN) throw new Error('Canvas API base or token not configured in env')

  // Normalize provided base so we never double-up the /api/v1 segment. Then use
  // relative paths (e.g. /courses/:id) against that base.
  // Prefer explicitly configured CANVAS_API_BASE, fall back to other env names.
  const rawBase = (CANVAS_API_BASE || process.env.CANVAS_API_BASE || process.env.CANVAS_BASE_URL || '').replace(/\/+$/, '')
  const apiBase = rawBase.replace(/(\/api\/v1)$/i, '') + '/api/v1'
  const client = axios.create({ baseURL: apiBase, headers: { Authorization: `Bearer ${CANVAS_API_TOKEN}` } })

  // Fetch course details, users, assignments, discussions as basic example
  const [courseRes, usersRes, assignmentsRes, discussionsRes] = await Promise.all([
    client.get(`/courses/${courseId}`),
    client.get(`/courses/${courseId}/users`, { params: { enrollment_type: ['student', 'teacher'], include: ['enrollments'] } }),
    client.get(`/courses/${courseId}/assignments`),
    client.get(`/courses/${courseId}/discussion_topics`)
  ])
  
  // Fetch submissions for each assignment
  const assignments = assignmentsRes.data || []
  if (process.env.LTSDK_DEBUG) {
    console.log(`[LTSDK] Fetching submissions for ${assignments.length} assignments...`)
  }
  
  for (const assignment of assignments) {
    try {
      const submissionsRes = await client.get(`/courses/${courseId}/assignments/${assignment.id}/submissions`, {
        params: { include: ['submission_history', 'submission_comments', 'rubric_assessment', 'user'] }
      })
      assignment.submissions = submissionsRes.data || []
      if (process.env.LTSDK_DEBUG) {
        console.log(`[LTSDK] Assignment ${assignment.id} (${assignment.name}): fetched ${assignment.submissions.length} submissions`)
      }
    } catch (err) {
      if (process.env.LTSDK_DEBUG) {
        console.log(`[LTSDK] Error fetching submissions for assignment ${assignment.id}:`, (err as any).message)
      }
      assignment.submissions = []
    }
  }

  // Try to get enrollments separately
  let enrollmentsRes
  if (process.env.LTSDK_DEBUG) {
    console.log('[LTSDK] Attempting to fetch enrollments...')
  }
  try {
    enrollmentsRes = await client.get(`/courses/${courseId}/enrollments`, {
      params: { include: ['grades'] }  // Include grade data in enrollments
    })
    if (process.env.LTSDK_DEBUG) {
      console.log('[LTSDK] Successfully fetched enrollments with grades')
    }
  } catch (err) {
    if (process.env.LTSDK_DEBUG) {
      console.log('[LTSDK] Error fetching enrollments:', (err as any).message || err)
    }
    enrollmentsRes = { data: [] }
  }

  // Separate teachers and students using enrollment data
  if (process.env.LTSDK_DEBUG) {
    console.log('[LTSDK] Raw users response:', JSON.stringify(usersRes.data, null, 2))
    console.log('[LTSDK] Raw enrollments response:', JSON.stringify(enrollmentsRes.data, null, 2))
  }

  // Create maps from enrollments to identify teachers vs students
  const teacherIds = new Set()
  const studentIds = new Set()
  
  enrollmentsRes.data.forEach((enrollment: any) => {
    if (enrollment.type === 'TeacherEnrollment' || enrollment.role === 'TeacherEnrollment') {
      teacherIds.add(enrollment.user_id)
    } else if (enrollment.type === 'StudentEnrollment' || enrollment.role === 'StudentEnrollment') {
      studentIds.add(enrollment.user_id)
    }
  })

  const teachers = usersRes.data.filter((u: any) => teacherIds.has(u.id))
  const students = usersRes.data.filter((u: any) => studentIds.has(u.id))

  if (process.env.LTSDK_DEBUG) {
    console.log(`[LTSDK] Filtered teachers: ${teachers.length}, students: ${students.length}`)
    console.log('[LTSDK] Teacher IDs:', Array.from(teacherIds))
    console.log('[LTSDK] Student IDs:', Array.from(studentIds))
    console.log('[LTSDK] Teachers:', JSON.stringify(teachers.map((t: any) => ({id: t.id, name: t.name, email: t.email})), null, 2))
  }

  // Normalize raw structure to what the adapter expects. The adapter already handles many shapes.
  const result = {
    ...courseRes.data,
    teachers: teachers,
    students: students,
    assignments: assignments,  // Use assignments with submissions, not raw assignmentsRes.data
    discussion_topics: discussionsRes.data,
    enrollments: enrollmentsRes.data  // IMPORTANT: Include enrollments for grade data!
  }
  
  if (process.env.LTSDK_DEBUG) {
    console.log('[LTSDK] Connector final return keys:', Object.keys(result))
    console.log('[LTSDK] Connector final teachers length:', result.teachers.length)
    console.log('[LTSDK] Connector final enrollments length:', result.enrollments?.length || 0)
  }
  
  return result
}

export default fetchCanvasCourse

// Simple listing/search helper for the dev server. Tries multiple discovery
// endpoints and returns a compact array of course meta objects.
export async function listCanvasCourses(query: string = '', limit: number = 25) {
  try {
    // If a local proxy is provided, use it (no token required)
    if (CANVAS_PROXY_URL) {
      const client = axios.create({ baseURL: CANVAS_PROXY_URL })
      const res = await client.get('/courses').catch(() => ({ data: [] }))
      const courses = Array.isArray(res.data) ? res.data : []
      
      // Apply search filter if query provided
      const filtered = query ? courses.filter(c => 
        (c.name && c.name.toLowerCase().includes(query.toLowerCase())) ||
        (c.course_code && c.course_code.toLowerCase().includes(query.toLowerCase())) ||
        (c.id && String(c.id).includes(query))
      ) : courses
      
      return filtered.slice(0, limit).map(c => ({
        id: c.id || null,
        name: c.name || c.title || null,
        course_code: c.course_code || null,
        account: c.account || null,
        short_description: c.short_description || c.description || null,
        workflow_state: c.workflow_state || null
      }))
    }

    if (!CANVAS_API_BASE || !CANVAS_API_TOKEN) {
      throw new Error('Canvas API base or token not configured in env')
    }

    // Use the same base URL normalization as fetchCanvasCourse
    const rawBase = (CANVAS_API_BASE || process.env.CANVAS_API_BASE || process.env.CANVAS_BASE_URL || '').replace(/\/+$/, '')
    const apiBase = rawBase.replace(/(\/api\/v1)$/i, '') + '/api/v1'
    const client = axios.create({ baseURL: apiBase, headers: { Authorization: `Bearer ${CANVAS_API_TOKEN}` } })

    // Fetch courses from Canvas API
    const res = await client.get('/courses', { params: { per_page: limit, state: ['available', 'completed'] } })
    const courses = Array.isArray(res.data) ? res.data : []
    
    // Apply search filter if query provided
    const filtered = query ? courses.filter(c => 
      (c.name && c.name.toLowerCase().includes(query.toLowerCase())) ||
      (c.course_code && c.course_code.toLowerCase().includes(query.toLowerCase())) ||
      (c.id && String(c.id).includes(query))
    ) : courses
    
    return filtered.map(c => ({
      id: c.id || null,
      name: c.name || c.title || null,
      course_code: c.course_code || null,
      account: c.account || null,
      short_description: c.short_description || c.description || null,
      workflow_state: c.workflow_state || null
    }))
  } catch (e) {
    return []
  }
}
