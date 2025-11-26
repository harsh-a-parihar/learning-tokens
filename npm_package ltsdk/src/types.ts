// Canonical types for LMS normalization SDK

export type LMSName = 'edx' | 'canvas' | 'moodle' | 'google-classroom'

export interface SourceMeta {
  lms: LMSName
  rawCourseId?: string
  fetchedAt: string // ISO timestamp
}

export interface Institution {
  id?: string
  name?: string
  metadata?: Record<string, any>
}

export interface Course {
  id: string
  name?: string
  startDate?: string
  endDate?: string
  metadata?: Record<string, any>
}

export interface Person {
  id?: string
  email?: string
  username?: string
  name?: string
  time_enrolled?: string
  profile?: Record<string, any>
}

export interface Grade {
  score: number | null
  totalscore?: number | null
  percentage?: string | number | null
  metadata?: Record<string, any>
}

export interface Submission {
  submitted_at?: string
  workflow_state?: string
  grades: Grade[]
  metadata?: Record<string, any>
}

export interface Assignment {
  id: string
  type?: string
  title?: string
  maxScore?: number
  question_count?: number
  total_questions?: number
  is_quiz_assignment?: boolean
  quiz_id?: string | number | null
  submissions?: Submission[]
  metadata?: Record<string, any>
}

export interface AssessmentItem {
  qId: string
  question?: string
  type?: string
  metadata?: Record<string, any>
}

export interface AssessmentResult {
  learnerId: string
  score?: number
  maxScore?: number
  submittedAt?: string
  answers?: Array<{ qId: string; value: any }>
  metadata?: Record<string, any>
}

export interface Assessment {
  id: string
  type?: string
  title?: string
  maxScore?: number
  items?: AssessmentItem[]
  results?: AssessmentResult[]
  metadata?: Record<string, any>
}

export interface TranscriptRecord {
  learnerId: string
  module?: string
  progress?: number
  grade?: string
  metadata?: Record<string, any>
}

export interface ChatMessage {
  id: string
  from: string
  text: string
  ts?: string
  metadata?: Record<string, any>
}

export interface ChatChannel {
  channel: string
  messages: ChatMessage[]
}

export interface Diagnostics {
  missingEmailCount?: number
  notes?: string[]
}

export interface NormalizedPayload {
  source: SourceMeta
  institution?: Institution
  course: Course
  instructors?: (Person & { assignments?: Assignment[] })[]
  instructor?: (Person & { assignments?: Assignment[] })
  learners?: (Person & { assignments?: Assignment[] })[]
  assessments?: Assessment[]
  // Per-course assignment list (alias of assessments but allows naming clarity)
  assignments?: Assignment[]
  transcript?: TranscriptRecord[]
  chat?: ChatChannel[]
  diagnostics?: Diagnostics
}

// Note: types are exported above. Do not export a runtime default for an interface.

// ============================================================================
// Zoom Integration Types (for future use)
// ============================================================================

export interface ZoomParticipant {
  id: string
  name: string
  user_email: string
  join_time: string
  leave_time: string
}

export interface ZoomParticipantsResponse {
  participants: ZoomParticipant[]
  page_count: number
  page_size: number
  total_records: number
}

export interface ZoomPollsQuestion {
  total_records: number
  polls: PollQuestions[]
}

export interface PollQuestions {
  id: string
  title: string
  anonymous: boolean
  status: string
  questions: Pollquestion[]
  poll_type: number
}

export interface Pollquestion {
  name: string
  type: string
  answer_required: boolean
  answer_min_character?: number
  answer_max_character?: number
  answers?: string[]
  right_answers?: string[]
  prompts?: {
    prompt_question: string
    prompt_right_answers?: string[]
  }[]
  show_as_dropdown?: boolean
  rating_min_value?: number
  rating_max_value?: number
  rating_min_label?: string
  rating_max_label?: string
  case_sensitive?: boolean
}

export interface ZoomPollsResponse {
  id: number
  uuid: string
  start_time: string
  questions: ResponseToQuestion[]
}

export interface ResponseToQuestion {
  name: string
  email: string
  question_details: ResponseQuestionDetail[]
  first_name: string
}

export interface ResponseQuestionDetail {
  question: string
  answer: string
  polling_id: string
  date_time: string
}

export interface ParticipantScore {
  name: string
  total_score: number
  attempted: number
  total_questions: number
}

export interface Scores {
  title: string
  question: string
  score: number
}

export interface ApiResponse<T> {
  data: T
  status: number
  statusText: string
}

export interface EmailMap {
  [key: string]: {
    LTId: string
    Email: string
  }
}

export interface ParticipantData {
  totalTime: number
  joinTime: number
  leaveTime: number
  email: string
  LTId: string
  total_score: number
  attempted: number
  total_questions: number
}

// Note: Zoom function implementations are in zoomprocessor.ts
// Function types can be inferred from the implementation when needed
