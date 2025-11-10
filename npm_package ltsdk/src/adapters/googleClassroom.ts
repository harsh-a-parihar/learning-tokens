import { NormalizedPayload } from '../types'

type RawGClassCourse = any

function ensureIso(ts?: string | number): string | undefined {
  if (!ts) return undefined
  const d = new Date(ts)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

export async function normalizeGoogleClassroom(raw: RawGClassCourse): Promise<NormalizedPayload> {
  if (process.env.LTSDK_DEBUG) {
    console.log('[Google Classroom Adapter] Raw data keys:', Object.keys(raw || {}))
    console.log('[Google Classroom Adapter] Raw owners:', raw?.owners || 'undefined')
    console.log('[Google Classroom Adapter] Raw teachers:', raw?.teachers || 'undefined') 
    console.log('[Google Classroom Adapter] Raw students:', raw?.students || 'undefined')
  }
  
  const source = { lms: 'google-classroom' as const, rawCourseId: raw?.course?.id?.toString?.() || raw?.id?.toString?.(), fetchedAt: new Date().toISOString() }

  const institution = raw?.courseState?.organization ? { id: raw.courseState.organization.id?.toString?.() || undefined, name: raw.courseState.organization.name } : undefined

  const course = {
    id: raw?.course?.id?.toString?.() || raw?.id?.toString?.() || raw?.courseId || 'unknown',
    name: raw?.course?.name || raw?.name || raw?.title,
    startDate: ensureIso(raw?.startTime) || undefined,
    endDate: ensureIso(raw?.endTime) || undefined,
    metadata: raw?.course?.section ? { section: raw.course.section } : raw?.section ? { section: raw.section } : {}
  }

  // enrich metadata with enrollmentCode and student count when available
  try {
    const studentCount = (raw && raw.course && raw.course.studentCount) || (raw && raw.summary && raw.summary.totalStudents) || undefined
    const enrollmentCode = (raw && raw.course && raw.course.enrollmentCode) || undefined
    const metaAdd: any = {}
    if (studentCount !== undefined) metaAdd.students = studentCount
    if (enrollmentCode !== undefined) metaAdd.enrollmentCode = enrollmentCode
    if (Object.keys(metaAdd).length) course.metadata = Object.assign({}, course.metadata, metaAdd)
  } catch (e) {}

  // Format instructors to match edX/Canvas structure
  let instructors: any[] = []
  
  // Try to extract instructor info from different possible sources
  if (raw?.owners && Array.isArray(raw.owners)) {
    instructors = raw.owners.map((t: any) => ({
      instructor_id: t.id?.toString(),
      instructor_name: t.name?.fullName || t.displayName || undefined,
      instructor_email: t.emailAddress || undefined,
      instructor_username: t.emailAddress || undefined
    }))
  } else if (raw?.teachers && Array.isArray(raw.teachers)) {
    instructors = raw.teachers.map((t: any) => ({
      instructor_id: t.id?.toString(),
      instructor_name: t.name?.fullName || t.displayName || undefined, 
      instructor_email: t.emailAddress || undefined,
      instructor_username: t.emailAddress || undefined
    }))
  } else if (raw?.course?.ownerId) {
    // Fallback: create instructor from course owner ID if available
    instructors = [{
      instructor_id: raw.course.ownerId.toString(),
      instructor_name: undefined,
      instructor_email: undefined,
      instructor_username: undefined
    }]
  }
  // Extract basic learner info (will be enhanced with assignments later)
  const learners = (raw?.students || raw?.members || []).map((s: any) => {
    const id = s.userId?.toString() || s.id?.toString()
    
    // Handle different student data formats
    let email, username, name
    if (s.profile) {
      // Full Google Classroom API format
      email = s.profile.emailAddress
      username = s.profile.emailAddress
      name = s.profile.name?.fullName || s.profile.name
    } else {
      // Processed format from proxy (current case)
      email = s.emailAddress || undefined  
      username = s.emailAddress || s.email || undefined
      name = s.name || s.displayName || undefined
    }
    
    // Google Classroom doesn't provide enrollment time directly, use course creation time as fallback
    const time_enrolled = ensureIso(raw?.course?.creationTime || raw?.course?.updateTime) || undefined
    
    return { id, email, username, name, time_enrolled }
  })

  const assessments: any[] = []
  if (raw?.courseWork && Array.isArray(raw.courseWork)) {
    raw.courseWork.forEach((cw: any) => {
      assessments.push({ id: cw.id?.toString() || cw.title, type: cw.workType || 'courseWork', title: cw.title, maxScore: cw.maxPoints, items: [], results: (cw?.submissions || []).map((s: any) => ({ learnerId: s.userId?.toString(), score: s.assignedGrade || s.draftGrade, submittedAt: ensureIso(s.updateTime) })) })
    })
  }

  // Build learner assignments from courseWork submissions
  const learnersMap: Record<string, any> = {}
  learners.forEach((l: any) => {
    learnersMap[l.id] = { 
      id: l.id, 
      email: l.email, 
      username: l.username,
      name: l.name, 
      time_enrolled: l.time_enrolled,
      assignments: [] 
    }
  })

  if (Array.isArray(raw.courseWork)) {
    for (const cw of raw.courseWork) {
      const cwId = cw.id?.toString() || cw.title
      const maxPoints = cw.maxPoints || null
      const workType = cw.workType || cw.assigneeMode || 'courseWork'

      const subs = cw.submissions || []
      for (const s of subs) {
        const learnerId = s.userId?.toString()
        if (!learnerId) continue

        const score = s.assignedGrade ?? s.draftGrade ?? null
        const totalscore = maxPoints
        const percentage = (score != null && totalscore) ? ((parseFloat(score) / parseFloat(totalscore)) * 100).toFixed(2) : null

        const submissionObj: any = {
          submitted_at: ensureIso(s.updateTime) || ensureIso(s.creationTime),
          workflow_state: s.state || 'unknown',
          grades: [] as any[],
        }

  submissionObj.grades.push({ score: score, totalscore: totalscore, percentage: percentage != null ? parseFloat(Number(percentage).toFixed(2)) : null })

        // Question-level details if present in submission (multipleChoiceSubmission / shortAnswerSubmission)
        const questions: any[] = []
        if (s.multipleChoiceSubmission && Array.isArray(s.multipleChoiceSubmission.answers)) {
          s.multipleChoiceSubmission.answers.forEach((ans: any, idx: number) => {
            questions.push({ id: ans.questionId || idx + 1, type: 'multipleChoice', answer: ans.answer })
          })
        }
        if (s.shortAnswerSubmission && Array.isArray(s.shortAnswerSubmission.answers)) {
          s.shortAnswerSubmission.answers.forEach((ans: any, idx: number) => {
            questions.push({ id: ans.questionId || idx + 1, type: 'shortAnswer', answer: ans.text })
          })
        }
        if (questions.length) submissionObj.questions = questions

        // Attach assignment to learner
        if (!learnersMap[learnerId]) {
          learnersMap[learnerId] = { id: learnerId, assignments: [] }
        }

        const isQuiz = !!(questions.length)
        const assignmentObj: any = {
          id: cwId,
          type: workType || 'courseWork', 
          title: cw.title,
          maxScore: maxPoints,
          is_quiz_assignment: isQuiz,
          submissions: [submissionObj]
        }
        
        // Add subsection_name to match edX/Canvas structure
        if (cw.topicId) {
          assignmentObj.subsection_name = `Topic ${cw.topicId}`
        } else {
          assignmentObj.subsection_name = 'General'
        }
        
        // Add total_questions for quizzes to match edX/Canvas structure  
        if (isQuiz && questions.length > 0) {
          assignmentObj.total_questions = questions.length
        }
        
        if (isQuiz && ((cw && cw.quizId) || cwId)) assignmentObj.quiz_id = (cw && cw.quizId) || cwId
        learnersMap[learnerId].assignments.push(assignmentObj)
      }
    }
  }

  // Format chat/discussions to match edX/Canvas structure
  const chat: any[] = []
  if (raw?.announcements && raw.announcements.length > 0) {
    chat.push({ 
      channel: 'announcements', 
      messages: raw.announcements.map((a: any) => ({ 
        id: a.id?.toString(), 
        from: a.creator?.id?.toString(), 
        text: a.text, 
        ts: ensureIso(a.updateTime) 
      })) 
    })
  } else {
    // Add empty discussion channel to match Canvas/edX structure
    chat.push({ channel: 'discussion', messages: [] })
  }

  const diagnostics = { missingEmailCount: learners.filter((l: any) => !l.email).length, notes: [] as string[] }
  if (diagnostics.missingEmailCount > 0) diagnostics.notes!.push('Some learners missing email')

  // Convert learnersMap back to array, merging assignments into learners
  const learnersOut = Object.values(learnersMap).map((l: any) => {
    // ensure we have a name/username by falling back to the raw students list when available
    let name = l.name
    let username = l.username
    let email = l.email
    if ((!name || !username || !email) && Array.isArray(raw?.students)) {
      const found = raw.students.find((s: any) => (s.userId?.toString?.() || s.id?.toString?.()) === l.id)
      if (found) {
        name = name || found.profile?.name?.fullName || found.name || found.displayName
        username = username || found.profile?.emailAddress || found.emailAddress
        email = email || found.profile?.emailAddress || found.emailAddress
      }
    }
    return { 
      id: l.id, 
      email, 
      username, 
      name, 
      time_enrolled: l.time_enrolled,
      assignments: l.assignments 
    }
  })

  return {
    source,
    institution,
    course,
    instructors: instructors.length ? instructors : undefined,
    learners: learnersOut.length ? learnersOut : undefined,
    chat: chat.length ? chat : undefined,
    transcript: [], // Empty transcript array to match Canvas/edX structure
    diagnostics
  }
}

export default normalizeGoogleClassroom
