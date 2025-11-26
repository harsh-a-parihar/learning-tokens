import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkAuthStatus } from '../../utils/auth';
import './LMSSelect.css';

export default function LMSSelect() {
  const [selectedLMS, setSelectedLMS] = useState(null);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const lmsPlatforms = [
    {
      id: 'edx',
      name: 'edX',
      description: 'Open edX Learning Management System',
      icon: (
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="12" fill="#02262B" />
          <path d="M16 18L25 28L16 38M31 18L40 28L31 38" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #02262B 0%, #0a4f5c 100%)'
    },
    {
      id: 'canvas',
      name: 'Canvas',
      description: 'Instructure Canvas LMS',
      icon: (
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="12" fill="#E2231A" />
          <path d="M28 16C21.373 16 16 21.373 16 28C16 34.627 21.373 40 28 40C34.627 40 40 34.627 40 28C40 21.373 34.627 16 28 16ZM28 36C23.582 36 20 32.418 20 28C20 23.582 23.582 20 28 20C32.418 20 36 23.582 36 28C36 32.418 32.418 36 28 36Z" fill="white" />
          <circle cx="28" cy="28" r="4" fill="white" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #E2231A 0%, #c41e15 100%)'
    },
    {
      id: 'moodle',
      name: 'Moodle',
      description: 'Open-source learning platform',
      icon: (
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="12" fill="#F98012" />
          <path d="M28 16L18 22V34L28 40L38 34V22L28 16Z" stroke="white" strokeWidth="3" strokeLinejoin="round" />
          <path d="M28 28V40" stroke="white" strokeWidth="3" />
          <path d="M18 22L28 28L38 22" stroke="white" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #F98012 0%, #e67210 100%)'
    },
    {
      id: 'google-classroom',
      name: 'Google Classroom',
      description: 'Google\'s educational platform',
      icon: (
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="12" fill="#0F9D58" />
          <path d="M20 20H36V24H20V20Z" fill="white" />
          <path d="M20 27H36V31H20V27Z" fill="white" />
          <path d="M20 34H30V38H20V34Z" fill="white" />
          <circle cx="40" cy="20" r="4" fill="#FBBC04" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #0F9D58 0%, #0d8a4d 100%)'
    }
  ];

  useEffect(() => {
    // Check if user is already authenticated - if yes, redirect to dashboard
    // Only check if we have a session cookie to avoid unnecessary 401 errors
    const checkAuth = async () => {
      // Check if session cookie exists before making auth request
      const hasSessionCookie = document.cookie.split(';').some(cookie =>
        cookie.trim().startsWith('ltsdk_session=')
      );

      if (hasSessionCookie) {
        // Only check auth if we have a session cookie
        const result = await checkAuthStatus();
        if (result.authenticated) {
          // User is authenticated - redirect to dashboard (public routes not accessible)
          navigate('/dashboard', { replace: true });
          return;
        }
      }

      // User is not authenticated - fetch userId for display
      try {
        const response = await fetch('http://localhost:5002/auth/status');
        if (!response.ok) throw new Error('Not authenticated');
        const data = await response.json();
        setUserId(data.userId || 'Instructor');
      } catch (err) {
        console.error('Auth check failed:', err);
        navigate('/auth', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleLMSSelect = (lmsId) => {
    setSelectedLMS(lmsId);
  };

  const handleNext = () => {
    if (selectedLMS) {
      navigate(`/lms-setup/${selectedLMS}`);
    }
  };

  if (loading) {
    return (
      <div className="lms-select-container">
        <div className="loading-state">
          <span className="spinner"></span>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lms-select-container">
      <div className="lms-select-content">
        <div className="welcome-header">
          <div className="welcome-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h1>Welcome, {userId}!</h1>
          <p className="welcome-subtitle">Choose your Learning Management System to get started</p>
        </div>

        <div className="lms-grid">
          {lmsPlatforms.map((lms) => (
            <div
              key={lms.id}
              className={`lms-card ${selectedLMS === lms.id ? 'selected' : ''}`}
              onClick={() => handleLMSSelect(lms.id)}
              style={{ '--card-gradient': lms.gradient }}
            >
              <div className="lms-card-header">
                <div className="lms-icon">{lms.icon}</div>
                {selectedLMS === lms.id && (
                  <div className="check-badge">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M5 9L8 12L13 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="lms-card-body">
                <h3>{lms.name}</h3>
                <p>{lms.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="action-buttons">
          <button
            className={`next-btn ${selectedLMS ? 'active' : 'disabled'}`}
            onClick={handleNext}
            disabled={!selectedLMS}
          >
            {selectedLMS ? (
              <>
                Continue with {lmsPlatforms.find(l => l.id === selectedLMS)?.name}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            ) : (
              'Select an LMS to continue'
            )}
          </button>
        </div>

        <div className="help-section">
          <p>Need help choosing?{' '}
            <button
              type="button"
              className="help-link"
              onClick={(e) => {
                e.preventDefault();
                // TODO: Add LMS comparison functionality
                alert('LMS comparison feature coming soon!');
              }}
            >
              Compare LMS features
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
