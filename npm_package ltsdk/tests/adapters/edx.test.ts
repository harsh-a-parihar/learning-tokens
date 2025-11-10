import { normalizeEdx } from '../../src/adapters/edx'
import { validateNormalized } from '../../src/validator'
import raw from '../fixtures/edx-sample.json'
import rawWithTimestamps from '../fixtures/edx-sample-with-timestamps.json'

describe('edX adapter', () => {
  it('normalizes sample fixture and validates schema', async () => {
    const out = await normalizeEdx(raw as any)
    const result = validateNormalized(out)
    expect(result.valid).toBe(true)
    // basic structural checks
    expect(out.course).toBeDefined()
    expect(out.course.id).toBe('course-v1:MIT+CS50+2025_T1')
    expect(Array.isArray(out.learners)).toBe(true)
    expect(out.diagnostics).toBeDefined()
  })

  it('merges submission timestamps from raw submissionsMap into normalized payload', async () => {
    const out = await normalizeEdx(rawWithTimestamps as any)
    const result = validateNormalized(out)
    expect(result.valid).toBe(true)

    // find the learner s1 and hw1 assignment
  const learners = out.learners as any[]
  expect(Array.isArray(learners)).toBe(true)
  const learner = learners.find((l: any) => l.username === 's1')
  expect(learner).toBeDefined()
  const assignments = (learner!.assignments as any[])
  expect(Array.isArray(assignments)).toBe(true)
  const assignment = assignments.find((a: any) => a.id === 'hw1')
  expect(assignment).toBeDefined()
  // submissions should include submitted_at merged from submissionsMap/scores
  const submissions = assignment!.submissions as any[]
  expect(Array.isArray(submissions)).toBe(true)
  const submission = submissions[0]
  expect(submission).toBeDefined()
    expect(Date.parse(submission.submitted_at)).toBe(Date.parse('2025-09-10T14:23:00Z'))
  })
})
