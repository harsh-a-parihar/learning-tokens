import { NormalizedPayload } from '../types'

type RawMoodleCourse = any

function ensureIso(ts?: string | number): string | undefined {
  if (!ts) return undefined
  let t: any = ts
  // numeric strings -> number
  if (typeof t === 'string' && /^\d+$/.test(t)) t = Number(t)
  // Moodle sometimes returns unix seconds; if timestamp looks like seconds (less than 1e12) convert to ms
  if (typeof t === 'number' && t < 1e12) t = t * 1000
  const d = new Date(t)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

export async function normalizeMoodle(raw: RawMoodleCourse): Promise<NormalizedPayload> {
  const source = { lms: 'moodle' as const, rawCourseId: raw?.id?.toString() || raw?.courseid?.toString(), fetchedAt: new Date().toISOString() }

  const institution = raw?.category ? { id: raw.category.id?.toString?.() || raw.category, name: raw.category_name || undefined } : undefined

  const course = {
    id: raw?.id?.toString() || raw?.courseid?.toString() || 'unknown',
    name: raw?.fullname || raw?.name,
    startDate: ensureIso(raw?.startdate) || undefined,
    endDate: ensureIso(raw?.enddate) || undefined,
    metadata: raw?.summary ? { summary: raw.summary } : {}
  }

  // Format instructors to match edX/Canvas/Google Classroom structure
  const instructors = (raw?.teachers || raw?.instructors || []).map((t: any) => ({
    instructor_id: t.id?.toString(),
    instructor_name: t.fullname || t.name,
    instructor_email: t.email,
    instructor_username: t.username || t.email
  }))

  // Extract basic learner info (will be enhanced with assignments later)
  const learners = (raw?.students || raw?.participants || []).map((u: any) => ({
    id: u.id?.toString(),
    email: u.email,
    username: u.username || u.email,
    name: u.fullname || u.name,
    time_enrolled: ensureIso(raw?.startdate) || undefined // Use course start date as fallback
  }))

  const rawActivities: any[] = Array.isArray(raw?.activities) ? raw.activities.filter((act: any) => act.modname === 'quiz' || act.modname === 'assign') : []

  // Build assignments per learner
  const learnersWithAssignments = learners.map((learner: any) => {
    const id = learner.id?.toString?.()
    const assignmentsForLearner = rawActivities.map((act: any) => {
      const submissions = Array.isArray(act.submissions) ? act.submissions.filter((s: any) => (s.userid?.toString?.() || s.user?.id?.toString?.()) === id) : []

      const mappedSubs = submissions.map((s: any) => {
        const submitted_at = ensureIso(s?.timemodified || s?.timecreated)
        // Moodle may use various status fields; try common ones
        const workflow_state = s?.status || s?.submissionstate || (s?.grade === null ? 'unsubmitted' : 'submitted')
        const score = s?.grade ?? s?.score ?? null
        const totalscore = act.maxgrade || act.grade || null
        const gradesArr: any[] = []
        if (score != null) {
          // compute percentage when possible (format as string with two decimals)
          const percentage = (typeof score === 'number' && typeof totalscore === 'number' && totalscore > 0)
            ? ((score / totalscore) * 100).toFixed(2)
            : null
          gradesArr.push({ score, totalscore, percentage })
        }
        // default zero-grade for unsubmitted or missing grades
        if ((workflow_state === 'unsubmitted' || !submissions.length) && gradesArr.length === 0) {
          gradesArr.push({ score: 0, totalscore: act.maxgrade || act.grade || null, percentage: '00.00' })
        }
        return { submitted_at, workflow_state, grades: gradesArr }
      })

      // If there were no submissions for this learner, still include an empty submission entry with default grade
      const subs = mappedSubs.length ? mappedSubs : [{ workflow_state: 'unsubmitted', grades: [{ score: 0, totalscore: act.maxgrade || act.grade || null, percentage: '00.00' }] }]

      const assignment: any = {
        id: act.id?.toString?.() || act.name,
        type: act.modname,
        title: act.name,
        maxScore: act.maxgrade || act.grade,
        is_quiz_assignment: act.modname === 'quiz',
        submissions: subs,
        // Add subsection_name to match edX/Canvas/Google Classroom structure
        subsection_name: act.section || act.category || 'General'
      }
      
      // Add quiz-specific fields
      if (act.modname === 'quiz') {
        assignment.quiz_id = act.modid || act.id?.toString?.() || null
        // Add total_questions for quizzes to match edX/Canvas/Google Classroom structure
        if (act?.question_count != null) {
          assignment.total_questions = act.question_count
        }
      }

      return assignment
    })

    return { ...learner, assignments: assignmentsForLearner }
  })

  const chat: any[] = []
  if (raw?.forum && Array.isArray(raw.forum)) {
    chat.push({ channel: 'forum', messages: raw.forum.flatMap((f: any) => (f?.discussions || []).flatMap((d: any) => (d?.posts || []).map((p: any) => ({ id: p.id?.toString(), from: p.userid?.toString(), text: p.message, ts: ensureIso(p.created) })) )) })
  }

  const diagnostics = { missingEmailCount: learnersWithAssignments.filter((l: any) => !l.email).length, notes: [] as string[] }
  if (diagnostics.missingEmailCount > 0) diagnostics.notes!.push('Some learners missing email')

  return {
    source,
    institution,
    course,
    instructors: instructors.length ? instructors : undefined,
    learners: learnersWithAssignments.length ? learnersWithAssignments : undefined,
    chat: chat.length ? chat : undefined,
    transcript: [], // Empty transcript array to match Canvas/edX/Google Classroom structure
    diagnostics
  }
}

export default normalizeMoodle
