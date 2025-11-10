import { normalizeCanvas } from '../../src/adapters/canvas'
import sample from '../fixtures/canvas-sample.json'
import { validateNormalized } from '../../src/validator'

describe('Canvas adapter', () => {
  test('normalizes sample payload and passes schema validation', async () => {
    const normalized = await normalizeCanvas(sample as any)
    const res = validateNormalized(normalized)
    expect(res.valid).toBe(true)
  })
})
