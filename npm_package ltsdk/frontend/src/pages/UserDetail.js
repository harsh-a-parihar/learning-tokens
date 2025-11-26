import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useLmsData from '../hooks/useLmsData'
import './UserDetail.css';

const UserDetail = () => {
  const { username, courseId, userType } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [error, setError] = useState(null);

  const decodedCourseId = courseId ? decodeURIComponent(courseId) : '';
  // use normalized SDK payload to find user data
  const { payload, loading: sdkLoading } = useLmsData('edx', decodedCourseId, !!decodedCourseId)

  const loading = sdkLoading || loadingLocal

  useEffect(() => {
    async function deriveFromPayload() {
      if (!username || !decodedCourseId) {
        setError('Missing required parameters');
        setLoadingLocal(false);
        return;
      }

      setLoadingLocal(true);
      setError(null);
      try {
        const learners = payload?.learners || [];
        const instructors = payload?.instructors || [];
        const findByUsernameOrId = (list) => list.find(u => u.username === username || u.id === username || u.email === username)
        let found = findByUsernameOrId(learners) || findByUsernameOrId(instructors)
        if (found) {
          // build a lightweight userData similar shape to legacy detailed data
          const gradebook = {
            username: found.username || found.id || username,
            email: found.email || null,
            percent: found.percent || null,
            user_id: found.id || null,
            section_breakdown: found.section_breakdown || []
          }
          const account = { name: found.name || null, email: found.email || null, is_active: found.is_active }
          const detailed = { gradebook, account, assignments: found.assignments || [] }
          setUserData(detailed)
        } else {
          setUserData(null)
          setError('User not found in normalized payload')
        }
      } catch (e) {
        setError(e.message || String(e))
      } finally {
        setLoadingLocal(false)
      }
    }

    // wait for SDK payload load
    if (sdkLoading) return
    deriveFromPayload()
  }, [username, decodedCourseId, payload, sdkLoading]);

  if (loading) {
    return (
      <div className="user-detail-page">
        <div className="container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h2>Loading {userType} details...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-detail-page">
        <div className="container">
          <div className="error-container">
            <h2>Error Loading Data</h2>
            <p>{error}</p>
            <button onClick={() => navigate(-1)} className="btn btn-primary">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="user-detail-page">
        <div className="container">
          <div className="error-container">
            <h2>No Data Found</h2>
            <p>Unable to load user data.</p>
            <button onClick={() => navigate(-1)} className="btn btn-primary">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { gradebook, account } = userData;

  return (
    <div className="user-detail-page">
      <div className="container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <button onClick={() => navigate(-1)} className="back-btn">
              ← Back
            </button>
            <div className="header-title">
              <h1>{userType === 'instructor' ? 'Instructor' : 'Student'} Details</h1>
            </div>
          </div>
        </div>

        {/* Profile Overview */}
        <div className="profile-overview">
          <div className="profile-card">
            <div className="profile-avatar">
              <div className="avatar-circle">
                {gradebook.username.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="profile-info">
              <h2>{gradebook.username}</h2>
              <p className="user-email">{account?.email || gradebook.email || 'Email not provided'}</p>
              <div className="progress-section">
                <div className="progress-label">Overall Progress</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(gradebook.percent || 0) * 100}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {gradebook.percent ? `${(gradebook.percent * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="content-grid">
          {/* Profile Information */}
          <div className="content-section">
            <h3>Profile Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Username</span>
                <span className="info-value">{gradebook.username}</span>
              </div>
              <div className="info-item">
                <span className="info-label">User ID</span>
                <span className="info-value">{gradebook.user_id}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email</span>
                <span className="info-value">{account?.email || gradebook.email || 'Not provided'}</span>
              </div>
              {account?.name && (
                <div className="info-item">
                  <span className="info-label">Full Name</span>
                  <span className="info-value">{account.name}</span>
                </div>
              )}
              {account?.bio && (
                <div className="info-item">
                  <span className="info-label">Bio</span>
                  <span className="info-value">{account.bio}</span>
                </div>
              )}
            </div>
          </div>

          {/* Assessment Details */}
          {gradebook.section_breakdown && gradebook.section_breakdown.length > 0 && (
            <div className="content-section">
              <h3>Assessment Details</h3>
              <div className="assessments-list">
                {gradebook.section_breakdown.map((assessment, index) => (
                  <div key={index} className="assessment-card">
                    <div className="assessment-header">
                      <h4>{assessment.label}</h4>
                      <div className={`status-badge ${assessment.attempted ? 'attempted' : 'not-attempted'}`}>
                        {assessment.attempted ? 'Completed' : 'Not Attempted'}
                      </div>
                    </div>
                    <div className="assessment-details">
                      <div className="detail-row">
                        <span className="detail-label">Category:</span>
                        <span className="detail-value">{assessment.category}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Section:</span>
                        <span className="detail-value">{assessment.subsection_name}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Score:</span>
                        <span className="detail-value score">
                          {assessment.score_earned} / {assessment.score_possible}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Percentage:</span>
                        <span className="detail-value percentage">
                          {assessment.percent ? `${(assessment.percent * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Module ID:</span>
                        <span className="detail-value module-id">{assessment.module_id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Information */}
          {account && (
            <div className="content-section">
              <h3>Account Information</h3>
              <div className="info-grid">
                {account.date_joined && (
                  <div className="info-item">
                    <span className="info-label">Date Joined</span>
                    <span className="info-value">{new Date(account.date_joined).toLocaleDateString()}</span>
                  </div>
                )}
                {account.last_login && (
                  <div className="info-item">
                    <span className="info-label">Last Login</span>
                    <span className="info-value">{new Date(account.last_login).toLocaleDateString()}</span>
                  </div>
                )}
                {account.is_active !== undefined && (
                  <div className="info-item">
                    <span className="info-label">Account Status</span>
                    <span className={`info-value status ${account.is_active ? 'active' : 'inactive'}`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="page-footer">
          <Link to="/edx" className="btn btn-secondary">
            Back to Open edX Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UserDetail;
