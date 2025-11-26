import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'

// Load optional edX .env for local development if present
try { dotenv.config({ path: path.resolve(process.cwd(), '../../LMS/edx/.env') }) } catch (e) { /* ignore */ }

const EDX_BASE = process.env.EDX_BASE_URL || process.env.BASE_URL || 'http://localhost:8000'
const TOKEN = process.env.ACCESS_TOKEN

const client = axios.create({ baseURL: EDX_BASE, headers: { Authorization: TOKEN ? `Bearer ${TOKEN}` : undefined } })

function normalizeUser(u: any) {
  if (!u) return null
  // search several likely nested shapes
  const cand = (u.user && typeof u.user === 'object') ? u.user : (u.profile && typeof u.profile === 'object' ? u.profile : u)
  const account = (cand.account && typeof cand.account === 'object') ? cand.account : null
  const candidates = [cand, account, u]
  const getFirst = (keys: string[]) => {
    for (const c of candidates) {
      if (!c) continue
      for (const k of keys) {
        if (c[k]) return c[k]
      }
    }
    return undefined
  }

  const id = getFirst(['id', 'pk', 'user_id', 'username', 'login', 'email'])
  const username = getFirst(['username', 'user_name', 'login'])
  const email = getFirst(['email', 'email_address'])
  const name = getFirst(['name', 'full_name', 'display_name']) || (getFirst(['first_name']) ? `${getFirst(['first_name'])} ${getFirst(['last_name']) || ''}`.trim() : undefined)
  if (!id && !username && !email && !name) return null
  return { id, username, email, name }
}

// Fetch detailed course data (best-effort). Keep this lightweight so it
// succeeds across diverse edX deployments — callers will normalize further.
export async function fetchEdxCourseWithClient(courseId: string, clientToUse: any) {
  if (!courseId) throw new Error('courseId required')

  let courseRes
  try {
    courseRes = await clientToUse.get(`/api/courses/v1/courses/${encodeURIComponent(courseId)}`)
  } catch (e: any) {
    if (e && e.response && (e.response.status === 401 || e.response.status === 403)) {
      const err: any = new Error('edX API authentication error')
      err.status = e.response.status
      throw err
    }
    courseRes = { data: null }
  }
  const course = courseRes.data || { id: courseId }

  let gradebookRes
  try {
    gradebookRes = await clientToUse.get(`/api/grades/v1/gradebook/${encodeURIComponent(courseId)}/`)
  } catch (e: any) {
    if (e && e.response && (e.response.status === 401 || e.response.status === 403)) {
      const err: any = new Error('edX API authentication error')
      err.status = e.response.status
      throw err
    }
    gradebookRes = { data: null }
  }
  const gradebook = gradebookRes.data || null

  // Simplified flow: fetch course_home metadata (preferred), fall back to
  // the course owner username, and always fetch enrollments for learners.
  let instructors: any[] = []
  let membershipRaw: any = null
  let courseMetadata: any = null

  try {
    const instRes = await clientToUse.get(`/api/course_home/v1/course_metadata/${encodeURIComponent(courseId)}/`).catch(() => ({ data: null }))
    courseMetadata = instRes.data || null
    if (process.env.LTSDK_DEBUG === 'true') console.debug('[edx connector] course_metadata:', JSON.stringify(courseMetadata))
    const metaInstructors = (courseMetadata && courseMetadata.instructors) || []
    instructors = Array.isArray(metaInstructors) ? metaInstructors.map((m: any) => normalizeUser(m)).filter(Boolean) : []
  } catch (e) {
    // ignore
  }

  if ((!instructors || instructors.length === 0) && course && (course.username || course.original_user_is_staff || course.is_staff)) {
    const candUsername = course.username || undefined
    const cand = { username: candUsername, name: candUsername, email: undefined, id: candUsername }
    const norm = normalizeUser(cand)
    if (norm) {
      instructors = [norm]
      membershipRaw = { __course_username_fallback: candUsername }
      if (process.env.LTSDK_DEBUG === 'true') console.debug('[edx connector] instructors from course metadata username fallback:', JSON.stringify(instructors))
    }
  }

  let enrollRes
  try {
    enrollRes = await clientToUse.get(`/api/enrollment/v1/enrollments/?course_id=${encodeURIComponent(courseId)}`)
  } catch (e: any) {
    if (e && e.response && (e.response.status === 401 || e.response.status === 403)) {
      const err: any = new Error('edX API authentication error')
      err.status = e.response.status
      throw err
    }
    enrollRes = { data: null }
  }
  let students = (enrollRes.data && enrollRes.data.results) || []

  // Try to enrich student data with more detailed information including email and enrollment dates
  try {
    // Attempt to get more detailed user information for each enrolled student
    const enrichedStudents = []
    for (const student of students) {
      let enrichedStudent = { ...student }

      // Try to get user profile information if we have a user reference
      if (student.user || student.username || student.user_id) {
        try {
          const userId = student.user?.id || student.user_id || student.username
          if (userId) {
            // Try multiple endpoints for user details
            if (process.env.LTSDK_DEBUG === 'true') console.debug(`[edx connector] Attempting to enrich enrollment student ${userId}`)
            const userRes = await clientToUse.get(`/api/user/v1/accounts/${encodeURIComponent(userId)}`).catch(() =>
              clientToUse.get(`/api/users/v1/accounts/${encodeURIComponent(userId)}`).catch(() =>
                clientToUse.get(`/api/user/v1/preferences/${encodeURIComponent(userId)}`).catch(() => ({ data: null }))
              )
            )

            if (userRes.data) {
              // Merge user profile data
              enrichedStudent = {
                ...enrichedStudent,
                user: {
                  ...enrichedStudent.user,
                  ...userRes.data,
                  email: userRes.data.email || enrichedStudent.user?.email,
                  name: userRes.data.name || userRes.data.full_name || enrichedStudent.user?.name,
                }
              }
              if (process.env.LTSDK_DEBUG === 'true') {
                console.debug(`[edx connector] Enriched enrollment student ${userId} email: "${userRes.data.email}"`)
              }
            } else {
              if (process.env.LTSDK_DEBUG === 'true') {
                console.debug(`[edx connector] No user profile data found for enrollment student ${userId}`)
              }
            }
          }
        } catch (e) {
          // Continue with original student data if enrichment fails
          if (process.env.LTSDK_DEBUG === 'true') console.debug('[edx connector] Failed to enrich student data:', e instanceof Error ? e.message : String(e))
        }
      }

      // Ensure we have enrollment timestamp - try multiple possible field names
      if (!enrichedStudent.created && !enrichedStudent.enrolled_at && !enrichedStudent.enrollment_date) {
        enrichedStudent.enrolled_at = enrichedStudent.date_joined || enrichedStudent.enrollment_date || enrichedStudent.created
      }

      enrichedStudents.push(enrichedStudent)
    }
    students = enrichedStudents
  } catch (e) {
    // If enrichment fails completely, continue with original student data
    if (process.env.LTSDK_DEBUG === 'true') console.debug('[edx connector] Failed to enrich students:', e instanceof Error ? e.message : String(e))
  }

  // Always try to enrich students from gradebook if we have gradebook data but few/no students
  if (gradebook) {
    if (process.env.LTSDK_DEBUG === 'true') console.debug('[edx connector] Extracting/enriching students from gradebook data')

    try {
      // Handle different gradebook structures: direct array, .results array, or individual entries
      let gradebookArray = []
      if (Array.isArray(gradebook)) {
        gradebookArray = gradebook
      } else if (gradebook.results && Array.isArray(gradebook.results)) {
        gradebookArray = gradebook.results
      } else if (typeof gradebook === 'object') {
        // Handle case where gradebook might be a single object or have other structure
        gradebookArray = Object.values(gradebook).filter((item: any) =>
          item && typeof item === 'object' && (item.username || item.user || item.user_id)
        )
      }
      const extractedStudents = []
      const seenUsernames = new Set()

      if (process.env.LTSDK_DEBUG === 'true') {
        console.debug('[edx connector] Processing gradebook array with', gradebookArray.length, 'entries')
        if (gradebookArray.length > 0) {
          console.debug('[edx connector] First gradebook entry keys:', Object.keys(gradebookArray[0]))
          console.debug('[edx connector] First gradebook entry sample:', JSON.stringify(gradebookArray[0], null, 2))
        }
      }

      for (const gradebookEntry of gradebookArray) {
        const username = gradebookEntry.username || gradebookEntry.user || gradebookEntry.user_id
        const userId = gradebookEntry.user_id || gradebookEntry.id || username

        if (username && !seenUsernames.has(username)) {
          seenUsernames.add(username)

          let studentData = {
            user_id: userId,
            username: username,
            email: gradebookEntry.email,
            created: gradebookEntry.created || gradebookEntry.enrolled_at || gradebookEntry.enrollment_date,
            enrolled_at: gradebookEntry.enrolled_at || gradebookEntry.enrollment_date || gradebookEntry.created,
            user: {
              id: userId,
              username: username,
              email: gradebookEntry.email,
              name: gradebookEntry.name || gradebookEntry.full_name
            }
          }

          // Try to enrich with user profile API if we don't have email or email is empty
          if ((!studentData.email || studentData.email.trim() === '') && userId) {
            if (process.env.LTSDK_DEBUG === 'true') console.debug(`[edx connector] Attempting to fetch email for user ${username} (ID: ${userId})`)
            try {
              // Try multiple user API endpoints to get email information
              const userEndpoints = [
                `/api/user/v1/accounts/${encodeURIComponent(userId)}`,
                `/api/users/v1/accounts/${encodeURIComponent(userId)}`,
                `/api/user/v1/accounts/${encodeURIComponent(username)}`,
                `/api/users/v1/accounts/${encodeURIComponent(username)}`
              ]

              let userRes = null
              for (const endpoint of userEndpoints) {
                try {
                  userRes = await clientToUse.get(endpoint)
                  if (userRes?.data) {
                    if (process.env.LTSDK_DEBUG === 'true') console.debug(`[edx connector] Successfully fetched user data from ${endpoint}:`, JSON.stringify(userRes.data, null, 2))
                    break
                  }
                } catch (e) {
                  if (process.env.LTSDK_DEBUG === 'true') console.debug(`[edx connector] Failed to fetch from ${endpoint}:`, e instanceof Error ? e.message : String(e))
                }
              }

              if (userRes?.data) {
                const originalEmail = studentData.email
                studentData.email = userRes.data.email || studentData.email
                studentData.user.email = userRes.data.email || studentData.user.email
                studentData.user.name = userRes.data.name || userRes.data.full_name || studentData.user.name
                studentData.enrolled_at = userRes.data.date_joined || userRes.data.created || studentData.enrolled_at
                studentData.created = userRes.data.date_joined || userRes.data.created || studentData.created

                if (process.env.LTSDK_DEBUG === 'true') {
                  console.debug(`[edx connector] Email enrichment for ${username}: "${originalEmail}" -> "${studentData.email}"`)
                }
              } else {
                if (process.env.LTSDK_DEBUG === 'true') console.debug(`[edx connector] No user data found for ${username} from any endpoint`)
              }
            } catch (e) {
              if (process.env.LTSDK_DEBUG === 'true') console.debug(`[edx connector] Failed to enrich student ${username}:`, e instanceof Error ? e.message : String(e))
            }
          }

          // If enrollment date is not available from API, leave it undefined.
          // Adapters will handle undefined correctly.
          extractedStudents.push(studentData)
        }
      }

      // Merge extracted students with existing students, preferring extracted ones
      const existingStudentIds = new Set(students.map((s: any) => s.user_id || s.username))
      const newStudents = extractedStudents.filter((s: any) => !existingStudentIds.has(s.user_id || s.username))
      students = [...students, ...newStudents]

      if (process.env.LTSDK_DEBUG === 'true') console.debug(`[edx connector] Extracted ${extractedStudents.length} students from gradebook, ${newStudents.length} new students added, total: ${students.length}`)
    } catch (e) {
      if (process.env.LTSDK_DEBUG === 'true') console.debug('[edx connector] Failed to extract students from gradebook:', e instanceof Error ? e.message : String(e))
    }
  }

  const out: any = { course, instructors, students, gradebook: gradebook && (gradebook.results || gradebook) || [], submissionsMap: {} }
  if (process.env.LTSDK_DEBUG === 'true') {
    const debugObj: any = { membershipRaw: membershipRaw || null, courseMetadata: courseMetadata || null }
    // if we created a scrape blob inside membershipRaw, surface it at top-level as well
    if (membershipRaw && membershipRaw.__scrape) debugObj.scrape = membershipRaw.__scrape
    // small course summary
    debugObj.course = { id: course && course.course_id ? course.course_id : (course && course.id ? course.id : null), username: course && course.username, is_staff: course && (course.is_staff || course.original_user_is_staff) }
    out.__debug_membership = debugObj
  }
  return out

}

// Keep original fetchEdxCourse but delegate to client-aware helper when runtime creds supplied
export async function fetchEdxCourse(courseId: string, creds?: any) {
  if (!courseId) throw new Error('courseId required')
  if (creds && (creds.baseUrl || creds.clientId || creds.clientSecret || creds.username || creds.accessToken)) {
    const runtimeBase = creds.baseUrl || process.env.EDX_BASE_URL || process.env.BASE_URL || EDX_BASE
    const runtimeToken = creds.accessToken || creds.token || undefined
    const unauthClient = axios.create({ baseURL: runtimeBase })
    // Try password grant token exchange if client credentials + user creds present
    if (!runtimeToken && creds.clientId && creds.clientSecret && creds.username && creds.password) {
      try {
        const tokenRes = await axios.post(`${runtimeBase.replace(/\/$/, '')}/oauth2/access_token/`, new URLSearchParams({
          grant_type: 'password',
          username: creds.username,
          password: creds.password,
          client_id: creds.clientId,
          client_secret: creds.clientSecret
        }).toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
        if (tokenRes && tokenRes.data && tokenRes.data.access_token) {
          const tmpClient = axios.create({ baseURL: runtimeBase, headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } })
          return await fetchEdxCourseWithClient(courseId, tmpClient)
        }
        // If we reached here the token exchange returned no access_token
        const err: any = new Error('edX token exchange failed with provided credentials')
        err.status = 401
        throw err
      } catch (e: any) {
        // Surface authentication failure explicitly
        const status = e && e.response && (e.response.status === 401 || e.response.status === 403) ? e.response.status : (e && e.status ? e.status : 401)
        const err: any = new Error('edX authentication failed: ' + (e && e.message ? e.message : 'invalid credentials'))
        err.status = status
        throw err
      }
    }
    if (runtimeToken) {
      const tmpClient = axios.create({ baseURL: runtimeBase, headers: { Authorization: `Bearer ${runtimeToken}` } })
      return await fetchEdxCourseWithClient(courseId, tmpClient)
    }
    // No tokens present but runtime creds specify a base URL — use an unauthenticated client against that base (do not fall back to env/global client)
    return await fetchEdxCourseWithClient(courseId, unauthClient)
  }
  // No runtime creds provided: fall back to global client
  return await fetchEdxCourseWithClient(courseId, client)
}

// Simple listing/search helper for the dev server. Tries multiple discovery
// endpoints and returns a compact array of course meta objects.
export async function listEdxCourses(query: string = '', limit: number = 25, creds?: any) {
  try {
    if (query && query.includes('course-v1:')) {
      try {
        const single = await fetchEdxCourse(query, creds)
        if (single && single.course) {
          return [{ id: single.course.id, name: single.course.name || single.course.title || null, org: single.course.org || null, number: single.course.number || null, short_description: single.course.short_description || single.course.description || null }]
        }
      } catch (e) { /* ignore */ }
    }

    const params: string[] = []
    if (query) params.push(`search=${encodeURIComponent(query)}`)
    params.push(`page_size=${encodeURIComponent(limit)}`)
    const qs = params.length ? `?${params.join('&')}` : ''

    const endpoints = [
      `/api/courses/v1/courses/${qs}`,
      `/api/course_discovery/v1/courses/${qs}`,
      `/api/courses/v1/course_runs/${qs}`,
      `/api/publisher/v1/courses/${qs}`,
    ]

    // If runtime creds provided, use a temporary client
    let tmpClient = client
    if (creds && (creds.baseUrl || creds.accessToken)) {
      try {
        tmpClient = axios.create({ baseURL: creds.baseUrl || process.env.EDX_BASE_URL || process.env.BASE_URL || EDX_BASE, headers: { Authorization: creds.accessToken ? `Bearer ${creds.accessToken}` : undefined } })
      } catch (e) { tmpClient = client }
    }

    let body: any = null
    for (const ep of endpoints) {
      try {
        const r = await tmpClient.get(ep).catch(() => ({ data: null }))
        if (r && r.data) { body = r.data; break }
      } catch (e) {
        // ignore and try next
      }
    }

    const items = Array.isArray(body) ? body : (Array.isArray(body?.results) ? body.results : (body && body.courses ? body.courses : []))
    const mapped = (items || []).map((c: any) => ({
      id: c.id || c.course_id || c.key || null,
      name: c.name || c.title || c.display_name || null,
      org: c.org || c.organization || null,
      number: c.number || c.code || c.course_number || null,
      short_description: c.short_description || c.description || c.summary || null,
    })).filter(Boolean).slice(0, limit)
    return mapped
  } catch (e) {
    return []
  }
}

export default { fetchEdxCourse, listEdxCourses }
