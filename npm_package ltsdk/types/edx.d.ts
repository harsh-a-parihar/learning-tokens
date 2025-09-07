// edxDataFetch.ts
import axios, { AxiosResponse } from 'axios';


export interface EdxCourse {
  id: string; // course-v1:org+course+run
  org: string;
  course: string;
  run: string;
  display_name: string;
  start: string;
  end?: string;
  enrollment_start?: string;
  enrollment_end?: string;
}


export interface EdxEnrollment {
  id: number;
  user_id: number;
  course_id: string;
  created: string; 
  is_active: boolean;
  mode: string; // audit, honor, verified, etc.
}


export interface EdxCourseGrade {
  course_id: string;
  user_id: number;
  percent_grade: number; // 0.0 - 1.0
  letter_grade: string;
  passed_timestamp?: string;
  created: string;
  modified: string;
}


export interface EdxSubsectionGrade {
  course_id: string;
  user_id: number;
  usage_key: string;
  earned_all: number;
  possible_all: number;
  earned_graded: number;
  possible_graded: number;
  first_attempted?: string;
  created: string;
  modified: string;
}


export interface EdxAssessment {
  id: string; 
  course_id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  total_marks: number;
  questions: EdxAssessmentQuestion[];
}


export interface EdxAssessmentQuestion {
  id: string;
  assessment_id: string;
  text: string;
  type: string; // e.g., "multiple_choice", "short_answer"
  options?: string[]; 
  correct_answers?: string[]; 
  max_score: number;
}


export interface EdxAssessmentResponse {
  id: string;
  assessment_id: string;
  question_id: string;
  user_id: number;
  answer: string | string[]; // string for text, array for MCQ
  submitted_at: string;
  score: number;
  graded_by?: number; // instructor id if manually graded
  graded_at?: string;
}


export interface EdxAssessmentParticipant {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  LTId: string;
  enrollments: EdxEnrollment[];
  assessments_taken: EdxAssessmentResult[];
  certificate?: EdxCertificate;
}


export interface EdxAssessmentResult {
  assessment_id: string;
  total_score: number;
  max_score: number;
  responses: EdxAssessmentResponse[];
  attempted_questions: number;
  total_questions: number;
  completed: boolean;
  completed_at?: string;
}


export interface EdxAssessmentAnalytics {
  course_id: string;
  assessment_id: string;
  participants: EdxAssessmentParticipant[];
  instructors: EdxInstructor[];
  average_score: number;
  highest_score: number;
  lowest_score: number;
  total_participants: number;
  attendance: EdxAssessmentAttendance[];
}


export interface EdxAssessmentAttendance {
  user_id: number;
  attended: boolean;
  attended_at?: string;
}

// Updated for Open edX API usage
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  message?: string; // error or info message from API
  count?: number;
  next?: string;
  previous?: string;
}

// Map user_id to user info (for Open edX)
export interface UserEmailMap {
  [user_id: number]: {
    LTId: string;
    email: string;
    username?: string;
    full_name?: string;
  };
}

export interface EdxCertificate {
    id: number;
    user_id: number;
    course_id: string;
    download_url: string;
    grade: string;
    status: string; // downloadable, notpassing, etc.
    name: string;
    created_date: string;
    modified_date: string;
    mode: string;
}

export interface EdxInstructor {
    user_id: number;
    username: string;
    email: string;
    full_name: string;
    courses: string[]; // course ids
    assessments_created: EdxAssessment[];
    total_students_mentored: number;
}

// ------------------- Function Signatures for Open edX LMS SDK -------------------

// Fetch a user's profile by user ID
export declare function getEdxUserProfile(
  userId: number,
  accessToken: string
): Promise<ApiResponse<EdxAssessmentParticipant>>;

// Fetch all enrollments for a user
export declare function getEdxUserEnrollments(
  userId: number,
  accessToken: string
): Promise<ApiResponse<EdxEnrollment[]>>;

// Fetch all assessments (quizzes) for a course
export declare function getEdxCourseAssessments(
  courseId: string,
  accessToken: string
): Promise<ApiResponse<EdxAssessment[]>>;

// Fetch all questions for a specific assessment
export declare function getEdxAssessmentQuestions(
  assessmentId: string,
  accessToken: string
): Promise<ApiResponse<EdxAssessmentQuestion[]>>;

// Fetch all responses for a specific assessment (optionally filter by user)
export declare function getEdxAssessmentResponses(
  assessmentId: string,
  accessToken: string,
  userId?: number
): Promise<ApiResponse<EdxAssessmentResponse[]>>;

// Fetch grades for a user in a course
export declare function getEdxCourseGrade(
  courseId: string,
  userId: number,
  accessToken: string
): Promise<ApiResponse<EdxCourseGrade>>;

// Fetch all participants (students) for a course
export declare function getEdxCourseParticipants(
  courseId: string,
  accessToken: string
): Promise<ApiResponse<EdxAssessmentParticipant[]>>;

// Fetch all instructors for a course
export declare function getEdxCourseInstructors(
  courseId: string,
  accessToken: string
): Promise<ApiResponse<EdxInstructor[]>>;

// Fetch attendance for an assessment
export declare function getEdxAssessmentAttendance(
  assessmentId: string,
  accessToken: string
): Promise<ApiResponse<EdxAssessmentAttendance[]>>;

// Fetch analytics for an assessment (aggregated data)
export declare function getEdxAssessmentAnalytics(
  courseId: string,
  assessmentId: string,
  accessToken: string
): Promise<ApiResponse<EdxAssessmentAnalytics>>;

// Fetch certificate for a user in a course
export declare function getEdxUserCertificate(
  courseId: string,
  userId: number,
  accessToken: string
): Promise<ApiResponse<EdxCertificate>>;

