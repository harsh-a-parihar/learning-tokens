import useLmsData from './useLmsData'
import lmsSdkClient from '../services/lmsSdkClient'
import { useCallback, useState, useEffect } from 'react'

// Backwards-compatible wrappers that route edx-specific hooks to the generic SDK-driven hooks
export const useCourseData = (courseId, shouldFetch = false) => {
  const { payload, loading, error, refetch } = useLmsData('edx', courseId, !!shouldFetch)
  return { data: payload ? payload.course : null, loading, error, refetch }
}

export const useEnrolledStudents = (courseId, shouldFetch = false) => {
  const { payload, loading, error, refetch } = useLmsData('edx', courseId, !!shouldFetch)
  return { students: payload ? (payload.learners || []) : [], loading, error, refetch }
}

export const useCourseInstructors = (courseId, shouldFetch = false) => {
  const { payload, loading, error, refetch } = useLmsData('edx', courseId, !!shouldFetch)
  return { instructors: payload ? (payload.instructors || []) : [], loading, error, refetch }
}

// useCourseSearch: keep same signature but forward to lmsSdkClient.searchCourses
export const useCourseSearch = (query, debounceMs = 300) => {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const searchCourses = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setCourses([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await lmsSdkClient.searchCourses('edx', searchQuery)
      setCourses(res.results || [])
    } catch (err) {
      setError(err.message || String(err))
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [])

  // simple debounce via timeout inside effect
  useCallback(() => { }, [])

  // effect-like debounce implemented by consumers (we keep same exported shape)
  return { courses, loading, error, searchCourses }
}

// Hook for fetching user profiles - COMMENTED OUT (not currently used, available for future use)
// export const useUserProfiles = (usernames) => {
//   const [profiles, setProfiles] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   const fetchProfiles = useCallback(async () => {
//     if (!usernames || usernames.length === 0) return;
//     
//     setLoading(true);
//     setError(null);
//     try {
//       const profilePromises = usernames.map(username => 
//         edxApi.getUserProfile(username).catch(err => {
//           console.warn(`Failed to fetch profile for ${username}:`, err.message);
//           return { username, error: err.message };
//         })
//       );
//       
//       const profilesData = await Promise.all(profilePromises);
//       setProfiles(profilesData);
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   }, [usernames]);

//   useEffect(() => {
//     fetchProfiles();
//   }, [fetchProfiles]);

//   return { profiles, loading, error, refetch: fetchProfiles };
// };

// Hook for testing SDK connection (edx)
export const useApiConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const testConnection = useCallback(async () => {
    setLoading(true)
    try {
      const res = await lmsSdkClient.searchCourses('edx', '')
      setConnectionStatus({ success: true, message: 'Connection OK', coursesCount: (res.results || []).length })
    } catch (err) {
      setConnectionStatus({ success: false, message: err && err.message ? err.message : String(err), error: err })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { testConnection() }, [testConnection])

  return { connectionStatus, loading, testConnection }
}
