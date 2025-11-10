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

const SERVER = process.env.MOODLE_API_SERVER || process.env.MOODLE_BASE_URL || 'http://localhost:8000'
const TOKEN = process.env.MOODLE_ACCESS_TOKEN || process.env.MOODLE_TOKEN || process.env.ACCESS_TOKEN
const client = axios.create({ baseURL: SERVER, headers: { 'Authorization': TOKEN ? `Bearer ${TOKEN}` : undefined } })

/**
 * Fetch a single Moodle course with all details
 */
export async function fetchMoodleCourse(courseId: string) {
  if (!courseId) throw new Error('courseId required')

  const raw: any = { id: courseId, fullname: 'unknown', category: undefined, students: [], teachers: [], activities: [] }

  // Helper that mirrors the script's `api` function
  async function api(pathStr: string) {
    try {
      const res = await client.get(pathStr)
      return res.data
    } catch (err: any) {
      // normalize to throw like script would
      const msg = err && err.response && err.response.data ? JSON.stringify(err.response.data) : (err && err.message) || String(err)
      throw new Error(msg)
    }
  }

  try {
    // course and students/quizzes are expected under /api/* endpoints in the scripts
    const course = await api(`/api/courses/${encodeURIComponent(courseId)}`).catch(() => null)
    if (course) {
      raw.fullname = course.course?.name || course.course?.fullname || course.course || raw.fullname
      raw.category = course.course?.category || raw.category
      raw.students = Array.isArray(course.students) ? course.students.map((s: any) => ({ id: s.id, email: s.email, fullname: s.name || s.fullname })) : (course.students || [])
      raw.teachers = course.teachers || []
      const quizzes = course.quizzes || []

      for (const q of quizzes) {
        // fetch questions and per-student attempts like the script
        const questionsResp = await api(`/api/quizzes/${q.id}/questions?includeAnswers=true`).catch(() => ({ questions: [], totalQuestions: 0 }))
        const attemptsPerStudent: Record<string, any[]> = {}

        for (const s of raw.students) {
          const attempts = await api(`/api/students/${s.id}/quiz/${q.id}/attempts`).catch(() => ({ attempts: [] }))
          attemptsPerStudent[s.id] = attempts.attempts || []
          for (const a of attemptsPerStudent[s.id]) {
            const attemptDetail = await api(`/api/attempts/${a.id}`).catch(() => null)
            a.detail = attemptDetail
          }
        }

        const submissions: any[] = []
        for (const s of raw.students) {
          const userAttempts = attemptsPerStudent[s.id] || []
          if (!userAttempts.length) {
            submissions.push({ userid: s.id, grade: null, timemodified: null })
          } else {
            const best = userAttempts.reduce((b, c) => (c.sumGrades > (b.sumGrades || 0) ? c : b), userAttempts[0])
            const timemod = best.timeFinish || best.timestart || best.timefinish || best.timeFinish || null
            submissions.push({ userid: s.id, grade: best.sumGrades ?? best.grade ?? null, timemodified: timemod, percentage: best.percentage ?? null })
          }
        }

        raw.activities.push({ id: q.id, modname: 'quiz', name: q.name, maxgrade: q.maxGrade, submissions, question_count: questionsResp.totalQuestions || (questionsResp.questions || []).length, modid: q.id })
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
export async function listMoodleCourses(query: string = '', limit: number = 25): Promise<any[]> {
  try {
    // Fetch list of courses from Moodle API
    const res = await client.get('/api/courses')
    const courses = Array.isArray(res.data) ? res.data : (res.data?.courses || [])
    
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
    console.error('[Moodle Connector] Error listing courses:', e)
    return []
  }
}

export default { fetchMoodleCourse, listMoodleCourses }
