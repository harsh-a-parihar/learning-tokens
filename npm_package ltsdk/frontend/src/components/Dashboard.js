import React from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';
import Icon from './Icon';

const Dashboard = () => {
  const [showDataTable, setShowDataTable] = React.useState(false);

  const lmsList = [
    {
  id: 'edx',
  name: 'Open edX',
  description: 'Open source learning management system',
  status: 'active',
  color: '#0066cc',
  icon: 'EdX',
  route: '/edx'
    },
    {
  id: 'canvas',
  name: 'Canvas LMS',
  description: 'Modern learning management platform',
  status: 'active',
  color: '#e13c3c',
  icon: 'Canvas',
  route: '/canvas'
    },
    {
  id: 'google-classroom',
  name: 'Google Classroom',
  description: 'Google\'s learning management platform',
  status: 'active',
  color: '#4285f4',
  icon: 'GClass',
  route: '/google-classroom'
    },
    {
  id: 'moodle',
  name: 'Moodle',
  description: 'Open source course management system',
  status: 'active',
  color: '#f98012',
  icon: 'Moodle',
  route: '/moodle'
    }
  ];

  return (
    <div className="dashboard">
      <div className="main-content">
        <div className="container">
          <div className="welcome-banner">
            <div className="welcome-content">
              <h1>Welcome to LMS Connector, Instructor</h1>
              <p className="instruction-text">Choose an LMS from below to move forward</p>
            </div>
          </div>

          <div className="lms-grid">
            {lmsList.map((lms) => (
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
                    <span className="action-text">Click to manage →</span>
                  ) : (
                    <span className="action-text disabled">Under development</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Data Availability Section */}
          <div style={{ 
            marginTop: '3rem', 
            background: '#f9fafb', 
            borderRadius: '12px', 
            padding: '2rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div>
                <h2 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700', 
                  color: '#111827',
                  marginBottom: '0.5rem'
                }}>
                  -> Data Availability Matrix
                </h2>
                <p style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0'
                }}>
                  Overview of data fields available from each LMS platform
                </p>
              </div>
              <button
                onClick={() => setShowDataTable(!showDataTable)}
                style={{
                  background: '#0066cc',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {showDataTable ? 'Hide Table' : 'Show Table'}
              </button>
            </div>

            {showDataTable && (
              <div style={{ 
                marginTop: '1.5rem',
                overflowX: 'auto',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left', 
                        fontWeight: '700',
                        color: '#111827',
                        borderBottom: '2px solid #e5e7eb',
                        position: 'sticky',
                        left: 0,
                        background: '#f9fafb',
                        minWidth: '200px'
                      }}>
                        Data Field
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'center', 
                        fontWeight: '700',
                        color: '#111827',
                        borderBottom: '2px solid #e5e7eb',
                        minWidth: '150px'
                      }}>
                        edX
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'center', 
                        fontWeight: '700',
                        color: '#111827',
                        borderBottom: '2px solid #e5e7eb',
                        minWidth: '150px'
                      }}>
                        Canvas
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'center', 
                        fontWeight: '700',
                        color: '#111827',
                        borderBottom: '2px solid #e5e7eb',
                        minWidth: '150px'
                      }}>
                        Google Classroom
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'center', 
                        fontWeight: '700',
                        color: '#111827',
                        borderBottom: '2px solid #e5e7eb',
                        minWidth: '150px'
                      }}>
                        Moodle
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Course Information */}
                    <tr style={{ background: '#fef3c7' }}>
                      <td colSpan="5" style={{ 
                        padding: '0.75rem 1rem', 
                        fontWeight: '700',
                        color: '#92400e',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Course Information
                      </td>
                    </tr>
                    <DataRow field="Course ID" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Course Name" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Start Date" edx="●" canvas="●" gclass="✕" gclassReason="Not provided by Google API" moodle="●" />
                    <DataRow field="End Date" edx="●" canvas="●" gclass="✕" gclassReason="Not provided by Google API" moodle="●" />
                    <DataRow field="Course Description" edx="●" canvas="●" gclass="●" moodle="●" />

                    {/* Instructor Information */}
                    <tr style={{ background: '#dbeafe' }}>
                      <td colSpan="5" style={{ 
                        padding: '0.75rem 1rem', 
                        fontWeight: '700',
                        color: '#1e40af',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Instructor Information
                      </td>
                    </tr>
                    <DataRow field="Instructor ID" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Instructor Name" edx="✕" edxReason="Not in current implementation" canvas="✕" canvasReason="Only ID available" gclass="✕" gclassReason="Proxy doesn't fetch teachers" moodle="✕" moodleReason="Not in current implementation" />
                    <DataRow field="Instructor Email" edx="✕" edxReason="Not in current implementation" canvas="✕" canvasReason="Only ID available" gclass="✕" gclassReason="Proxy doesn't fetch teachers" moodle="✕" moodleReason="Not in current implementation" />
                    <DataRow field="Instructor Username" edx="✕" edxReason="Not in current implementation" canvas="✕" canvasReason="Only ID available" gclass="✕" gclassReason="Proxy doesn't fetch teachers" moodle="✕" moodleReason="Not in current implementation" />

                    {/* Student/Learner Information */}
                    <tr style={{ background: '#dcfce7' }}>
                      <td colSpan="5" style={{ 
                        padding: '0.75rem 1rem', 
                        fontWeight: '700',
                        color: '#166534',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Student/Learner Information
                      </td>
                    </tr>
                    <DataRow field="Student ID" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Student Name" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Student Email" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Student Username" edx="●" canvas="●" gclass="◐" gclassReason="Limited by Google API" moodle="●" />
                    <DataRow field="Enrollment Date" edx="●" canvas="●" gclass="✕" gclassReason="Not provided by Google API" moodle="◐" moodleReason="Limited availability" />

                    {/* Assignment Information */}
                    <tr style={{ background: '#fce7f3' }}>
                      <td colSpan="5" style={{ 
                        padding: '0.75rem 1rem', 
                        fontWeight: '700',
                        color: '#9f1239',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Assignment/Activity Information
                      </td>
                    </tr>
                    <DataRow field="Assignment ID" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Assignment Title" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Assignment Type" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Max Score/Points" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Due Date" edx="●" canvas="●" gclass="●" moodle="◐" moodleReason="Quiz specific" />
                    <DataRow field="Subsection/Topic Name" edx="●" canvas="◐" canvasReason="Limited hierarchy" gclass="✕" gclassReason="Flat structure" moodle="●" />
                    <DataRow field="Total Questions (Quizzes)" edx="●" canvas="◐" canvasReason="Limited quiz support" gclass="✕" gclassReason="Not in API response" moodle="●" />

                    {/* Submission Information */}
                    <tr style={{ background: '#e0e7ff' }}>
                      <td colSpan="5" style={{ 
                        padding: '0.75rem 1rem', 
                        fontWeight: '700',
                        color: '#3730a3',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Submission Information
                      </td>
                    </tr>
                    <DataRow field="Submission Date/Time" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Submission Status" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Score/Grade" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Percentage Score" edx="●" canvas="●" gclass="◐" gclassReason="Calculated from points" moodle="●" />
                    <DataRow field="Grading Status" edx="●" canvas="●" gclass="●" moodle="●" />
                    <DataRow field="Individual Question Answers" edx="●" canvas="◐" canvasReason="Limited API support" gclass="✕" gclassReason="Not in API response" moodle="◐" moodleReason="Complex structure" />

                    {/* Discussion/Chat */}
                    <tr style={{ background: '#fef3c7' }}>
                      <td colSpan="5" style={{ 
                        padding: '0.75rem 1rem', 
                        fontWeight: '700',
                        color: '#92400e',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Discussion/Chat Information
                      </td>
                    </tr>
                    <DataRow field="Discussion Forums" edx="●" canvas="●" gclass="✕" gclassReason="Not available in API" moodle="●" />
                    <DataRow field="Messages/Posts" edx="●" canvas="●" gclass="✕" gclassReason="Not available in API" moodle="●" />
                    <DataRow field="Announcements" edx="◐" edxReason="Limited support" canvas="●" gclass="●" moodle="●" />

                    {/* Video/Transcript */}
                    <tr style={{ background: '#f3e8ff' }}>
                      <td colSpan="5" style={{ 
                        padding: '0.75rem 1rem', 
                        fontWeight: '700',
                        color: '#6b21a8',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Video/Transcript Information
                      </td>
                    </tr>
                    <DataRow field="Video Transcripts" edx="●" canvas="✕" canvasReason="Not in standard API" gclass="✕" gclassReason="Not available" moodle="✕" moodleReason="Not in Web Services API" />
                    <DataRow field="Video URLs" edx="●" canvas="◐" canvasReason="External content" gclass="✕" gclassReason="Not available" moodle="◐" moodleReason="External content" />
                  </tbody>
                </table>

                {/* Legend */}
                <div style={{ 
                  padding: '1.5rem',
                  background: '#f9fafb',
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  gap: '2rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem', color: '#059669', fontWeight: 'bold' }}>●</span>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Available</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem', color: '#f59e0b', fontWeight: 'bold' }}>◐</span>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Partial / Limited</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem', color: '#dc2626', fontWeight: 'bold' }}>✕</span>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Not Available</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

// Helper component for table rows
const DataRow = ({ field, edx, edxReason, canvas, canvasReason, gclass, gclassReason, moodle, moodleReason }) => {
  const getSymbolColor = (symbol) => {
    if (symbol === '●') return '#059669'; // green
    if (symbol === '◐') return '#f59e0b'; // orange
    if (symbol === '✕') return '#dc2626'; // red
    return '#374151';
  };

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ 
        padding: '0.75rem 1rem', 
        fontWeight: '500',
        color: '#374151',
        position: 'sticky',
        left: 0,
        background: '#ffffff'
      }}>
        {field}
      </td>
      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '1.25rem', color: getSymbolColor(edx), fontWeight: 'bold' }}>{edx}</span>
          {edxReason && <span style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>({edxReason})</span>}
        </div>
      </td>
      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '1.25rem', color: getSymbolColor(canvas), fontWeight: 'bold' }}>{canvas}</span>
          {canvasReason && <span style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>({canvasReason})</span>}
        </div>
      </td>
      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '1.25rem', color: getSymbolColor(gclass), fontWeight: 'bold' }}>{gclass}</span>
          {gclassReason && <span style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>({gclassReason})</span>}
        </div>
      </td>
      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '1.25rem', color: getSymbolColor(moodle), fontWeight: 'bold' }}>{moodle}</span>
          {moodleReason && <span style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>({moodleReason})</span>}
        </div>
      </td>
    </tr>
  );
};

export default Dashboard;
