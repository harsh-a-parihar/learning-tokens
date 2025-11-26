import { NormalizedPayload, Course } from '../types'
import { ensureIso, createDiagnostics } from '../utils'

type RawCanvasCourse = any

export async function normalizeCanvas(raw: RawCanvasCourse): Promise<NormalizedPayload> {
  if (process.env.LTSDK_DEBUG === 'true') {
    console.log('[LTSDK] Adapter raw data keys:', Object.keys(raw || {}))
    console.log('[LTSDK] Adapter teachers array length:', (raw?.teachers || []).length)
    console.log('[LTSDK] Adapter enrollments array length:', (raw?.enrollments || []).length)
  }
  const source = { lms: 'canvas' as const, rawCourseId: raw?.id?.toString?.(), fetchedAt: new Date().toISOString() }

  const institution = raw?.account ? { id: raw.account.id?.toString?.(), name: raw.account.name } : undefined

  const courseId = raw?.id
  const normalizedCourseId = courseId !== undefined && courseId !== null ? String(courseId) : 'NA'
  const course: Course = ({
    id: normalizedCourseId,
    name: raw?.name || raw?.course_name || undefined,
    startDate: ensureIso(raw?.start_at) || undefined,
    endDate: ensureIso(raw?.end_at) || undefined,
    metadata: {
      workflow_state: raw?.workflow_state || undefined,
      course_code: raw?.course_code || undefined,
      account_id: raw?.account_id?.toString?.() || undefined,
      course_format: raw?.course_format || undefined
    }
  }) as Course

  // Extract instructors from enrollments (teacher roles) and explicit teachers array
  const instructorsFromEnrollments = (raw?.enrollments || [])
    .filter((e: any) => e.type === 'teacher' || e.role === 'TeacherEnrollment')
    .map((e: any) => ({
      instructor_id: e?.user_id?.toString?.() || e?.id?.toString?.(),
      instructor_username: e?.user?.login_id || e?.login_id || e?.user?.email || undefined,
      instructor_name: e?.user?.name || e?.name || undefined,
      instructor_email: e?.user?.email || e?.email || undefined
    }))

  const instructorsFromTeachers = (raw?.teachers || raw?.instructors || []).map((t: any) => {
    if (process.env.LTSDK_DEBUG === 'true') {
      console.log('[LTSDK] Adapter processing teacher:', JSON.stringify(t, null, 2))
    }
    return {
      instructor_id: t?.id?.toString?.() || t?.user_id?.toString?.(),
      instructor_username: t?.user?.login_id || t?.login_id || t?.sis_login_id || t?.user?.email || t?.email,
      instructor_name: t?.user?.name || t?.name || undefined,
      instructor_email: t?.user?.email || t?.email || t?.login_id || undefined
    }
  })

  // Combine and deduplicate instructors
  if (process.env.LTSDK_DEBUG === 'true') {
    console.log(`[LTSDK] Adapter instructors from enrollments: ${instructorsFromEnrollments.length}`)
    console.log(`[LTSDK] Adapter instructors from teachers: ${instructorsFromTeachers.length}`)
    console.log('[LTSDK] All instructor mappings:', JSON.stringify([...instructorsFromEnrollments, ...instructorsFromTeachers], null, 2))
  }
  const allInstructors = [...instructorsFromEnrollments, ...instructorsFromTeachers]
  const instructorsMap = new Map()
  allInstructors.forEach(inst => {
    if (inst.instructor_id || inst.instructor_email || inst.instructor_username) {
      const key = inst.instructor_id || inst.instructor_email || inst.instructor_username
      const existing = instructorsMap.get(key)
      if (!existing) {
        instructorsMap.set(key, inst)
      } else {
        // Merge data, preferring non-undefined values from the new instructor
        const merged = {
          instructor_id: inst.instructor_id || existing.instructor_id,
          instructor_name: inst.instructor_name || existing.instructor_name,
          instructor_email: inst.instructor_email || existing.instructor_email,
          instructor_username: inst.instructor_username || existing.instructor_username
        }
        if (process.env.LTSDK_DEBUG === 'true') {
          console.log('[LTSDK] Merging instructor:', JSON.stringify({ existing, new: inst, merged }, null, 2))
        }
        instructorsMap.set(key, merged)
      }
    }
  })
  const instructors = Array.from(instructorsMap.values())

  // Build learners list (exclude teachers/instructors)
  const learners = (raw?.students || raw?.enrollments || [])
    .filter((s: any) => {
      // Exclude teacher enrollments
      return !(s.type === 'teacher' || s.role === 'TeacherEnrollment')
    })
    .map((s: any) => {
      const user = s.user || s
      const id = user?.id?.toString?.() || s?.id?.toString?.() || s?.user_id?.toString?.()
      const email = user?.email || user?.login_id || s?.login_id || undefined
      const username = user?.login_id || user?.sis_login_id || s?.login_id || undefined
      const name = user?.name || s?.name || undefined
      const time_enrolled = ensureIso(s?.created_at) || ensureIso(s?.enrollment_date) || ensureIso(user?.created_at) || undefined
      return { id, email, username, name, time_enrolled }
    })

  const rawAssignments = Array.isArray(raw?.assignments) ? raw.assignments : []

  const learnersWithAssignments = learners.map((learner: any) => {
    const id = learner.id?.toString?.()
    if (process.env.LTSDK_DEBUG === 'true') {
      console.log(`[Canvas Adapter] Processing assignments for learner ${id} (${learner.name || learner.email})`)
    }

    const assignmentsForLearner = rawAssignments.map((a: any) => {
      if (process.env.LTSDK_DEBUG === 'true') {
        console.log(`[Canvas Adapter] Assignment ${a.id} (${a.name}): has ${a.submissions?.length || 0} total submissions`)
      }

      const submissions = Array.isArray(a.submissions) ? a.submissions.filter((s: any) => {
        const uid = s?.user_id?.toString?.() || s?.user?.id?.toString?.()
        const matches = uid === id
        if (matches && process.env.LTSDK_DEBUG === 'true') {
          console.log(`[Canvas Adapter] Found submission for user ${id}: score=${s.score}, entered_score=${s.entered_score}, current_score=${s.current_score}, grade=${s.grade}`)
        }
        return matches
      }) : []

      if (process.env.LTSDK_DEBUG === 'true') {
        console.log(`[Canvas Adapter] Found ${submissions.length} submissions for user ${id} on assignment ${a.id}`)
      }

      // Check if we have enrollment-level grade data for this user
      const userEnrollment = (raw?.enrollments || []).find((e: any) => {
        const enrollmentUserId = e?.user_id?.toString?.() || e?.user?.id?.toString?.()
        return enrollmentUserId === id
      })

      if (process.env.LTSDK_DEBUG === 'true') {
        console.log(`[Canvas Adapter] User enrollment data:`, userEnrollment ? {
          current_score: userEnrollment.grades?.current_score,
          final_score: userEnrollment.grades?.final_score,
          current_grade: userEnrollment.grades?.current_grade
        } : 'No enrollment found')
      }

      const mappedSubs = submissions.length > 0 ? submissions.map((s: any) => {
        const submitted_at = ensureIso(s?.submitted_at || s?.posted_at || s?.graded_at)
        const workflow_state = s?.workflow_state || s?.workflow || 'submitted'
        let score = s?.score ?? s?.entered_score ?? s?.entered_grade ?? s?.grade ?? null

        if (process.env.LTSDK_DEBUG === 'true') {
          console.log(`[Canvas Adapter] Processing submission: score=${score}, workflow=${workflow_state}`)
        }

        const quizGrade = (a.quizGrades && a.quizGrades.grades) ? (a.quizGrades.grades.find((g: any) => g.user_id?.toString?.() === id)) : undefined
        const gradesArr: any[] = []

        if (quizGrade) {
          gradesArr.push({ score: quizGrade.score ?? null, totalscore: quizGrade.points_possible ?? a.points_possible, percentage: quizGrade.percentage })
        } else if (score != null) {
          const percentage = (score != null && a.points_possible) ? Number(((score / a.points_possible) * 100).toFixed(2)) : null
          gradesArr.push({ score, totalscore: a.points_possible, percentage })
        } else if (workflow_state === 'submitted' || workflow_state === 'graded') {
          // Even if score is null, if it's submitted/graded, show it as graded with score 0
          if (process.env.LTSDK_DEBUG === 'true') {
            console.log(`[Canvas Adapter] Assignment submitted but score is null, treating as 0`)
          }
          gradesArr.push({ score: 0, totalscore: a.points_possible, percentage: 0 })
        }

        // If no grades were calculated but assignment has points possible, show ungraded
        if (gradesArr.length === 0 && a.points_possible) {
          gradesArr.push({ score: 0, totalscore: a.points_possible, percentage: 0 })
        }

        return { submitted_at, workflow_state, grades: gradesArr }
      }) : [{
        // Default submission for assignments with no individual submissions
        submitted_at: undefined,
        workflow_state: 'unsubmitted',
        grades: [{ score: 0, totalscore: a.points_possible, percentage: 0 }]
      }]

      const assignment: any = {
        id: a.id?.toString?.(),
        type: a.submission_types ? a.submission_types.join(',') : 'assignment',
        title: a.name,
        maxScore: a.points_possible,
        is_quiz_assignment: !!a.is_quiz_assignment,
        submissions: mappedSubs
      }

      // Add subsection_name if available (matching edX structure)
      if (a.assignment_group_id) {
        assignment.subsection_name = `Assignment Group ${a.assignment_group_id}`
      }

      // Add total_questions for quizzes (matching edX structure)
      if (a.is_quiz_assignment && a.quiz_id) {
        assignment.total_questions = a.quiz?.question_count || (a.quizInfo && a.quizInfo.question_count) || undefined
      }

      return assignment
    })

    return {
      id: learner.id,
      email: learner.email,
      username: learner.username,
      name: learner.name,
      time_enrolled: learner.time_enrolled,
      assignments: assignmentsForLearner
    }
  })

  // Add transcript field (matching edX structure) - Canvas doesn't have module progress, so use empty array
  const transcript: any[] = []

  const chat: any[] = []
  if (raw?.discussion_topics) {
    chat.push({ channel: 'discussion', messages: (raw.discussion_topics || []).flatMap((d: any) => (d?.messages || []).map((m: any) => ({ id: m.id?.toString?.(), from: m.user?.id?.toString?.(), text: m.message, ts: ensureIso(m.created_at) }))) })
  }

  const diagnostics = createDiagnostics(learnersWithAssignments, 'Some learners had no email and were identified by username or synthetic id')

  const payload: NormalizedPayload = {
    source,
    institution,
    course,
    // Always include instructors array (may be empty) so callers can rely on the
    // presence of this key when rendering UI.
    instructors: instructors,
    learners: learnersWithAssignments.length ? learnersWithAssignments : undefined,
    transcript: transcript.length ? transcript : undefined,
    chat: chat.length ? chat : undefined,
    diagnostics
  }

  return payload
}

export default normalizeCanvas
