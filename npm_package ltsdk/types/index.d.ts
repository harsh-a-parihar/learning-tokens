import { AxiosResponse } from 'axios';

export interface ZoomParticipant {
  id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
}

export interface ZoomParticipantsResponse {
  participants: ZoomParticipant[];
  page_count: number;
  page_size: number;
  total_records: number;
}

export interface ZoomPollsQuestion {
  total_records: number;
  polls: PollQuestions[];
}

export interface PollQuestions {
  id: string;
  title: string;
  anonymous: boolean;
  status: string;
  questions: Pollquestion[];
  poll_type: number;
}

export interface Pollquestion {
  name: string;
  type: string;
  answer_required: boolean;
  answer_min_character?: number;
  answer_max_character?: number;
  answers?: string[];
  right_answers?: string[];
  prompts?: {
    prompt_question: string;
    prompt_right_answers?: string[];
  }[];
  show_as_dropdown?: boolean;
  rating_min_value?: number;
  rating_max_value?: number;
  rating_min_label?: string;
  rating_max_label?: string;
  case_sensitive?: boolean;
}

export interface ZoomPollsResponse {
  id: number;
  uuid: string;
  start_time: string;
  questions: ResponseToQuestion[];
}

export interface ResponseToQuestion {
  name: string;
  email: string;
  question_details: ResponseQuestionDetail[];
  first_name: string;
}

export interface ResponseQuestionDetail {
  question: string;
  answer: string;
  polling_id: string;
  date_time: string;
}

export interface ParticipantScore {
  name: string;
  total_score: number;
  attempted: number;
  total_questions: number;
}

export interface Scores {
  title: string;
  question: string;
  score: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

export interface EmailMap {
  [key: string]: {
    LTId: string;
    Email: string;
  };
}

export interface ParticipantData {
  totalTime: number;
  joinTime: number;
  leaveTime: number;
  email: string;
  LTId: string;
  total_score: number;
  attempted: number;
  total_questions: number;
}

export function getZoomAccessToken(
  accountId: string,
  clientId: string,
  clientSecret: string
): Promise<string>;

export function getPastMeetingParticipants(
  baseUrl: string,
  meetingId: string,
  bearerToken: string
): Promise<ApiResponse<ZoomParticipantsResponse>>;

export function getMeetingPollsQuestions(
  baseUrl: string,
  meetingId: string,
  bearerToken: string
): Promise<ApiResponse<ZoomPollsQuestion>>;

export function getPastMeetingPolls(
  baseUrl: string,
  meetingId: string,
  bearerToken: string
): Promise<ApiResponse<ZoomPollsResponse>>;

export function processParticipantsAndPollsData(
  participants: ZoomParticipant[],
  pollScores: Map<string, ParticipantData>
): Map<string, ParticipantData>;

export function calculateScore(
  pollsQuestionsResponse: ZoomPollsQuestion,
  pollsAnswers: ZoomPollsResponse
): Map<string, ParticipantData>;

export function saveProcessedDataToFile(
  data: Map<string, ParticipantData>,
  meetingId: string
): any;

export function run(
  accountId: string,
  clientId: string,
  clientSecret: string,
  meetingId: string
): Promise<any>;

// ============================================================================
// LMS SDK - Learning Management System Types and Functions
// ============================================================================

// Re-export all LMS normalized types
export * from '../dist/src/types'

// Validator
export { validateNormalized } from '../dist/src/validator'

// edX Connector & Adapter
export { fetchEdxCourse, listEdxCourses } from '../dist/src/connectors/edx'
export { normalizeEdx } from '../dist/src/adapters/edx'

// Canvas Connector & Adapter
export { fetchCanvasCourse, listCanvasCourses } from '../dist/src/connectors/canvas'
export { normalizeCanvas } from '../dist/src/adapters/canvas'

// Moodle Connector & Adapter
export { fetchMoodleCourse, listMoodleCourses } from '../dist/src/connectors/moodle'
export { normalizeMoodle } from '../dist/src/adapters/moodle'

// Google Classroom Connector & Adapter
export { fetchGoogleClassroomCourse, listGoogleClassroomCourses } from '../dist/src/connectors/googleClassroom'
export { normalizeGoogleClassroom } from '../dist/src/adapters/googleClassroom'