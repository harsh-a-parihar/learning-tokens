import axios from 'axios';

// Open edX API Configuration
// In development, use relative URLs to leverage the proxy
const isDevelopment = process.env.NODE_ENV === 'development';
const EDX_CONFIG = {
  baseUrl: isDevelopment ? '' : (process.env.REACT_APP_EDX_BASE_URL || 'http://local.openedx.io'),
  username: process.env.REACT_APP_EDX_USERNAME || 'architect',
  password: process.env.REACT_APP_EDX_PASSWORD || 'admin123',
  clientId: process.env.REACT_APP_EDX_CLIENT_ID || 'DjJ5DUyU6qSvqG1IeB4FZosLRjE4b21I8IEd0tfl',
  clientSecret: process.env.REACT_APP_EDX_CLIENT_SECRET || 'EaAcrC2PRbYZYKRmrBis55iO60VnQ1OztHPBUp9NuPJUjDIDzJRzynwfe9bOUgOmqm7LnnP4gtJWJqQ9fjOEPLLSDVZMux980ZIY2zRLGf1dbQ6fz6yfPK4aIR24CErC',
  courseId: process.env.REACT_APP_EDX_COURSE_ID || 'course-v1:IITM+CS101+2025_T1'
};

// Debug: Log configuration (remove in production)
console.log('🔧 EdX API Configuration:', {
  baseUrl: EDX_CONFIG.baseUrl || 'Using proxy',
  username: EDX_CONFIG.username,
  isDevelopment: isDevelopment,
  proxyEnabled: isDevelopment
});

class EdxApiService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Generate fresh access token
  async getFreshToken() {
    try {
      console.log('🔄 Generating fresh access token...');
      
      const url = `${EDX_CONFIG.baseUrl}/oauth2/access_token/`;
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', EDX_CONFIG.username);
      params.append('password', EDX_CONFIG.password);
      params.append('client_id', EDX_CONFIG.clientId);
      params.append('client_secret', EDX_CONFIG.clientSecret);

      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000 // 10 second timeout
      });
      
      this.accessToken = response.data.access_token;
      // Set token expiry (typically 3600 seconds = 1 hour)
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      console.log('✅ Fresh token generated successfully');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Failed to generate access token:');
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Connection refused - check if Open edX is running');
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('Host not found - check DNS resolution');
      } else if (error.response?.status === 401) {
        throw new Error('Invalid credentials - check username/password/client credentials');
      } else if (error.response?.status === 400) {
        throw new Error(`Bad request: ${error.response?.data?.error_description || error.response?.data?.error || 'Unknown error'}`);
      } else {
        throw new Error(`Authentication failed: ${error.response?.data?.error_description || error.message}`);
      }
    }
  }

  // Check if token is expired and refresh if needed
  async ensureValidToken() {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.getFreshToken();
    }
    return this.accessToken;
  }

  // Get auth headers with fresh token
  async getAuthHeaders() {
    const token = await this.ensureValidToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Fetch all courses
  async getCourses() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${EDX_CONFIG.baseUrl}/api/courses/v1/courses/`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching courses:', error.response?.data || error.message);
      throw error;
    }
  }

  // Search courses by name or ID
  async searchCourses(query) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${EDX_CONFIG.baseUrl}/api/courses/v1/courses/?search=${encodeURIComponent(query)}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error searching courses:', error.response?.data || error.message);
      throw error;
    }
  }

  // Fetch course details
  async getCourseDetails(courseId = EDX_CONFIG.courseId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${EDX_CONFIG.baseUrl}/api/courses/v1/courses/${courseId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching course details:', error.response?.data || error.message);
      throw error;
    }
  }

  // Fetch enrolled students using grades API
  async getEnrolledStudents(courseId = EDX_CONFIG.courseId) {
    try {
      console.log('🔍 Fetching enrolled students for course:', courseId);
      const headers = await this.getAuthHeaders();
      
      // Use grades API to get all students enrolled in the course
      const response = await axios.get(`${EDX_CONFIG.baseUrl}/api/grades/v1/courses/${encodeURIComponent(courseId)}/`, { 
        headers
      });
      
      console.log('✅ Grades API response for students:', response.data);
      
      // Extract students from grades data
      const students = [];
      if (response.data && response.data.results) {
        for (const gradeData of response.data.results) {
          if (gradeData.username) {
            students.push({
              username: gradeData.username,
              email: gradeData.email || '',
              name: gradeData.username, // Use username as name since name field is not provided
              course_id: gradeData.course_id || courseId,
              passed: gradeData.passed,
              percent: gradeData.percent,
              letter_grade: gradeData.letter_grade,
              is_active: true
            });
          }
        }
      }
      
      console.log('✅ Extracted students:', students);
      
      // If no students found, try gradebook endpoint
      if (students.length === 0) {
        console.log('🔍 No students found in grades API, trying gradebook...');
        try {
          const gradebookData = await this.getCourseGradebook(courseId);
          if (gradebookData && gradebookData.results) {
            for (const gradeData of gradebookData.results) {
              if (gradeData.username) {
                students.push({
                  user_id: gradeData.user_id,
                  username: gradeData.username,
                  email: gradeData.email || '',
                  name: gradeData.username, // Use username as name
                  course_id: courseId,
                  percent: gradeData.percent,
                  section_breakdown: gradeData.section_breakdown,
                  is_active: true
                });
              }
            }
          }
          console.log('✅ Students from gradebook:', students);
        } catch (gradebookError) {
          console.warn('Gradebook API also failed:', gradebookError.message);
        }
      }
      
      return { results: students };
    } catch (error) {
      console.error('❌ Error fetching enrolled students:', error.response?.data || error.message);
      throw error;
    }
  }

  // Fetch user profile
  async getUserProfile(username) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${EDX_CONFIG.baseUrl}/api/user/v1/accounts/${username}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error.response?.data || error.message);
      throw error;
    }
  }

  // Fetch course instructors using grades API
  async getCourseInstructors(courseId = EDX_CONFIG.courseId) {
    try {
      console.log('🔍 Fetching course instructors for course:', courseId);
      const headers = await this.getAuthHeaders();
      
      // Use grades API to get course staff/instructors
      const response = await axios.get(`${EDX_CONFIG.baseUrl}/api/grades/v1/courses/${encodeURIComponent(courseId)}/`, { 
        headers 
      });
      
      console.log('✅ Grades API response for instructors:', response.data);
      
      // Extract instructors from grades data
      const instructors = [];
      if (response.data && response.data.results) {
        // Look for staff members in the grades data
        for (const gradeData of response.data.results) {
          // Check if this user is staff/instructor
          // Based on the data, "architect" appears to be the instructor
          if (gradeData.username === 'architect' || gradeData.is_staff || gradeData.role === 'instructor' || gradeData.role === 'staff') {
            instructors.push({
              username: gradeData.username,
              email: gradeData.email || '',
              name: gradeData.username, // Use username as name
              role: gradeData.role || 'instructor',
              percent: gradeData.percent,
              passed: gradeData.passed,
              letter_grade: gradeData.letter_grade
            });
          }
        }
      }
      
      // If no instructors found in grades data, try alternative approach
      if (instructors.length === 0) {
        console.log('🔍 No instructors found in grades data, trying course structure API...');
        try {
          const structureResponse = await axios.get(`${EDX_CONFIG.baseUrl}/api/course_structure/v0/courses/${encodeURIComponent(courseId)}`, { 
            headers 
          });
          
          if (structureResponse.data && structureResponse.data.staff) {
            for (const staffMember of structureResponse.data.staff) {
              instructors.push({
                username: staffMember.username,
                email: '',
                name: staffMember.name || staffMember.username,
                role: staffMember.role || 'instructor'
              });
            }
          }
        } catch (structureError) {
          console.warn('Course structure API also failed:', structureError.message);
        }
      }
      
      console.log('✅ Final instructors list:', instructors);
      return instructors;
    } catch (error) {
      console.error('❌ Error fetching course instructors:', error.response?.data || error.message);
      throw error;
    }
  }

  // Fetch course gradebook (comprehensive data)
  async getCourseGradebook(courseId = EDX_CONFIG.courseId) {
    try {
      console.log('🔍 Fetching course gradebook for course:', courseId);
      const headers = await this.getAuthHeaders();

      const response = await axios.get(`${EDX_CONFIG.baseUrl}/api/grades/v1/gradebook/${encodeURIComponent(courseId)}/`, {
        headers
      });

      console.log('✅ Gradebook response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching course gradebook:', error.response?.data || error.message);
      throw error;
    }
  }

  // Fetch detailed user data including assessments
  async getUserDetailedData(courseId, username) {
    try {
      console.log('🔍 Fetching detailed data for user:', username, 'in course:', courseId);
      const headers = await this.getAuthHeaders();

      // Get user's detailed gradebook data
      const gradebookResponse = await axios.get(`${EDX_CONFIG.baseUrl}/api/grades/v1/gradebook/${encodeURIComponent(courseId)}/`, {
        headers
      });

      // Find the specific user's data
      const userData = gradebookResponse.data.results.find(user => user.username === username);
      
      if (!userData) {
        throw new Error(`User ${username} not found in course gradebook`);
      }

      // Get user's account information
      let accountData = null;
      try {
        const accountResponse = await axios.get(`${EDX_CONFIG.baseUrl}/api/user/v1/accounts/${username}`, {
          headers
        });
        accountData = accountResponse.data;
      } catch (accountError) {
        console.warn('Could not fetch account data for user:', username);
      }

      console.log('✅ Detailed user data:', { userData, accountData });
      return {
        gradebook: userData,
        account: accountData
      };
    } catch (error) {
      console.error('❌ Error fetching detailed user data:', error.response?.data || error.message);
      throw error;
    }
  }

  // Fetch course grades - COMMENTED OUT (not currently used, available for future use)
  // async getCourseGrades(courseId = EDX_CONFIG.courseId, username = null) {
  //   try {
  //     const headers = await this.getAuthHeaders();
  //     let url = `${EDX_CONFIG.baseUrl}/api/grades/v1/courses/${encodeURIComponent(courseId)}/`;
  //     
  //     if (username) {
  //       url += `?username=${username}`;
  //     }
  //     
  //     const response = await axios.get(url, { headers });
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error fetching course grades:', error.response?.data || error.message);
  //     throw error;
  //   }
  // }

  // Fetch course blocks (structure) - COMMENTED OUT (not currently used, available for future use)
  // async getCourseBlocks(courseId = EDX_CONFIG.courseId, username = null) {
  //   try {
  //     const headers = await this.getAuthHeaders();
  //     let url = `${EDX_CONFIG.baseUrl}/api/courses/v2/blocks/?course_id=${encodeURIComponent(courseId)}&all_blocks=true&depth=all`;
  //     
  //     if (username) {
  //       url += `&username=${username}`;
  //     }
  //     
  //     const response = await axios.get(url, { headers });
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error fetching course blocks:', error.response?.data || error.message);
  //     throw error;
  //   }
  // }

  // Test API connection
  async testConnection() {
    try {
      await this.getFreshToken();
      const courses = await this.getCourses();
      return {
        success: true,
        message: 'Connection successful',
        coursesCount: courses.results?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.response?.data || error.message
      };
    }
  }
}

// Create and export a singleton instance
const edxApi = new EdxApiService();
export default edxApi;
