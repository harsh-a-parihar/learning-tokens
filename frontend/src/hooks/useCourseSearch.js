import { useState, useEffect, useCallback } from 'react'
import lmsSdkClient from '../services/lmsSdkClient'

export default function useCourseSearch(lms = 'edx', query = '') {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const search = useCallback(async (q) => {
    setLoading(true)
    setError(null)
    try {
      const res = await lmsSdkClient.searchCourses(lms, q || '')
      setCourses((res && res.results) || [])
    } catch (e) {
      setError(e && e.message ? e.message : String(e))
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [lms])

  useEffect(() => {
    if (!query || query.length < 2) {
      setCourses([])
      return
    }
    const id = setTimeout(() => search(query), 200)
    return () => clearTimeout(id)
  }, [query, search])

  return { courses, loading, error }
}
