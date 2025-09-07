import { useState, useEffect, useCallback } from 'react';
import edxApi from '../services/edxApi';

// Hook for fetching course data
export const useCourseData = (courseId, shouldFetch = false) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!courseId || !shouldFetch) return;
    
    setLoading(true);
    setError(null);
    try {
      const courseDetails = await edxApi.getCourseDetails(courseId);
      setData(courseDetails);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, shouldFetch]);

  useEffect(() => {
    if (courseId && shouldFetch) {
      fetchData();
    }
  }, [courseId, shouldFetch, fetchData]);

  return { data, loading, error, refetch: fetchData };
};

// Hook for fetching enrolled students
export const useEnrolledStudents = (courseId, shouldFetch = false) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStudents = useCallback(async () => {
    if (!courseId || !shouldFetch) return;
    
    setLoading(true);
    setError(null);
    try {
      const enrollments = await edxApi.getEnrolledStudents(courseId);
      setStudents(enrollments.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, shouldFetch]);

  useEffect(() => {
    if (courseId && shouldFetch) {
      fetchStudents();
    }
  }, [courseId, shouldFetch, fetchStudents]);

  return { students, loading, error, refetch: fetchStudents };
};

// Hook for fetching course instructors
export const useCourseInstructors = (courseId, shouldFetch = false) => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInstructors = useCallback(async () => {
    if (!courseId || !shouldFetch) return;
    
    setLoading(true);
    setError(null);
    try {
      const instructorsData = await edxApi.getCourseInstructors(courseId);
      setInstructors(instructorsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, shouldFetch]);

  useEffect(() => {
    if (courseId && shouldFetch) {
      fetchInstructors();
    }
  }, [courseId, shouldFetch, fetchInstructors]);

  return { instructors, loading, error, refetch: fetchInstructors };
};

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

// Hook for testing API connection
export const useApiConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const testConnection = useCallback(async () => {
    setLoading(true);
    try {
      const result = await edxApi.testConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: 'Connection test failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    testConnection();
  }, [testConnection]);

  return { connectionStatus, loading, testConnection };
};

// Hook for course search
export const useCourseSearch = (query, debounceMs = 300) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchCourses = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setCourses([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await edxApi.searchCourses(searchQuery);
      setCourses(result.results || []);
    } catch (err) {
      setError(err.message);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCourses(query);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [query, searchCourses, debounceMs]);

  return { courses, loading, error, searchCourses };
};
