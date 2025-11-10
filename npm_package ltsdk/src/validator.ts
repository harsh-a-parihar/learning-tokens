import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import schema from './schema.json'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validateFn = ajv.compile(schema as any)

export function validateNormalized(payload: any): { valid: boolean; errors?: string[] } {
  const valid = validateFn(payload)
  if (valid) return { valid: true }
  const errors = (validateFn.errors || []).map((e: any) => `${e.instancePath} ${e.message}`)
  return { valid: false, errors }
}

export default validateNormalized
