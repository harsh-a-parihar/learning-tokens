import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import Icon from './Icon';

const Dashboard = () => {
  const [showDataTable, setShowDataTable] = React.useState(false);
  const [allowedLms, setAllowedLms] = React.useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch('http://localhost:5002/auth/session', { credentials: 'include' });
        if (!mounted) return;
        if (!resp.ok) {
          // Not authenticated, redirect to LMS selection
          navigate('/lms-select');
          return;
        }
        const json = await resp.json();
        if (!json || !json.authenticated) {
          // Not authenticated, redirect to LMS selection
          navigate('/lms-select');
          return;
        }
        if (json && json.authenticated) {
          setAllowedLms(json.session && json.session.allowedLms);
        }
      } catch (e) {
        // On error, redirect to LMS selection
        navigate('/lms-select');
      }
    })();
    return () => { mounted = false }
  }, [navigate])

  const lmsList = [
    {
      id: 'edx',
      name: 'Open edX',
      displayName: 'edX',
      description: 'Open source learning management system',
      status: 'active',
      color: '#0066cc',
      icon: 'EdX',
      route: '/edx'
    },
    {
      id: 'canvas',
      name: 'Canvas LMS',
      displayName: 'Canvas',
      description: 'Modern learning management platform',
      status: 'active',
      color: '#e13c3c',
      icon: 'Canvas',
      route: '/canvas'
    },
    {
      id: 'google-classroom',
      name: 'Google Classroom',
      displayName: 'Google Classroom',
      description: 'Google\'s learning management platform',
      status: 'active',
      color: '#4285f4',
      icon: 'GClass',
      route: '/google-classroom'
    },
    {
      id: 'moodle',
      name: 'Moodle',
      displayName: 'Moodle',
      description: 'Open source course management system',
      status: 'active',
      color: '#f98012',
      icon: 'Moodle',
      route: '/moodle'
    }
  ];

  // Get the authenticated LMS info
  const authenticatedLms = allowedLms ? lmsList.find(lms => lms.id === allowedLms) : null;

  const bannerTitle = authenticatedLms
    ? `Welcome to the ${authenticatedLms.displayName} dashboard, Instructor!!`
    : 'Welcome to your LMS dashboard, Instructor!!'

  const bannerSubtitle = authenticatedLms
    ? 'Your courses are active, please explore.'
    : 'Choose an LMS from below to move forward.'

  return (
    <div className="dashboard">
      <div className="main-content">
        <div className="container">
          <div className="welcome-banner">
            <div className="welcome-content">
              <h1>{bannerTitle}</h1>
              <p className="instruction-text">{bannerSubtitle}</p>
            </div>
          </div>

          <div className="lms-grid">
            {lmsList
              .filter(item => !allowedLms || allowedLms === item.id)
              .map((lms) => (
                <Link
                  key={lms.id}
                  to={lms.route}
                  className={`lms-card ${lms.status}`}
                  style={{ '--card-color': lms.color }}
                >
                  <div className="card-header">
                    <div className="lms-icon"><Icon name={lms.id === 'edx' ? 'cap' : (lms.id === 'canvas' ? 'users' : 'chart')} size={18} /></div>
                    <div className="status-badge">{lms.status === 'active' ? 'Active' : 'Coming Soon'}</div>
                  </div>

                  <div className="card-content">
                    <h3>{lms.name}</h3>
                    <p>{lms.description}</p>
                  </div>

                  <div className="card-footer">
                    {lms.status === 'active' ? (
                      <span className="action-text">Click to manage {lms.name} courses {'→'}</span>
                    ) : (
                      <span className="action-text disabled">Under development</span>
                    )}
                  </div>
                </Link>
              ))}
          </div>

          {/* Data Availability Section */}
          {authenticatedLms && (
            <div style={{
              marginTop: '3rem',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '2rem',
              border: '2px solid #e5e7eb',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.06)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#111827',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ color: authenticatedLms.color }}>→</span>
                    <span>Data Availability Matrix</span>
                  </h2>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '0'
                  }}>
                    Overview of data fields available from {authenticatedLms.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowDataTable(!showDataTable)}
                  style={{
                    background: authenticatedLms.color,
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: `0 2px 4px ${authenticatedLms.color}40`
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = `0 4px 8px ${authenticatedLms.color}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = `0 2px 4px ${authenticatedLms.color}40`;
                  }}
                >
                  {showDataTable ? 'Hide Table' : 'Show Table'}
                </button>
              </div>

              {showDataTable && authenticatedLms && (
                <div style={{
                  marginTop: '1.5rem',
                  overflowX: 'auto',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.875rem',
                    background: '#ffffff'
                  }}>
                    <thead>
                      <tr style={{ background: authenticatedLms.color, color: '#ffffff' }}>
                        <th style={{
                          padding: '1.25rem 1.5rem',
                          textAlign: 'left',
                          fontWeight: '700',
                          color: '#ffffff',
                          borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          Data Field
                        </th>
                        <th style={{
                          padding: '1.25rem 1.5rem',
                          textAlign: 'center',
                          fontWeight: '700',
                          color: '#ffffff',
                          borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          {authenticatedLms.displayName}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Course Information */}
                      <tr style={{ background: '#fef3c7' }}>
                        <td colSpan="2" style={{
                          padding: '0.875rem 1.5rem',
                          fontWeight: '700',
                          color: '#92400e',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          Course Information
                        </td>
                      </tr>
                      <DataRow field="Course ID" lms={authenticatedLms.id} />
                      <DataRow field="Course Name" lms={authenticatedLms.id} />
                      <DataRow field="Start Date" lms={authenticatedLms.id} />
                      <DataRow field="End Date" lms={authenticatedLms.id} />
                      <DataRow field="Course Description" lms={authenticatedLms.id} />

                      {/* Instructor Information */}
                      <tr style={{ background: '#dbeafe' }}>
                        <td colSpan="2" style={{
                          padding: '0.875rem 1.5rem',
                          fontWeight: '700',
                          color: '#1e40af',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          Instructor Information
                        </td>
                      </tr>
                      <DataRow field="Instructor ID" lms={authenticatedLms.id} />
                      <DataRow field="Instructor Name" lms={authenticatedLms.id} />
                      <DataRow field="Instructor Email" lms={authenticatedLms.id} />
                      <DataRow field="Instructor Username" lms={authenticatedLms.id} />

                      {/* Student/Learner Information */}
                      <tr style={{ background: '#dcfce7' }}>
                        <td colSpan="2" style={{
                          padding: '0.875rem 1.5rem',
                          fontWeight: '700',
                          color: '#166534',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          Student/Learner Information
                        </td>
                      </tr>
                      <DataRow field="Student ID" lms={authenticatedLms.id} />
                      <DataRow field="Student Name" lms={authenticatedLms.id} />
                      <DataRow field="Student Email" lms={authenticatedLms.id} />
                      <DataRow field="Student Username" lms={authenticatedLms.id} />
                      <DataRow field="Enrollment Date" lms={authenticatedLms.id} />

                      {/* Assignment Information */}
                      <tr style={{ background: '#fce7f3' }}>
                        <td colSpan="2" style={{
                          padding: '0.875rem 1.5rem',
                          fontWeight: '700',
                          color: '#9f1239',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          Assignment/Activity Information
                        </td>
                      </tr>
                      <DataRow field="Assignment ID" lms={authenticatedLms.id} />
                      <DataRow field="Assignment Title" lms={authenticatedLms.id} />
                      <DataRow field="Assignment Type" lms={authenticatedLms.id} />
                      <DataRow field="Max Score/Points" lms={authenticatedLms.id} />
                      <DataRow field="Due Date" lms={authenticatedLms.id} />
                      <DataRow field="Subsection/Topic Name" lms={authenticatedLms.id} />
                      <DataRow field="Total Questions (Quizzes)" lms={authenticatedLms.id} />

                      {/* Submission Information */}
                      <tr style={{ background: '#e0e7ff' }}>
                        <td colSpan="2" style={{
                          padding: '0.875rem 1.5rem',
                          fontWeight: '700',
                          color: '#3730a3',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          Submission Information
                        </td>
                      </tr>
                      <DataRow field="Submission Date/Time" lms={authenticatedLms.id} />
                      <DataRow field="Submission Status" lms={authenticatedLms.id} />
                      <DataRow field="Score/Grade" lms={authenticatedLms.id} />
                      <DataRow field="Percentage Score" lms={authenticatedLms.id} />
                      <DataRow field="Grading Status" lms={authenticatedLms.id} />
                      <DataRow field="Individual Question Answers" lms={authenticatedLms.id} />

                      {/* Discussion/Chat */}
                      <tr style={{ background: '#fef3c7' }}>
                        <td colSpan="2" style={{
                          padding: '0.875rem 1.5rem',
                          fontWeight: '700',
                          color: '#92400e',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          Discussion/Chat Information
                        </td>
                      </tr>
                      <DataRow field="Discussion Forums" lms={authenticatedLms.id} />
                      <DataRow field="Messages/Posts" lms={authenticatedLms.id} />
                      <DataRow field="Announcements" lms={authenticatedLms.id} />

                      {/* Video/Transcript */}
                      <tr style={{ background: '#f3e8ff' }}>
                        <td colSpan="2" style={{
                          padding: '0.875rem 1.5rem',
                          fontWeight: '700',
                          color: '#6b21a8',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '0.9rem',
                          letterSpacing: '0.02em'
                        }}>
                          Video/Transcript Information
                        </td>
                      </tr>
                      <DataRow field="Video Transcripts" lms={authenticatedLms.id} />
                      <DataRow field="Video URLs" lms={authenticatedLms.id} />
                    </tbody>
                  </table>

                  {/* Legend */}
                  <div style={{
                    padding: '1.5rem',
                    background: '#ffffff',
                    borderTop: '2px solid #e5e7eb',
                    display: 'flex',
                    gap: '2rem',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    borderRadius: '0 0 12px 12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '1.5rem', color: '#059669', fontWeight: 'bold' }}>●</span>
                      <span style={{ fontSize: '0.875rem', color: '#166534', fontWeight: '600' }}>Available</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <span style={{ fontSize: '1.5rem', color: '#f59e0b', fontWeight: 'bold' }}>◐</span>
                      <span style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: '600' }}>Partial / Limited</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                      <span style={{ fontSize: '1.5rem', color: '#dc2626', fontWeight: 'bold' }}>✕</span>
                      <span style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: '600' }}>Not Available</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// Data availability mapping for each LMS
const dataAvailability = {
  'edx': {
    'Course ID': { symbol: '●', reason: null },
    'Course Name': { symbol: '●', reason: null },
    'Start Date': { symbol: '●', reason: null },
    'End Date': { symbol: '●', reason: null },
    'Course Description': { symbol: '●', reason: null },
    'Instructor ID': { symbol: '●', reason: null },
    'Instructor Name': { symbol: '✕', reason: 'Not in current implementation' },
    'Instructor Email': { symbol: '✕', reason: 'Not in current implementation' },
    'Instructor Username': { symbol: '✕', reason: 'Not in current implementation' },
    'Student ID': { symbol: '●', reason: null },
    'Student Name': { symbol: '●', reason: null },
    'Student Email': { symbol: '●', reason: null },
    'Student Username': { symbol: '●', reason: null },
    'Enrollment Date': { symbol: '●', reason: null },
    'Assignment ID': { symbol: '●', reason: null },
    'Assignment Title': { symbol: '●', reason: null },
    'Assignment Type': { symbol: '●', reason: null },
    'Max Score/Points': { symbol: '●', reason: null },
    'Due Date': { symbol: '●', reason: null },
    'Subsection/Topic Name': { symbol: '●', reason: null },
    'Total Questions (Quizzes)': { symbol: '●', reason: null },
    'Submission Date/Time': { symbol: '●', reason: null },
    'Submission Status': { symbol: '●', reason: null },
    'Score/Grade': { symbol: '●', reason: null },
    'Percentage Score': { symbol: '●', reason: null },
    'Grading Status': { symbol: '●', reason: null },
    'Individual Question Answers': { symbol: '●', reason: null },
    'Discussion Forums': { symbol: '●', reason: null },
    'Messages/Posts': { symbol: '●', reason: null },
    'Announcements': { symbol: '◐', reason: 'Limited support' },
    'Video Transcripts': { symbol: '●', reason: null },
    'Video URLs': { symbol: '●', reason: null }
  },
  'canvas': {
    'Course ID': { symbol: '●', reason: null },
    'Course Name': { symbol: '●', reason: null },
    'Start Date': { symbol: '●', reason: null },
    'End Date': { symbol: '●', reason: null },
    'Course Description': { symbol: '●', reason: null },
    'Instructor ID': { symbol: '●', reason: null },
    'Instructor Name': { symbol: '✕', reason: 'Only ID available' },
    'Instructor Email': { symbol: '✕', reason: 'Only ID available' },
    'Instructor Username': { symbol: '✕', reason: 'Only ID available' },
    'Student ID': { symbol: '●', reason: null },
    'Student Name': { symbol: '●', reason: null },
    'Student Email': { symbol: '●', reason: null },
    'Student Username': { symbol: '●', reason: null },
    'Enrollment Date': { symbol: '●', reason: null },
    'Assignment ID': { symbol: '●', reason: null },
    'Assignment Title': { symbol: '●', reason: null },
    'Assignment Type': { symbol: '●', reason: null },
    'Max Score/Points': { symbol: '●', reason: null },
    'Due Date': { symbol: '●', reason: null },
    'Subsection/Topic Name': { symbol: '◐', reason: 'Limited hierarchy' },
    'Total Questions (Quizzes)': { symbol: '◐', reason: 'Limited quiz support' },
    'Submission Date/Time': { symbol: '●', reason: null },
    'Submission Status': { symbol: '●', reason: null },
    'Score/Grade': { symbol: '●', reason: null },
    'Percentage Score': { symbol: '●', reason: null },
    'Grading Status': { symbol: '●', reason: null },
    'Individual Question Answers': { symbol: '◐', reason: 'Limited API support' },
    'Discussion Forums': { symbol: '●', reason: null },
    'Messages/Posts': { symbol: '●', reason: null },
    'Announcements': { symbol: '●', reason: null },
    'Video Transcripts': { symbol: '✕', reason: 'Not in standard API' },
    'Video URLs': { symbol: '◐', reason: 'External content' }
  },
  'google-classroom': {
    'Course ID': { symbol: '●', reason: null },
    'Course Name': { symbol: '●', reason: null },
    'Start Date': { symbol: '✕', reason: 'Not provided by Google API' },
    'End Date': { symbol: '✕', reason: 'Not provided by Google API' },
    'Course Description': { symbol: '●', reason: null },
    'Instructor ID': { symbol: '●', reason: null },
    'Instructor Name': { symbol: '✕', reason: 'Proxy doesn\'t fetch teachers' },
    'Instructor Email': { symbol: '✕', reason: 'Proxy doesn\'t fetch teachers' },
    'Instructor Username': { symbol: '✕', reason: 'Proxy doesn\'t fetch teachers' },
    'Student ID': { symbol: '●', reason: null },
    'Student Name': { symbol: '●', reason: null },
    'Student Email': { symbol: '●', reason: null },
    'Student Username': { symbol: '◐', reason: 'Limited by Google API' },
    'Enrollment Date': { symbol: '✕', reason: 'Not provided by Google API' },
    'Assignment ID': { symbol: '●', reason: null },
    'Assignment Title': { symbol: '●', reason: null },
    'Assignment Type': { symbol: '●', reason: null },
    'Max Score/Points': { symbol: '●', reason: null },
    'Due Date': { symbol: '●', reason: null },
    'Subsection/Topic Name': { symbol: '✕', reason: 'Flat structure' },
    'Total Questions (Quizzes)': { symbol: '✕', reason: 'Not in API response' },
    'Submission Date/Time': { symbol: '●', reason: null },
    'Submission Status': { symbol: '●', reason: null },
    'Score/Grade': { symbol: '●', reason: null },
    'Percentage Score': { symbol: '◐', reason: 'Calculated from points' },
    'Grading Status': { symbol: '●', reason: null },
    'Individual Question Answers': { symbol: '✕', reason: 'Not in API response' },
    'Discussion Forums': { symbol: '✕', reason: 'Not available in API' },
    'Messages/Posts': { symbol: '✕', reason: 'Not available in API' },
    'Announcements': { symbol: '●', reason: null },
    'Video Transcripts': { symbol: '✕', reason: 'Not available' },
    'Video URLs': { symbol: '✕', reason: 'Not available' }
  },
  'moodle': {
    'Course ID': { symbol: '●', reason: null },
    'Course Name': { symbol: '●', reason: null },
    'Start Date': { symbol: '●', reason: null },
    'End Date': { symbol: '●', reason: null },
    'Course Description': { symbol: '●', reason: null },
    'Instructor ID': { symbol: '●', reason: null },
    'Instructor Name': { symbol: '✕', reason: 'Not in current implementation' },
    'Instructor Email': { symbol: '✕', reason: 'Not in current implementation' },
    'Instructor Username': { symbol: '✕', reason: 'Not in current implementation' },
    'Student ID': { symbol: '●', reason: null },
    'Student Name': { symbol: '●', reason: null },
    'Student Email': { symbol: '●', reason: null },
    'Student Username': { symbol: '●', reason: null },
    'Enrollment Date': { symbol: '◐', reason: 'Limited availability' },
    'Assignment ID': { symbol: '●', reason: null },
    'Assignment Title': { symbol: '●', reason: null },
    'Assignment Type': { symbol: '●', reason: null },
    'Max Score/Points': { symbol: '●', reason: null },
    'Due Date': { symbol: '◐', reason: 'Quiz specific' },
    'Subsection/Topic Name': { symbol: '●', reason: null },
    'Total Questions (Quizzes)': { symbol: '●', reason: null },
    'Submission Date/Time': { symbol: '●', reason: null },
    'Submission Status': { symbol: '●', reason: null },
    'Score/Grade': { symbol: '●', reason: null },
    'Percentage Score': { symbol: '●', reason: null },
    'Grading Status': { symbol: '●', reason: null },
    'Individual Question Answers': { symbol: '◐', reason: 'Complex structure' },
    'Discussion Forums': { symbol: '●', reason: null },
    'Messages/Posts': { symbol: '●', reason: null },
    'Announcements': { symbol: '●', reason: null },
    'Video Transcripts': { symbol: '✕', reason: 'Not in Web Services API' },
    'Video URLs': { symbol: '◐', reason: 'External content' }
  }
};

// Helper component for table rows
const DataRow = ({ field, lms }) => {
  const getSymbolColor = (symbol) => {
    if (symbol === '●') return '#059669'; // green
    if (symbol === '◐') return '#f59e0b'; // orange
    if (symbol === '✕') return '#dc2626'; // red
    return '#374151';
  };

  const data = dataAvailability[lms] && dataAvailability[lms][field];
  if (!data) return null;

  const { symbol, reason } = data;

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s ease' }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}>
      <td style={{
        padding: '1rem 1.5rem',
        fontWeight: '500',
        color: '#374151',
        background: '#ffffff',
        fontSize: '0.9rem'
      }}>
        {field}
      </td>
      <td style={{
        padding: '1rem 1.5rem',
        textAlign: 'center',
        background: '#ffffff'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '1.5rem',
            color: getSymbolColor(symbol),
            fontWeight: 'bold',
            lineHeight: '1'
          }}>
            {symbol}
          </span>
          {reason && (
            <span style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              fontStyle: 'italic',
              textAlign: 'center',
              maxWidth: '200px',
              lineHeight: '1.4'
            }}>
              {reason}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

export default Dashboard;
