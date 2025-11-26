// Import functions for default export
import { validateNormalized } from './validator'
import { fetchEdxCourse, listEdxCourses } from './connectors/edx'
import { normalizeEdx } from './adapters/edx'
import { fetchCanvasCourse, listCanvasCourses } from './connectors/canvas'
import { normalizeCanvas } from './adapters/canvas'
import { fetchMoodleCourse, listMoodleCourses } from './connectors/moodle'
import { normalizeMoodle } from './adapters/moodle'
import { fetchGoogleClassroomCourse, listGoogleClassroomCourses } from './connectors/googleClassroom'
import { normalizeGoogleClassroom } from './adapters/googleClassroom'

// Validator
export { validateNormalized } from './validator'

// Types
export * from './types'

// edX Connector & Adapter
export { fetchEdxCourse, listEdxCourses } from './connectors/edx'
export { normalizeEdx } from './adapters/edx'

// Canvas Connector & Adapter
export { fetchCanvasCourse, listCanvasCourses } from './connectors/canvas'
export { normalizeCanvas } from './adapters/canvas'

// Moodle Connector & Adapter
export { fetchMoodleCourse, listMoodleCourses } from './connectors/moodle'
export { normalizeMoodle } from './adapters/moodle'

// Google Classroom Connector & Adapter
export { fetchGoogleClassroomCourse, listGoogleClassroomCourses } from './connectors/googleClassroom'
export { normalizeGoogleClassroom } from './adapters/googleClassroom'

// Convenience default export
export default {
  // Validator
  validateNormalized,
  // edX
  fetchEdxCourse,
  listEdxCourses,
  normalizeEdx,
  // Canvas
  fetchCanvasCourse,
  listCanvasCourses,
  normalizeCanvas,
  // Moodle
  fetchMoodleCourse,
  listMoodleCourses,
  normalizeMoodle,
  // Google Classroom
  fetchGoogleClassroomCourse,
  listGoogleClassroomCourses,
  normalizeGoogleClassroom
}