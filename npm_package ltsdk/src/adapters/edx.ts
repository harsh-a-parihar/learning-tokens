import { NormalizedPayload, Person, Course, Institution, Assessment, AssessmentItem, AssessmentResult, ChatChannel } from '../types'
import { ensureIso, createDiagnostics } from '../utils'

type RawEdxCourse = any

export async function normalizeEdx(raw: RawEdxCourse): Promise<NormalizedPayload> {
  // Raw is expected to possibly contain course, staff, students, gradebook, discussions
  const source = {
    lms: 'edx' as const,
    rawCourseId: raw?.course?.id || raw?.id || raw?.course_id,
    fetchedAt: new Date().toISOString()
  }

  const institution: Institution | undefined = raw?.institution
    ? { id: raw.institution.id || raw.institution.org || undefined, name: raw.institution.name }
    : undefined

  const courseId = raw?.course?.id ?? raw?.course_id ?? raw?.id ?? raw?.courseId
  const normalizedCourseId = courseId !== undefined && courseId !== null ? String(courseId) : 'NA'
  const course: Course = {
    id: normalizedCourseId,
    name: raw?.course?.name || raw?.course?.display_name || undefined,
    startDate: ensureIso(raw?.course?.start) || raw?.course?.start || undefined,
    endDate: ensureIso(raw?.course?.end) || raw?.course?.end || undefined,
    // include some useful top-level course fields inside metadata for downstream use
    metadata: Object.assign({}, raw?.course?.metadata || {}, {
      number: raw?.course?.number,
      org: raw?.course?.org,
      short_description: raw?.course?.short_description
    })
  } as Course

  // Start with explicit staff/instructors provided by the raw payload
  const instructors: Person[] = (raw?.staff || raw?.instructors || []).map((s: any) => ({
    id: s.id || s.username || s.email,
    email: s.email,
    username: s.username,
    name: s.name || s.display_name
  }))

  // Some connectors return enrollments under `students` or `learners` and
  // include role information (teacher/instructor) in those entries. We'll
  // separate those out and promote them into the instructors list.
  const rawEnrollments: any[] = (raw?.students || raw?.learners || [])
  const learnersRaw: any[] = []
  for (const e of rawEnrollments) {
    // enrollment objects can vary; detect instructor-like entries using several heuristics
    const nestedUser = e && typeof e.user === 'object' ? e.user : null
    const roleField = (e.role || e.user_role || (e.roles && (Array.isArray(e.roles) ? e.roles.join(',') : e.roles)) || (nestedUser && nestedUser.role) || '')
    const isStaffFlag = Boolean(e.is_staff || e.is_active_staff || (nestedUser && (nestedUser.is_staff || nestedUser.is_active_staff)))
    const roleStr = String(roleField || '').toLowerCase()
    const looksLikeInstructor = isStaffFlag || /instructor|teacher|staff|admin/.test(roleStr)

    if (looksLikeInstructor) {
      // map enrollment/user to Person shape and add to instructors if not duplicate
      const cand = nestedUser || e
      const p: Person = { id: cand.id || cand.username || cand.email, email: cand.email, username: cand.username, name: cand.name || cand.display_name || (cand.first_name ? `${cand.first_name} ${cand.last_name || ''}`.trim() : undefined) }
      // avoid duplicates (simple by id/email/username)
      const key = String(p.id || p.username || p.email || '')
      if (key && !instructors.some(ins => String(ins.id || ins.username || ins.email || '') === key)) instructors.push(p)
      // do not add to learnersRaw
    } else {
      learnersRaw.push(e)
    }
  }
  // Build learners list but prefer numeric/profile id when present and ensure username/name fields exist
  const learners: Person[] = learnersRaw
    .map((u: any) => {
      const nested = u && typeof u.user === 'object' ? u.user : undefined
      const rawCanonical = u.id ?? nested?.id ?? undefined
      const canonicalId = rawCanonical !== undefined && rawCanonical !== null ? String(rawCanonical) : undefined
      const username = u.username || nested?.username || (u.email ? u.email.split('@')[0] : undefined)
      const email = u.email || nested?.email || undefined
      const name = u.name || nested?.name || nested?.full_name || u.display_name || undefined
      const time_enrolled =
        ensureIso(u.created) ||
        ensureIso(u.enrolled_at) ||
        ensureIso(u.enrollment_date) ||
        ensureIso(nested?.created) ||
        ensureIso(nested?.enrolled_at) ||
        undefined

      // Skip learners that have no identifying information at all
      if (!canonicalId && !username && !email) return undefined

      return { id: canonicalId, email, username, name, time_enrolled }
    })
    .filter(Boolean) as Person[]

  const assessments: Assessment[] = []
  if (raw?.gradebook && Array.isArray(raw.gradebook)) {
    raw.gradebook.forEach((item: any) => {
      const asm: Assessment = {
        id: item.id || item.name,
        type: item.type || 'assessment',
        title: item.name || item.display_name,
        maxScore: item.max_score || item.out_of || undefined,
        items: (item.questions || []).map((q: any) => ({ qId: q.id || q.name, question: q.text, type: q.type })) as AssessmentItem[],
        results: (item.scores || []).map((r: any) => ({ learnerId: r.username || r.user_id || r.email, score: r.score, maxScore: item.max_score })) as AssessmentResult[]
      }
      assessments.push(asm)
    })
  }

  // If gradebook is in tutor's per-user-results shape (each entry is a user with section_breakdown),
  // we'll handle that later when building per-learner assignments.

  // Build per-learner assignments from gradebook (convert assessment.results -> learners[].assignments)
  // Index learners by their canonical id (which may be numeric). Also build a username->id map for lookups.
  const learnersMap: Record<string, any> = {}
  const usernameToKey: Record<string, string> = {}
  const assignmentMaxScores: Record<string, number> = {} // Track max score for each assignment
  learners.forEach((l: any) => {
    const key = l.id ?? l.username ?? l.email
    if (!key) return
    const keyStr = String(key)
    learnersMap[keyStr] = { id: l.id, email: l.email, username: l.username, name: l.name, time_enrolled: l.time_enrolled, assignments: [] }
    if (l.username) usernameToKey[String(l.username)] = keyStr
  })

  if (Array.isArray(raw?.gradebook)) {
    // Determine whether gradebook entries are per-assessment (with .scores arrays)
    // or per-user (with username and section_breakdown). We'll handle both.
    const first = raw.gradebook[0]
    if (first && first.username && Array.isArray(first.section_breakdown)) {
      // First pass: collect max scores for each assignment across all students
      for (const userRes of raw.gradebook) {
        if (Array.isArray(userRes.section_breakdown)) {
          for (const sec of userRes.section_breakdown) {
            const asmId = sec.module_id || sec.id || sec.label || sec.subsection_name
            const scorePossible = sec.score_possible || sec.possible || sec.max_score || 0
            if (asmId && scorePossible > 0) {
              assignmentMaxScores[asmId] = Math.max(assignmentMaxScores[asmId] || 0, scorePossible)
            }
          }
        }
      }

      // Second pass: per-user results: iterate users and create assignments from section_breakdown
      for (const userRes of raw.gradebook) {
        // gradebook user entry may reference username or email; resolve to canonical id when possible
        const refUsername = userRes.username || userRes.user || null
        const refEmail = userRes.email || null
        let learnerId: string | undefined = undefined
        if (refUsername && usernameToKey[refUsername] !== undefined) learnerId = usernameToKey[refUsername]
        else if (userRes.user_id) learnerId = String(userRes.user_id)
        else if (refEmail) {
          // try to find by email in learnersMap
          const foundEntry = Object.entries(learnersMap).find(([, ll]: [string, any]) => ll.email === refEmail)
          if (foundEntry) learnerId = foundEntry[0]
        }
        // fallback to raw username/email if no mapping found
        if (learnerId === undefined) learnerId = refUsername || (userRes.user_id ? String(userRes.user_id) : undefined) || refEmail
        if (!learnerId) continue
        if (!learnersMap[learnerId]) {
          learnersMap[learnerId] = {
            id: String(learnerId),
            email: userRes.email || refEmail || undefined,
            username: userRes.username || refUsername || undefined,
            name: userRes.name || userRes.full_name || undefined,
            time_enrolled: ensureIso(userRes.created) || ensureIso(userRes.enrolled_at) || ensureIso(userRes.enrollment_date) || undefined,
            assignments: []
          }
        }

        const sections = userRes.section_breakdown || []
        for (const sec of sections) {
          const asmId = sec.module_id || sec.label || sec.subsection_name || `${userRes.username}:${sec.label}`
          const title = sec.label || sec.subsection_name || 'assignment'
          const scoreEarned = sec.score_earned != null ? sec.score_earned : (sec.score_earned === 0 ? 0 : null)
          const scorePossible = sec.score_possible != null ? sec.score_possible : null
          const percentage = (scoreEarned != null && scorePossible) ? Number(((scoreEarned / scorePossible) * 100).toFixed(2)) : (sec.percent != null ? Number((sec.percent * 100).toFixed(2)) : null)

          const submissionObj: any = {
            // try multiple possible timestamp fields if present (best-effort)
            submitted_at: ensureIso(sec.submitted_at) || ensureIso(sec.submission_timestamp) || ensureIso(sec.submitted_at_iso) || undefined,
            workflow_state: sec.attempted ? 'submitted' : 'not_attempted',
            grades: [{ score: scoreEarned, totalscore: scorePossible, percentage }]
          }

          // Merge in any submissionsMap timestamps (connector may have fetched per-block attempts)
          try {
            const submissionsMap = raw && raw.submissionsMap || {}
            const mid = sec.module_id
            if (mid && submissionsMap[mid]) {
              // prefer username mapping, then user_id mapping
              const userKeyCandidates = [userRes.username, userRes.user_id, userRes.user, userRes.email]
              for (const k of userKeyCandidates) {
                if (!k) continue
                const ts = submissionsMap[mid][String(k)] || submissionsMap[mid][String(k).toLowerCase()]
                if (ts) {
                  submissionObj.submitted_at = ensureIso(ts) || ts
                  break
                }
              }
            }
          } catch (e) {
            // ignore merging errors
          }

          // Use the tracked max score for this assignment, or fall back to current score_possible
          const actualMaxScore = assignmentMaxScores[asmId] || scorePossible || 0

          const assignmentObj: any = {
            id: asmId,
            // prefer the raw category (Homework/Quiz/etc.) when present
            type: sec.category || 'assessment',
            title,
            maxScore: actualMaxScore,
            subsection_name: sec.subsection_name || sec.label || undefined,
            is_quiz_assignment: (sec.category && sec.category.toLowerCase() === 'quiz') || false,
            submissions: [submissionObj]
          }

          // Only include total_questions if we have genuine data from the API
          // (edX gradebook doesn't provide question count, so we don't add fake estimates)

          // ensure the learner entry has name/email/username when possible
          const lm = learnersMap[learnerId]
          lm.email = lm.email || userRes.email || undefined
          lm.username = lm.username || refUsername || undefined
          lm.name = lm.name || userRes.name || userRes.full_name || undefined
          lm.time_enrolled = lm.time_enrolled || ensureIso(userRes.enrolled_at) || ensureIso(userRes.enrollment_date) || ensureIso(userRes.created) || undefined
          lm.time_enrolled = lm.time_enrolled || ensureIso(userRes.enrolled_at) || ensureIso(userRes.enrollment_date) || ensureIso(userRes.created) || undefined
          learnersMap[learnerId].assignments.push(assignmentObj)
        }
      }
    } else {
      // fallback to per-assessment shape handled earlier: assessments with .scores
      for (const item of raw.gradebook) {
        const asmId = item.id || item.name
        const maxScore = item.max_score || item.out_of || null
        const questions = item.questions || []

        const results = item.scores || []
        for (const r of results) {
          let learnerId: string | undefined = undefined
          if (r.username && usernameToKey[String(r.username)]) learnerId = usernameToKey[String(r.username)]
          else learnerId = r.username || r.user_id || r.email
          if (!learnerId) continue
          if (!learnersMap[learnerId]) learnersMap[learnerId] = { id: learnerId, email: undefined, username: undefined, name: undefined, time_enrolled: undefined, assignments: [] }

          const score = r.score ?? null
          const totalscore = maxScore
          const percentage = (score != null && totalscore) ? ((parseFloat(score) / parseFloat(totalscore)) * 100) : null

          const submissionObj: any = {
            submitted_at: ensureIso(r.submitted_at) || undefined,
            workflow_state: r.state || r.status || 'graded',
            grades: [{ score: score, totalscore: totalscore, percentage: percentage != null ? Number(percentage.toFixed ? percentage.toFixed(2) : percentage) : null }]
          }

          // question-level answers if present in result (e.g., r.answers)
          const qDetails: any[] = []
          if (Array.isArray(r.answers)) {
            r.answers.forEach((a: any, idx: number) => {
              qDetails.push({ id: a.id || a.qid || idx + 1, type: a.type || 'unknown', answer: a.answer || a.text || a.value })
            })
          }
          if (qDetails.length) submissionObj.questions = qDetails

          const assignmentObj: any = {
            id: asmId,
            type: 'assessment',
            title: item.name || item.display_name,
            maxScore: maxScore,
            is_quiz_assignment: !!qDetails.length,
            submissions: [submissionObj]
          }

          // Only include total_questions if we have genuine data from responses or questions array
          const actualQuestionCount = qDetails.length || (Array.isArray(questions) ? questions.length : 0)
          if (actualQuestionCount > 0) {
            assignmentObj.total_questions = actualQuestionCount
          }

          // Update learner data if we have more information in the result
          const lm = learnersMap[learnerId]
          lm.email = lm.email || r.email || undefined
          lm.username = lm.username || r.username || undefined
          lm.name = lm.name || r.name || r.full_name || undefined
          lm.time_enrolled = lm.time_enrolled || ensureIso(r.enrolled_at) || ensureIso(r.enrollment_date) || ensureIso(r.created) || undefined

          learnersMap[learnerId].assignments.push(assignmentObj)
        }
      }
    }
  }

  // Convert learnersMap back to array and merge into payload
  let learnersOut = Object.values(learnersMap).map((l: any) => ({ id: l.id, email: l.email, username: l.username, name: l.name, time_enrolled: l.time_enrolled, assignments: l.assignments }))

  // Deduplicate learners: prefer real users (with numeric/string ids, usernames, or emails)
  const seenIds = new Set<string>()
  const deduped: any[] = []
  // prefer entries with assignments and with non-anon ids
  learnersOut.forEach((l: any) => {
    const keyCandidates: string[] = []
    if (l.id) keyCandidates.push(`id:${l.id}`)
    if (l.username) keyCandidates.push(`username:${l.username}`)
    if (l.email) keyCandidates.push(`email:${l.email}`)
    const already = keyCandidates.some(k => seenIds.has(k))
    if (already) return

    keyCandidates.forEach(k => seenIds.add(k))
    deduped.push(l)
  })
  learnersOut = deduped

  // Extract instructor entries from learnersOut when they appear there.
  // Build instructorsOut from raw instructors list and map to frontend format.
  // We intentionally do NOT attach `assignments` to instructors here —
  // assignments remain under learners. The adapter will only expose
  // instructor identity and contact fields.
  const instructorsOut: any[] = (instructors || []).map((ins: any) => {
    const id = ins && (ins.id || ins.username || ins.email)
    return {
      instructor_id: id ? String(id) : undefined,
      instructor_username: ins.username || undefined,
      instructor_name: ins.name || ins.display_name || undefined,
      instructor_email: ins.email || undefined
    }
  })

  // Helper to match learner entry by id/username/email
  function matchLearnerIndexByInstructor(ins: any) {
    const keys = [String(ins.id || ''), String(ins.username || ''), String(ins.email || '')].filter(Boolean)
    for (let i = 0; i < learnersOut.length; i++) {
      const l = learnersOut[i]
      const lk = [String(l.id || ''), String(l.username || ''), String(l.email || '')].filter(Boolean)
      if (keys.some(k => lk.includes(k))) return i
    }
    return -1
  }

  // Remove learner entries that match instructor identities to avoid duplicates.
  // Assignments remain with learners only, not copied to instructors.
  for (const insObj of instructorsOut) {
    const idx = matchLearnerIndexByInstructor({ id: insObj.instructor_id, username: insObj.instructor_username, email: insObj.instructor_email })
    if (idx !== -1) {
      learnersOut.splice(idx, 1)
    }
  }

  const transcript = (raw?.progress || []).map((p: any) => ({ learnerId: p.user_id || p.username, module: p.module, progress: p.progress, grade: p.grade }))

  const chat: ChatChannel[] = []
  if (raw?.discussions) {
    chat.push({ channel: 'forum', messages: (raw.discussions.messages || []).map((m: any) => ({ id: m.id || m.pk, from: m.author || m.username, text: m.text, ts: ensureIso(m.created_at) })) })
  }

  const diagnostics = createDiagnostics(learnersOut, 'Some learners had no email and were identified by username or synthetic id')

  const payload: NormalizedPayload = {
    source,
    institution,
    course,
    // Always include instructors array (may be empty) so callers can rely on the presence of this key when rendering UI.
    instructors: instructorsOut,
    learners: learnersOut.length ? learnersOut : undefined,
    transcript: transcript.length ? transcript : undefined,
    chat: chat.length ? chat : undefined,
    diagnostics
  }

  return payload
}

export default normalizeEdx
