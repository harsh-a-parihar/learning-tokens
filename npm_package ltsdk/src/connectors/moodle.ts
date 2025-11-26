import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'

// Load Moodle env if present - try multiple possible locations
try {
  dotenv.config({ path: path.resolve(process.cwd(), '../../LMS/Moodle/.env') })
} catch (e) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), '../../LMS/moodle/.env') })
  } catch (e) { }
}

// Recognize multiple env var names used across setups: prefer explicit API server,
// then legacy BASE var, then the common `MOODLE_URL` used in .env files.
const SERVER = process.env.MOODLE_API_SERVER || process.env.MOODLE_BASE_URL || process.env.MOODLE_URL || 'http://localhost:8000'
const TOKEN = process.env.MOODLE_ACCESS_TOKEN || process.env.MOODLE_TOKEN || process.env.ACCESS_TOKEN
const client = axios.create({ baseURL: SERVER, headers: { 'Authorization': TOKEN ? `Bearer ${TOKEN}` : undefined } })

/**
 * Fetch a single Moodle course with all details
 */
export async function fetchMoodleCourse(courseId: string, creds?: any) {
  if (!courseId) throw new Error('courseId required')

  // Build axios client from runtime creds if provided, otherwise fall back to environment
  const base = (creds && creds.baseUrl) || SERVER
  const token = (creds && (creds.accessToken || creds.apiToken || creds.token)) || TOKEN
  const localClient = axios.create({ baseURL: base, headers: { 'Authorization': token ? `Bearer ${token}` : undefined } })

  const raw: any = { id: courseId, fullname: 'unknown', category: undefined, students: [], teachers: [], activities: [] }

  // Helper that mirrors the script's `api` function
  async function api(pathStr: string) {
    try {
      const res = await localClient.get(pathStr)
      return res.data
    } catch (err: any) {
      // normalize to throw like script would
      const msg = err && err.response && err.response.data ? JSON.stringify(err.response.data) : (err && err.message) || String(err)
      throw new Error(msg)
    }
  }

  // Also expose an environment-backed client that points to the configured
  // `SERVER` (useful when a local dev proxy exposes `/api/...` endpoints).
  const envClient = axios.create({ baseURL: SERVER, headers: { 'Authorization': TOKEN ? `Bearer ${TOKEN}` : undefined } })

  // Try `/api/*` on the envClient first (dev proxy), then fall back to localClient
  async function apiWithFallback(pathStr: string) {
    try {
      const res = await envClient.get(pathStr).catch(() => null)
      if (res && res.data !== undefined) return res.data
    } catch (e) { /* ignore envClient errors */ }
    // try runtime client (may be same as envClient)
    try {
      const res2 = await localClient.get(pathStr).catch(() => null)
      if (res2 && res2.data !== undefined) return res2.data
    } catch (e) { /* ignore */ }
    // return null to indicate missing
    return null
  }

  try {
    // course and students/quizzes are expected under /api/* endpoints in the scripts
    let course = await api(`/api/courses/${encodeURIComponent(courseId)}`).catch(() => null)

    // If the dev proxy /api/courses/:id is not present (common), fall back to Moodle REST webservice
    if (!course) {
      try {
        const restRes = await localClient.get('/webservice/rest/server.php', {
          params: {
            wsfunction: 'core_course_get_courses_by_field',
            field: 'id',
            value: courseId,
            moodlewsrestformat: 'json',
            wstoken: token
          }
        }).catch(() => null)
        if (restRes && restRes.data) {
          // Moodle may return an object with `courses` or an array directly
          const arr = Array.isArray(restRes.data) ? restRes.data : (restRes.data.courses || [])
          if (arr && arr.length) {
            const c = arr[0]
            course = { course: c, students: [], teachers: [], quizzes: [] }
          }
        }
      } catch (e) { /* ignore fallback failure */ }
    }

    if (course) {
      raw.fullname = course.course?.name || course.course?.fullname || course.course || raw.fullname
      raw.category = course.course?.category || raw.category

      // Attempt to fetch enrolled users via webservice if not provided by proxy
      if ((!course.students || !course.students.length) && token) {
        try {
          const studentsRes = await localClient.get('/webservice/rest/server.php', {
            params: { wsfunction: 'core_enrol_get_enrolled_users', courseid: courseId, moodlewsrestformat: 'json', wstoken: token }
          }).catch(() => null)
          const studs = studentsRes && studentsRes.data ? (Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes.data.users || [])) : []
          raw.students = Array.isArray(studs) ? studs.map((s: any) => ({ id: s.id, email: s.email, fullname: s.fullname || s.name })) : []
        } catch (e) { /* ignore */ }
      } else {
        raw.students = Array.isArray(course.students) ? course.students.map((s: any) => ({ id: s.id, email: s.email, fullname: s.name || s.fullname })) : (course.students || [])
      }

      raw.teachers = course.teachers || []
      let quizzes = course.quizzes || []

      // If we're using REST fallback (no proxy) try to fetch quizzes and assignments via Moodle Webservice
      if ((!quizzes || quizzes.length === 0) && token) {
        try {
          // Get quizzes by course via wsfunction (accepts array param courseids[0]=id)
          const quizzesRes = await localClient.get('/webservice/rest/server.php', {
            params: {
              wsfunction: 'mod_quiz_get_quizzes_by_courses',
              'courseids[0]': courseId,
              moodlewsrestformat: 'json',
              wstoken: token
            }
          }).catch(() => null)
          const qarr = quizzesRes && quizzesRes.data ? (quizzesRes.data.quizzes || []) : []
          // Assignments
          const assignsRes = await localClient.get('/webservice/rest/server.php', {
            params: {
              wsfunction: 'mod_assign_get_assignments',
              'courseids[0]': courseId,
              moodlewsrestformat: 'json',
              wstoken: token
            }
          }).catch(() => null)
          const assignList = assignsRes && assignsRes.data ? (assignsRes.data.courses && assignsRes.data.courses[0] ? (assignsRes.data.courses[0].assignments || []) : []) : []

          // incorporate quizzes and assignments into quizzes variable to later build activities
          course.quizzes = qarr || []
          course.assignments = assignList || []
          quizzes = course.quizzes || []
        } catch (e) {
          // ignore; we'll still return students/teachers
        }
      }

      for (const q of quizzes) {
        // fetch questions and per-student attempts like the script
        const questionsResp = (await apiWithFallback(`/api/quizzes/${q.id}/questions?includeAnswers=true`)) || { questions: [], totalQuestions: 0 }
        const attemptsPerStudent: Record<string, any[]> = {}

        for (const s of raw.students) {
          const attempts = (await apiWithFallback(`/api/students/${s.id}/quiz/${q.id}/attempts`)) || { attempts: [] }
          attemptsPerStudent[s.id] = attempts.attempts || []

          // If the dev-proxy didn't provide attempts, try Moodle REST webservice
          // functions (requires token permissions) to fetch attempts per user.
          if ((!attemptsPerStudent[s.id] || attemptsPerStudent[s.id].length === 0) && token) {
            try {
              // Try multiple possible WS function names because some Moodle
              // installs or dev scripts expose different function names.
              const candidateFns = ['mod_quiz_get_user_attempts', 'mod_quiz_get_user_quiz_attempts', 'mod_quiz_get_user_attempts_by_user', 'mod_quiz_get_user_attempts_by_quiz'];
              let restAttempts: any[] = []
              for (const fnName of candidateFns) {
                try {
                  const res = await localClient.get('/webservice/rest/server.php', {
                    params: {
                      wsfunction: fnName,
                      quizid: q.id,
                      userid: s.id,
                      moodlewsrestformat: 'json',
                      wstoken: token
                    }
                  }).catch(() => null)
                  if (process.env.LTSDK_DEBUG === 'true') {
                    try { console.log('[Moodle Connector] WS', fnName, 'response preview:', res && res.data ? JSON.stringify(res.data).slice(0, 500) : null) } catch (e) { }
                  }
                  const attemptsArr = res?.data ? (res.data.attempts || res.data || []) : []
                  if (Array.isArray(attemptsArr) && attemptsArr.length) { restAttempts = attemptsArr; break }
                  // Some functions return an object with `attempts` prop, others may return arrays directly
                  if (Array.isArray(res?.data)) { restAttempts = res!.data; break }
                } catch (e) {
                  // try next candidate
                }
              }
              attemptsPerStudent[s.id] = restAttempts || []
            } catch (e) { /* ignore */ }
          }

          for (const a of attemptsPerStudent[s.id]) {
            // Try to fetch rich attempt detail via dev-proxy first, then fall back
            // to Moodle REST `mod_quiz_get_attempt_data` which returns question-level data.
            let attemptDetail = await apiWithFallback(`/api/attempts/${a.id}`)
            if ((!attemptDetail || Object.keys(attemptDetail).length === 0) && token) {
              try {
                const attemptDataRes = await localClient.get('/webservice/rest/server.php', {
                  params: {
                    wsfunction: 'mod_quiz_get_attempt_data',
                    attemptid: a.id,
                    page: -1,
                    moodlewsrestformat: 'json',
                    wstoken: token
                  }
                }).catch(() => null)
                if (process.env.LTSDK_DEBUG === 'true') {
                  try { console.log('[Moodle Connector] mod_quiz_get_attempt_data preview:', attemptDataRes && attemptDataRes.data ? JSON.stringify(attemptDataRes.data).slice(0, 500) : null) } catch (e) { }
                }
                // If attempt_data reports the attempt is already closed, use attempt_review
                if (attemptDataRes && attemptDataRes.data && attemptDataRes.data.exception && attemptDataRes.data.errorcode === 'attemptalreadyclosed') {
                  try {
                    const reviewRes = await localClient.get('/webservice/rest/server.php', {
                      params: {
                        wsfunction: 'mod_quiz_get_attempt_review',
                        attemptid: a.id,
                        moodlewsrestformat: 'json',
                        wstoken: token
                      }
                    }).catch(() => null)
                    if (process.env.LTSDK_DEBUG === 'true') {
                      try { console.log('[Moodle Connector] mod_quiz_get_attempt_review preview:', reviewRes && reviewRes.data ? JSON.stringify(reviewRes.data).slice(0, 500) : null) } catch (e) { }
                    }
                    attemptDetail = reviewRes && reviewRes.data ? reviewRes.data : attemptDetail
                  } catch (e) { /* ignore */ }
                } else {
                  attemptDetail = attemptDataRes && attemptDataRes.data ? attemptDataRes.data : attemptDetail
                }
              } catch (e) { /* ignore */ }
            }
            a.detail = attemptDetail
          }
        }

        const submissions: any[] = []
        for (const s of raw.students) {
          const userAttempts = attemptsPerStudent[s.id] || []
          if (userAttempts.length) {
            const best = userAttempts.reduce((b, c) => {
              const bScore = (b && (b.sumgrades ?? b.sumGrades ?? b.grade ?? b.score)) || 0
              const cScore = (c && (c.sumgrades ?? c.sumGrades ?? c.grade ?? c.score)) || 0
              return (cScore > bScore) ? c : b
            }, userAttempts[0])
            const timemod = best.timeFinish || best.timestart || best.timefinish || best.timeFinish || null
            const scoreVal = (best && (best.sumgrades ?? best.sumGrades ?? best.grade ?? best.score ?? null))
            const percentage = best.percentage ?? best.perc ?? null
            submissions.push({ userid: s.id, grade: scoreVal != null ? Number(scoreVal) : null, timemodified: timemod, percentage })
          } else {
            // no attempts available for this student — do not fabricate placeholder entries
          }
        }

        const qc = questionsResp ? (questionsResp.totalQuestions || (questionsResp.questions || []).length || undefined) : undefined
        // Normalize quiz max grade from common Moodle response fields
        const quizMax = q.sumgrades ?? q.grade ?? q.maxGrade ?? q.max_grade ?? null
        raw.activities.push({ id: q.id, modname: 'quiz', name: q.name, maxgrade: quizMax, submissions: submissions.length ? submissions : [], question_count: qc, modid: q.id })
      }

      // If assignments were provided via REST fallback, add them as activities
      const assigns = course.assignments || []
      if (assigns && assigns.length) {
        for (const a of assigns) {
          // Try to fetch real submissions for this assignment via dev-proxy
          let submissions: any[] = []
          try {
            const proxyRes = await apiWithFallback(`/api/assignments/${a.id}/submissions`)
            if (proxyRes && Array.isArray(proxyRes.submissions)) submissions = proxyRes.submissions
          } catch (e) { /* ignore */ }

          // Fallback to Moodle REST webservice `mod_assign_get_submissions`
          if ((!submissions || submissions.length === 0) && token) {
            try {
              const assignsRes = await localClient.get('/webservice/rest/server.php', {
                params: {
                  wsfunction: 'mod_assign_get_submissions',
                  'assignmentids[0]': a.id,
                  moodlewsrestformat: 'json',
                  wstoken: token
                }
              }).catch(() => null)
              if (assignsRes && assignsRes.data) {
                // Response shape varies: try assignments[0].submissions or data.submissions
                const arr = assignsRes.data.assignments || assignsRes.data
                if (Array.isArray(arr) && arr.length) {
                  const candidate = arr[0]
                  if (candidate.submissions && Array.isArray(candidate.submissions)) submissions = candidate.submissions
                }
                // Some installs return an object with submissions directly
                if (!submissions.length && Array.isArray(assignsRes.data.submissions)) submissions = assignsRes.data.submissions
              }
            } catch (e) { /* ignore */ }
          }

          // Normalize submissions to minimal shape expected by adapter
          const normalizedSubs = Array.isArray(submissions) && submissions.length ? submissions.map((sub: any) => ({ userid: sub.userid ?? sub.user ?? sub.userId ?? sub.user_id, grade: sub.grade ?? (sub.grades && sub.grades[0] && sub.grades[0].grade) ?? null, timemodified: sub.timemodified ?? sub.timecreated ?? null, status: sub.status ?? undefined })) : []

          raw.activities.push({ id: a.id || a.assignmentid || a.cmid || a.name, modname: 'assign', name: a.name || a.assignment || a.description || `Assignment ${a.id || a.cmid}`, maxgrade: a.maxgrade || a.grade || null, submissions: normalizedSubs })
        }
      }
    }
  } catch (e) {
    // Non-fatal: preserve partial raw object
  }

  return raw
}

/**
 * List/search Moodle courses
 */
export async function listMoodleCourses(query: string = '', limit: number = 25, creds?: any): Promise<any[]> {
  try {
    // Build axios client from runtime creds if provided, otherwise fall back to environment
    const base = (creds && creds.baseUrl) || SERVER
    const token = (creds && (creds.accessToken || creds.apiToken || creds.token)) || TOKEN
    const localClient = axios.create({ baseURL: base, headers: { 'Authorization': token ? `Bearer ${token}` : undefined } })

    // Try Moodle's standard REST webservice first (common Moodle installs)
    let courses: any[] = []
    try {
      const restRes = await localClient.get('/webservice/rest/server.php', { params: { wsfunction: 'core_course_get_courses', moodlewsrestformat: 'json', wstoken: token } }).catch(() => null)
      if (process.env.LTSDK_DEBUG === 'true') {
        try {
          console.log('[Moodle Connector] REST response status:', restRes && restRes.status)
          console.log('[Moodle Connector] REST response type:', restRes && restRes.data ? (Array.isArray(restRes.data) ? 'array' : typeof restRes.data) : null)
          try { console.log('[Moodle Connector] REST response preview:', restRes && restRes.data ? JSON.stringify(restRes.data).slice(0, 800) : null) } catch (err) { }
        } catch (err) { }
      }
      if (restRes && restRes.data) {
        if (Array.isArray(restRes.data)) {
          courses = restRes.data
        } else if (Array.isArray(restRes.data.courses)) {
          courses = restRes.data.courses
        }
      }
    } catch (er) {
      // ignore and fall back
    }

    // Fallback: some dev Moodle scripts expose a simple /api/courses endpoint
    if (!courses.length) {
      const res = await localClient.get('/api/courses').catch(() => null)
      courses = res ? (Array.isArray(res.data) ? res.data : (res.data?.courses || [])) : []
    }

    // Apply search filter if query provided
    const filtered = query ? courses.filter((c: any) =>
      (c.fullname && c.fullname.toLowerCase().includes(query.toLowerCase())) ||
      (c.shortname && c.shortname.toLowerCase().includes(query.toLowerCase())) ||
      (c.id && String(c.id).includes(query))
    ) : courses

    return filtered.slice(0, limit).map((c: any) => ({
      id: c.id || null,
      name: c.fullname || c.shortname || null,
      shortname: c.shortname || null,
      category: c.category || null,
      summary: c.summary || null
    }))
  } catch (e) {
    if (process.env.LTSDK_DEBUG === 'true') {
      console.error('[Moodle Connector] Error listing courses:', e)
    }
    return []
  }
}

export default { fetchMoodleCourse, listMoodleCourses }
