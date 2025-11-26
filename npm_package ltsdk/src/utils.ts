import { Diagnostics } from './types'

/**
 * Shared utility functions for LMS adapters
 */

/**
 * Converts a timestamp (string or number) to ISO 8601 format.
 * Handles various timestamp formats including:
 * - Numeric strings (converts to number)
 * - Unix timestamps in seconds (converts to milliseconds)
 * - Standard Date-compatible formats
 * 
 * @param ts - Timestamp as string or number
 * @returns ISO 8601 formatted string, or undefined if invalid
 */
export function ensureIso(ts?: string | number): string | undefined {
  if (!ts) return undefined
  let t: any = ts
  // numeric strings -> number
  if (typeof t === 'string' && /^\d+$/.test(t)) t = Number(t)
  // Some systems (e.g., Moodle) return unix seconds; if timestamp looks like seconds (less than 1e12) convert to ms
  if (typeof t === 'number' && t < 1e12) t = t * 1000
  const d = new Date(t)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

/**
 * Creates diagnostics object for normalized payload.
 * Counts learners missing email addresses and adds appropriate notes.
 * 
 * @param learners - Array of learner objects (must have email property)
 * @param customNote - Optional custom note message. Defaults to standard message.
 * @returns Diagnostics object with missingEmailCount and notes array
 */
export function createDiagnostics(learners: Array<{ email?: string }>, customNote?: string): Diagnostics {
  const missingEmailCount = learners.filter((l: any) => !l.email).length
  const diagnostics: Diagnostics = { missingEmailCount, notes: [] }
  if (missingEmailCount > 0) {
    diagnostics.notes!.push(customNote || 'Some learners missing email')
  }
  return diagnostics
}

