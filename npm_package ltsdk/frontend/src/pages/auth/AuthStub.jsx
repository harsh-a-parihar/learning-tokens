import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { checkAuthStatus } from '../../utils/auth';
import './AuthPage.css';

export default function AuthPage() {
  const [universities, setUniversities] = useState([]);
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUniversities, setLoadingUniversities] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is authenticated - if yes, redirect to dashboard
  // Only check if we have a session cookie to avoid unnecessary 401 errors
  useEffect(() => {
    const checkAuth = async () => {
      // Check if session cookie exists before making auth request
      // This prevents 401 errors for unauthenticated users
      const hasSessionCookie = document.cookie.split(';').some(cookie =>
        cookie.trim().startsWith('ltsdk_session=')
      );

      if (!hasSessionCookie) {
        // No session cookie - user is definitely not authenticated, skip check
        return;
      }

      // Only check auth if we have a session cookie
      const result = await checkAuthStatus();
      if (result.authenticated) {
        // User is authenticated - redirect to dashboard (public routes not accessible)
        navigate('/dashboard', { replace: true });
      }
    };
    checkAuth();
  }, [navigate]);

  // Check if redirected from protected route with message
  useEffect(() => {
    if (location.state?.message) {
      setError(location.state.message);
    }
  }, [location.state]);

  // Fetch universities on mount
  useEffect(() => {
    const fetchUniversities = async () => {
      try {
        const response = await fetch('http://localhost:5002/auth/universities');
        if (!response.ok) throw new Error('Failed to load universities');
        const data = await response.json();
        setUniversities(data.universities || []);
      } catch (err) {
        setError('Failed to load universities. Please ensure the auth server is running on :5002.');
      } finally {
        setLoadingUniversities(false);
      }
    };

    fetchUniversities();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedUniversity) {
      setError('Please select your university');
      return;
    }

    if (!key.trim()) {
      setError('LTSDK key is required');
      return;
    }

    if (key.trim().length < 8) {
      setError('LTSDK key must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5002/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university: selectedUniversity,
          key: key.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (!data.valid) {
        throw new Error('Invalid LTSDK key');
      }

      // Success - redirect to LMS selection
      navigate('/lms-select');
    } catch (err) {
      setError(err.message || 'Connection failed. Please ensure the auth server is running on :5002.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingUniversities) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading-state">
            <span className="spinner"></span>
            <p>Loading universities...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="8" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="2" />
              <path d="M16 24L22 30L32 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1>Connect to Your LTSDK</h1>
          <p>Select your university and enter your LTSDK access key to begin</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="university">University / Institution</label>
            <select
              id="university"
              value={selectedUniversity}
              onChange={(e) => setSelectedUniversity(e.target.value)}
              className={error && !selectedUniversity ? 'error' : ''}
              disabled={loading}
            >
              <option value="">Select your university</option>
              {universities.map((uni) => (
                <option key={uni.id} value={uni.id}>
                  {uni.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="ltsdk-key">LTSDK Access Key</label>
            <input
              id="ltsdk-key"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter your university-issued LTSDK key"
              className={error ? 'error' : ''}
              disabled={loading}
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Verifying...
              </>
            ) : (
              <>
                Continue
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an LTSDK key?</p>
          <button
            type="button"
            className="help-link"
            onClick={(e) => {
              e.preventDefault();
              // TODO: Add help/contact functionality
              alert('Please contact your institution administrator for an LTSDK access key.');
            }}
          >
            Contact your institution administrator
          </button>
        </div>
      </div>
    </div>
  );
}
