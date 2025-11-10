import normalizeGoogleClassroom from '../../src/adapters/googleClassroom'
import raw from '../fixtures/googleClassroom.raw.json'
import { validateNormalized } from '../../src/validator'

describe('Google Classroom adapter', () => {
  test('normalizes raw classroom payload to canonical shape', async () => {
    const normalized = await normalizeGoogleClassroom(raw as any)
  // basic shape
  expect(normalized).toHaveProperty('course')
  expect(normalized.course.id).toBe('809246121636')
  expect(Array.isArray(normalized.learners)).toBe(true)
  // learners have assignments
  const learners = normalized.learners || []
  expect(learners.length).toBeGreaterThan(0)
  const first = learners[0]
  expect(first).toHaveProperty('assignments')
  const assignments = first.assignments || []
  expect(assignments.length).toBeGreaterThan(0)
  const assignment = assignments[0]
  expect(assignment.id).toBe('809426520504')
  // grade percentage numeric
  expect(assignment.submissions?.[0]?.grades?.[0]?.percentage).toBe(50)

    // validate against schema
    const res = validateNormalized(normalized)
    expect(res.valid).toBe(true)
  })
})
