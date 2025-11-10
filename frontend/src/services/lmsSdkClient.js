/* lmsSdkClient
 * Client to fetch normalized JSON only from the SDK server.
 * Frontend no longer supports fixture-mode; dev should run the local SDK server.
 * REACT_APP_SDK_BASE_URL controls the SDK base (default http://localhost:5001)
 */

const SDK_BASE = process.env.REACT_APP_SDK_BASE_URL || 'http://localhost:5001'

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`Request failed ${res.status} ${res.statusText}: ${text}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function getNormalizedCourse(lms, courseId, opts = {}) {
  const fresh = opts.fresh ? '?fresh=true' : ''
  const base = SDK_BASE.replace(/\/$/, '')
  const url = `${base}/api/${encodeURIComponent(lms)}/courses/${encodeURIComponent(courseId)}${fresh}`
  return fetchJson(url)
}

export async function searchCourses(lms, q = '') {
  const base = SDK_BASE.replace(/\/$/, '')
  const url = `${base}/api/${encodeURIComponent(lms)}/courses?search=${encodeURIComponent(q)}`
  return fetchJson(url)
}

const client = { getNormalizedCourse, searchCourses }
export default client
