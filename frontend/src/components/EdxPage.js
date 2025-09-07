import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCourseData, useEnrolledStudents, useCourseInstructors, useApiConnection } from '../hooks/useEdxData';
import CourseSearch from './CourseSearch';
import './EdxPage.css';

const EdxPage = () => {
  const navigate = useNavigate();
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [, setSearchQuery] = useState('');
  const [hasSelectedCourse, setHasSelectedCourse] = useState(false);
  
  // API connection status
  const { connectionStatus, loading: connectionLoading, testConnection } = useApiConnection();
  
  // Course data - only fetch when a course is selected
  const { data: courseData, loading: courseLoading, error: courseError, refetch: refetchCourse } = useCourseData(selectedCourseId, hasSelectedCourse);
  
  // Enrolled students - only fetch when a course is selected
  const { students, loading: studentsLoading, error: studentsError, refetch: refetchStudents } = useEnrolledStudents(selectedCourseId, hasSelectedCourse);
  
  // Course instructors - only fetch when a course is selected
  const { instructors, loading: instructorsLoading, error: instructorsError, refetch: refetchInstructors } = useCourseInstructors(selectedCourseId, hasSelectedCourse);

  const handleRefresh = () => {
    refetchCourse();
    refetchStudents();
    refetchInstructors();
    testConnection();
  };

  const handleCourseSelect = (course) => {
    setSelectedCourseId(course.id);
    setSearchQuery(course.name || course.id);
    setHasSelectedCourse(true);
  };

  const handleCourseIdChange = (value) => {
    setSearchQuery(value);
    // Only update selectedCourseId if it looks like a valid course ID
    if (value.includes('course-v1:') || value === '') {
      setSelectedCourseId(value);
      setHasSelectedCourse(value.includes('course-v1:'));
    }
  };

  const handleMoreInfo = (username, userType) => {
    if (!selectedCourseId) return;
    
    // Navigate to the user detail page
    const encodedCourseId = encodeURIComponent(selectedCourseId);
    navigate(`/user/${userType}/${encodedCourseId}/${username}`);
  };

  const handleDownloadJsonData = () => {
    if (!hasSelectedCourse || !courseData) {
      alert('Please select a course first to download data.');
      return;
    }

    // Prepare all the data to download
    const downloadData = {
      course: courseData,
      students: students,
      instructors: instructors,
      metadata: {
        downloadedAt: new Date().toISOString(),
        courseId: selectedCourseId,
        totalStudents: students.length,
        totalInstructors: instructors.length,
        connectionStatus: connectionStatus
      }
    };

    // Create and download the JSON file
    const dataStr = JSON.stringify(downloadData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `course-data-${selectedCourseId.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  return (
    <div className="edx-page">
      <div className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            Learning Tokens Dashboard
          </Link>
          <nav className="nav">
            <Link to="/">Dashboard</Link>
            <Link to="/edx" className="active">Open edX</Link>
          </nav>
        </div>
      </div>

      <div className="main-content">
        <div className="container">
          <div className="edx-content">
            {/* Connection Status */}
            <div className="status-card">
              <div className="status-header">
                <h2>Connection Status</h2>
                <div className={`status-indicator ${connectionStatus?.success ? 'active' : 'error'}`}>
                  <div className="status-dot"></div>
                  {connectionLoading ? 'Testing...' : connectionStatus?.success ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              <p>
                {connectionLoading 
                  ? 'Testing connection to Open edX instance...'
                  : connectionStatus?.success 
                    ? `Successfully connected to your Open edX instance. Found ${connectionStatus.coursesCount} courses.`
                    : `Connection failed: ${connectionStatus?.message || 'Unknown error'}`
                }
              </p>
              <button className="btn btn-secondary" onClick={handleRefresh} disabled={connectionLoading}>
                {connectionLoading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>

            {/* Course Selection */}
            <div className="course-selector">
              <h3>Search & Select Course</h3>
              <CourseSearch
                selectedCourseId={selectedCourseId}
                onCourseSelect={handleCourseSelect}
                onCourseIdChange={handleCourseIdChange}
              />
            </div>

            {/* Navigation Tabs */}
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`tab ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
                disabled={!hasSelectedCourse}
              >
                Students ({hasSelectedCourse ? students.length : '?'})
              </button>
              <button 
                className={`tab ${activeTab === 'instructors' ? 'active' : ''}`}
                onClick={() => setActiveTab('instructors')}
                disabled={!hasSelectedCourse}
              >
                Instructors ({hasSelectedCourse ? instructors.length : '?'})
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === 'overview' && (
                <div className="overview-tab">
                  <div className="course-info">
                    <h3>Course Information</h3>
                    {!hasSelectedCourse ? (
                      <div className="validation-message">
                        <div className="validation-icon">🔍</div>
                        <div className="validation-text">
                          Search and select a course above to view its details
                        </div>
                      </div>
                    ) : courseLoading ? (
                      <div className="loading">Loading course details...</div>
                    ) : courseError ? (
                      <div className="error">
                        <div className="error-icon">⚠️</div>
                        <div className="error-text">
                          {courseError.includes('404') 
                            ? 'Course not found. Please check the course ID or search for a valid course.' 
                            : `Error: ${courseError}`
                          }
                        </div>
                      </div>
                    ) : courseData ? (
                      <div className="course-details">
                        <h4>{courseData.name}</h4>
                        <p><strong>Course ID:</strong> {courseData.id}</p>
                        <p><strong>Organization:</strong> {courseData.org}</p>
                        <p><strong>Number:</strong> {courseData.number}</p>
                        <p><strong>Start Date:</strong> {new Date(courseData.start).toLocaleDateString()}</p>
                        <p><strong>End Date:</strong> {new Date(courseData.end).toLocaleDateString()}</p>
                        <p><strong>Duration:</strong> {courseData.effort || 'Not specified'}</p>
                        {courseData.short_description && (
                          <p><strong>Description:</strong> {courseData.short_description}</p>
                        )}
                      </div>
                    ) : (
                      <div className="no-data">No course data available</div>
                    )}
                  </div>

                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon">👥</div>
                      <div className="stat-content">
                        <h4>{students.length}</h4>
                        <p>Enrolled Students</p>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">🎓</div>
                      <div className="stat-content">
                        <h4>{instructors.length}</h4>
                        <p>Instructors</p>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">📊</div>
                      <div className="stat-content">
                        <h4>100%</h4>
                        <p>API Coverage</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'students' && (
                <div className="students-tab">
                  <h3>Enrolled Students</h3>
                  {!hasSelectedCourse ? (
                    <div className="validation-message">
                      <div className="validation-icon">🔍</div>
                      <div className="validation-text">
                        Select a course to view enrolled students
                      </div>
                    </div>
                  ) : studentsLoading ? (
                    <div className="loading">Loading students...</div>
                  ) : studentsError ? (
                    <div className="error">Error: {studentsError}</div>
                  ) : students.length > 0 ? (
                    <div className="students-list">
                      {students.map((student, index) => (
                        <div key={index} className="student-card">
                          <div className="student-info">
                            <h4>{student.username || student.name || 'Unknown User'}</h4>
                            <p><strong>Username:</strong> {student.username}</p>
                            <p><strong>Course:</strong> {student.course_id}</p>
                            <p><strong>Progress:</strong> {student.percent ? `${(student.percent * 100).toFixed(1)}%` : '0%'}</p>
                            <p><strong>Status:</strong> {student.passed ? 'Passed' : 'In Progress'}</p>
                            {student.letter_grade && <p><strong>Grade:</strong> {student.letter_grade}</p>}
                            <p><strong>Active:</strong> {student.is_active ? 'Yes' : 'No'}</p>
                          </div>
                          <button 
                            className="more-info-btn"
                            onClick={() => handleMoreInfo(student.username, 'student')}
                          >
                            More Info
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-data">No students enrolled in this course</div>
                  )}
                </div>
              )}

              {activeTab === 'instructors' && (
                <div className="instructors-tab">
                  <h3>Course Instructors</h3>
                  {!hasSelectedCourse ? (
                    <div className="validation-message">
                      <div className="validation-icon">🔍</div>
                      <div className="validation-text">
                        Select a course to view instructors
                      </div>
                    </div>
                  ) : instructorsLoading ? (
                    <div className="loading">Loading instructors...</div>
                  ) : instructorsError ? (
                    <div className="error">Error: {instructorsError}</div>
                  ) : instructors.length > 0 ? (
                    <div className="instructors-list">
                      {instructors.map((instructor, index) => (
                        <div key={index} className="instructor-card">
                          <div className="instructor-info">
                            <h4>{instructor.username || instructor.name}</h4>
                            <p><strong>Username:</strong> {instructor.username}</p>
                            <p><strong>Email:</strong> {instructor.email || 'Not provided'}</p>
                            <p><strong>Role:</strong> {instructor.role}</p>
                            {instructor.percent && <p><strong>Progress:</strong> {`${(instructor.percent * 100).toFixed(1)}%`}</p>}
                            {instructor.letter_grade && <p><strong>Grade:</strong> {instructor.letter_grade}</p>}
                          </div>
                          <button 
                            className="more-info-btn"
                            onClick={() => handleMoreInfo(instructor.username, 'instructor')}
                          >
                            More Info
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-data">No instructors found for this course</div>
                  )}
                </div>
              )}
            </div>


            <div className="next-steps">
              <h2>Data Export</h2>
              <p>Download complete course data including students, instructors, and course information in JSON format.</p>
              <div className="action-buttons">
                <button 
                  className="btn btn-primary" 
                  onClick={handleDownloadJsonData}
                  disabled={!hasSelectedCourse || !courseData}
                >
                  {!hasSelectedCourse ? 'Select Course First' : 'Download JSON Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EdxPage;
