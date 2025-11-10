import { useState, useEffect, useRef, useCallback } from 'react'
import lmsSdkClient from '../services/lmsSdkClient'

// useLmsData(lms, courseId, enabled = true, opts = {})
// returns { payload, loading, error, refetch }
export default function useLmsData(lms, courseId, enabled = true, opts = {}) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const seq = useRef(0)

  const doFetch = useCallback(async (fresh = false) => {
    if (!enabled || !lms || !courseId) return
    const mySeq = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const p = await lmsSdkClient.getNormalizedCourse(lms, courseId, { fresh })
      // ignore stale responses
      if (mySeq !== seq.current) return
      setPayload(p)
    } catch (err) {
      if (mySeq !== seq.current) return
      setError(err && err.message ? err.message : String(err))
      setPayload(null)
    } finally {
      if (mySeq === seq.current) setLoading(false)
    }
  }, [lms, courseId, enabled])

  useEffect(() => {
    if (!enabled) return
    // auto-fetch when courseId or lms changes
    doFetch(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lms, courseId, enabled])

  const refetch = useCallback((opts = {}) => doFetch(!!opts.fresh), [doFetch])

  return { payload, loading, error, refetch }
}
