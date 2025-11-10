import { normalizeMoodle } from '../../src/adapters/moodle'
import sample from '../fixtures/moodle-sample.json'
import { validateNormalized } from '../../src/validator'

describe('Moodle adapter', () => {
  test('normalizes sample payload and passes schema validation', async () => {
    const normalized = await normalizeMoodle(sample as any)
    const res = validateNormalized(normalized)
    expect(res.valid).toBe(true)
  })
})
