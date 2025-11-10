import path from 'path'
import fs from 'fs'
import { normalizeMoodle } from '../../src/adapters/moodle'
import { normalizeCanvas } from '../../src/adapters/canvas'
import { normalizeEdx } from '../../src/adapters/edx'
import { normalizeGoogleClassroom } from '../../src/adapters/googleClassroom'
import validateNormalized from '../../src/validator'

function loadFixture(p: string) {
  const fp = path.join(__dirname, '..', 'fixtures', p)
  return JSON.parse(fs.readFileSync(fp, 'utf8'))
}

function stripUndefined(obj: any): any {
  if (obj === undefined) return undefined
  if (obj === null) return null
  if (Array.isArray(obj)) return obj.map(stripUndefined)
  if (typeof obj === 'object') {
    const out: any = {}
    Object.keys(obj).forEach(k => {
      const v = obj[k]
      const sv = stripUndefined(v)
      if (sv !== undefined) out[k] = sv
    })
    return out
  }
  return obj
}

describe('connector/adapters smoke tests', () => {
  jest.setTimeout(20000)

  test('moodle adapter matches fixture', async () => {
    const raw = loadFixture('moodle-sample.json')
  const normalizedRaw = await normalizeMoodle(raw as any)
  const fixture = loadFixture('moodle-normalized.json')
  // make comparison deterministic: remove dynamic fetchedAt and strip undefined keys
  const normalized = stripUndefined(Object.assign({}, normalizedRaw, { source: Object.assign({}, normalizedRaw.source, { fetchedAt: fixture.source?.fetchedAt }) }))
  const fixedFixture = stripUndefined(fixture)
  expect(normalized).toEqual(fixedFixture)
  const { valid, errors } = validateNormalized(normalized)
  expect(valid).toBe(true)
  })

  test('canvas adapter matches fixture', async () => {
    const raw = loadFixture('canvas-sample.json')
  const normalizedRaw = await normalizeCanvas(raw as any)
  const fixture = loadFixture('canvas-normalized.json')
  const normalized = stripUndefined(Object.assign({}, normalizedRaw, { source: Object.assign({}, normalizedRaw.source, { fetchedAt: fixture.source?.fetchedAt }) }))
  const fixedFixture = stripUndefined(fixture)
  expect(normalized).toEqual(fixedFixture)
  const { valid } = validateNormalized(normalized)
  expect(valid).toBe(true)
  })

  test('edx adapter matches fixture', async () => {
    const raw = loadFixture('edx-sample.json')
  const normalizedRaw = await normalizeEdx(raw as any)
  const fixture = loadFixture('edx-normalized.json')
  const normalized = stripUndefined(Object.assign({}, normalizedRaw, { source: Object.assign({}, normalizedRaw.source, { fetchedAt: fixture.source?.fetchedAt }) }))
  const fixedFixture = stripUndefined(fixture)
  expect(normalized).toEqual(fixedFixture)
  const { valid } = validateNormalized(normalized)
  expect(valid).toBe(true)
  })

  test('google classroom adapter matches fixture', async () => {
    const raw = loadFixture('googleclassroom-sample.json')
  const normalizedRaw = await normalizeGoogleClassroom(raw as any)
  const fixture = loadFixture('googleclassroom-normalized.json')
  const normalized = stripUndefined(Object.assign({}, normalizedRaw, { source: Object.assign({}, normalizedRaw.source, { fetchedAt: fixture.source?.fetchedAt }) }))
  const fixedFixture = stripUndefined(fixture)
  expect(normalized).toEqual(fixedFixture)
  const { valid } = validateNormalized(normalized)
  expect(valid).toBe(true)
  })
})

export {}
