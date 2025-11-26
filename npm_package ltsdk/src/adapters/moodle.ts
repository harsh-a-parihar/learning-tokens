import { NormalizedPayload, Course } from '../types'
import { ensureIso, createDiagnostics } from '../utils'

type RawMoodleCourse = any

export async function normalizeMoodle(raw: RawMoodleCourse): Promise<NormalizedPayload> {
  const source = { lms: 'moodle' as const, rawCourseId: raw?.id?.toString() || raw?.courseid?.toString(), fetchedAt: new Date().toISOString() }

  const institution = raw?.category ? { id: raw.category.id?.toString?.() || raw.category, name: raw.category_name || undefined } : undefined

  const courseId =
    raw?.id ??
    raw?.courseid ??
    (raw?.course && (raw.course.id ?? raw.course.courseid)) ??
    undefined
  const normalizedCourseId = courseId !== undefined && courseId !== null ? String(courseId) : 'NA'
  const course: Course = ({
    id: normalizedCourseId,
    name: raw?.fullname || raw?.name || (raw?.course && (raw.course.fullname || raw.course.name)),
    startDate: ensureIso(raw?.startdate) || ensureIso(raw?.course?.startdate) || undefined,
    endDate: ensureIso(raw?.enddate) || ensureIso(raw?.course?.enddate) || undefined,
    metadata: raw?.summary ? { summary: raw.summary } : (raw?.course && raw.course.summary ? { summary: raw.course.summary } : {})
  }) as Course

  // Format instructors to match edX/Canvas/Google Classroom structure
  const instructors = (raw?.teachers || raw?.instructors || []).map((t: any) => ({
    instructor_id: t.id?.toString(),
    instructor_name: t.fullname || t.name,
    instructor_email: t.email,
    instructor_username: t.username || t.email
  }))

  // Extract basic learner info (will be enhanced with assignments later)
  const learners = (raw?.students || raw?.participants || raw?.course?.students || []).map((u: any) => ({
    id: u.id?.toString(),
    email: u.email,
    username: u.username || u.email,
    name: u.fullname || u.name,
    time_enrolled: ensureIso(u.timecreated) || ensureIso(u.timestart) || ensureIso(u.firstaccess) || undefined
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
        // Do not fabricate default zero-grade entries when there are no submissions.
        return { submitted_at, workflow_state, grades: gradesArr }
      })

      // If there were no submissions for this learner, leave submissions empty (only include real fetched data)
      const subs = mappedSubs.length ? mappedSubs : []

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
    chat.push({ channel: 'forum', messages: raw.forum.flatMap((f: any) => (f?.discussions || []).flatMap((d: any) => (d?.posts || []).map((p: any) => ({ id: p.id?.toString(), from: p.userid?.toString(), text: p.message, ts: ensureIso(p.created) })))) })
  }

  const diagnostics = createDiagnostics(learnersWithAssignments)

  // Activity / submission diagnostics: help detect connector permission gaps
  const totalActivities = rawActivities.length
  const activitiesWithAnySubmissions = rawActivities.filter((act: any) => Array.isArray(act.submissions) && act.submissions.length > 0).length
  const totalSubmissions = rawActivities.reduce((acc: number, act: any) => acc + (Array.isArray(act.submissions) ? act.submissions.length : 0), 0)
    ; (diagnostics as any).activities = { total: totalActivities, withSubmissions: activitiesWithAnySubmissions, submissionsTotal: totalSubmissions }
  if (totalActivities > 0 && activitiesWithAnySubmissions === 0) diagnostics.notes!.push('No submissions found in raw activities — connector may lack permission to fetch attempts')

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
