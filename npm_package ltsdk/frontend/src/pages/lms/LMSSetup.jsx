import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { checkAuthStatus } from '../../utils/auth';
import './LMSSetup.css';

export default function LMSSetup() {
  const { lms } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthMessage, setOauthMessage] = useState('');
  const [copiedUri, setCopiedUri] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Check if user is authenticated - if yes, redirect to dashboard
  // Only check if we have a session cookie to avoid unnecessary 401 errors
  useEffect(() => {
    const checkAuth = async () => {
      // Check if session cookie exists before making auth request
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

  const lmsConfig = {
    'canvas': {
      name: 'Canvas',
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="#E2231A" />
          <path d="M32 18C24.268 18 18 24.268 18 32C18 39.732 24.268 46 32 46C39.732 46 46 39.732 46 32C46 24.268 39.732 18 32 18ZM32 41C27.029 41 23 36.971 23 32C23 27.029 27.029 23 32 23C36.971 23 41 27.029 41 32C41 36.971 36.971 41 32 41Z" fill="white" />
          <circle cx="32" cy="32" r="5" fill="white" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #E2231A 0%, #c41e15 100%)',
      accentColor: '#E2231A',
      defaultBaseUrl: 'https://canvas.instructure.com/api/v1/',
      fields: [
        { id: 'apiToken', label: 'API Key', type: 'password', placeholder: 'Your Canvas API token', required: true }
      ]
    },
    'edx': {
      name: 'edX',
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="#02262B" />
          <path d="M18 20L28 32L18 44M36 20L46 32L36 44" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #02262B 0%, #0a4f5c 100%)',
      accentColor: '#02262B',
      defaultBaseUrl: 'http://local.openedx.io',
      fields: [
        { id: 'clientId', label: 'edX Client ID', type: 'text', placeholder: 'Your edX OAuth Client ID', required: true },
        { id: 'clientSecret', label: 'edX Client Secret', type: 'password', placeholder: 'Your edX OAuth Client Secret', required: true }
      ]
    },
    'moodle': {
      name: 'Moodle',
      icon: (
        <svg width="64" height="64" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="12" fill="#F98012" />
          <path d="M28 16L18 22V34L28 40L38 34V22L28 16Z" stroke="white" strokeWidth="3" strokeLinejoin="round" />
          <path d="M28 28V40" stroke="white" strokeWidth="3" />
          <path d="M18 22L28 28L38 22" stroke="white" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #F98012 0%, #e67210 100%)',
      accentColor: '#F98012',
      defaultBaseUrl: 'http://localhost:8888/moodle500',
      fields: [
        { id: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Your Moodle API token', required: true }
      ]
    },
    'google-classroom': {
      name: 'Google Classroom',
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="#0F9D58" />
          <path d="M22 22H42V27H22V22Z" fill="white" />
          <path d="M22 30H42V35H22V30Z" fill="white" />
          <path d="M22 38H35V43H22V38Z" fill="white" />
          <circle cx="46" cy="22" r="5" fill="#FBBC04" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #0F9D58 0%, #0d8a4d 100%)',
      accentColor: '#0F9D58',
      fields: [
        { id: 'clientId', label: 'OAuth Client ID', type: 'text', placeholder: 'Your Google OAuth Client ID', required: true },
        { id: 'clientSecret', label: 'OAuth Client Secret', type: 'password', placeholder: 'Your Google OAuth Client Secret', required: true }
      ]
    }
  };

  const currentLMS = lmsConfig[lms];

  // Initialize formData with default baseUrl when component mounts or LMS changes
  useEffect(() => {
    const defaultBaseUrl = lmsConfig[lms]?.defaultBaseUrl;
    if (defaultBaseUrl) {
      setFormData(prev => {
        // Only update if baseUrl is not already set
        if (prev.baseUrl) return prev;
        return {
          ...prev,
          baseUrl: defaultBaseUrl
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lms]); // Only depend on lms, not lmsConfig (which is a constant object)

  if (!currentLMS) {
    return (
      <div className="lms-setup-container">
        <div className="error-state">
          <h2>Invalid LMS</h2>
          <button onClick={() => navigate('/lms-select')} className="back-btn">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleInputChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
    setError(null);
  };

  const copyRedirectUri = (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2500);
    } catch (e) {
      setCopiedUri(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    const missingFields = currentLMS.fields
      .filter(field => field.required && !formData[field.id]?.trim())
      .map(field => field.label);

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    setLoading(true);

    try {
      // Ensure baseUrl is included in credentials (auto-populated from defaultBaseUrl)
      const credentialsToSubmit = { ...formData };
      if (currentLMS.defaultBaseUrl && !credentialsToSubmit.baseUrl) {
        credentialsToSubmit.baseUrl = currentLMS.defaultBaseUrl;
      }
      // For edX, ensure redirectUri is included (default value)
      if (lms === 'edx' && !credentialsToSubmit.redirectUri) {
        credentialsToSubmit.redirectUri = 'http://localhost:5002/auth/edx/callback';
      }
      // For Google Classroom, ensure redirectUri is included (default value)
      if (lms === 'google-classroom' && !credentialsToSubmit.redirectUri) {
        credentialsToSubmit.redirectUri = 'http://localhost:5002/api/google/callback';
      }

      // Debug: log the payload and indicate request is starting
      console.debug('[LMSSetup] submitting credentials for', lms, credentialsToSubmit)
      // Use a relative path so the dev server proxy can forward to the auth server
      const response = await fetch('/auth/lms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lms: lms,
          credentials: credentialsToSubmit
        })
      });
      const data = await response.json();
      console.debug('[LMSSetup] /auth/lms response', response.status, data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save credentials');
      }

      // If the auth server returned an oauthUrl, open the consent window and
      // wait for the auth server to complete the callback and persist tokens.
      if (data && data.oauthUrl) {
        // open popup for consent
        try {
          const flowStart = Date.now();
          window.open(data.oauthUrl, 'lt_oauth', 'width=900,height=700');
          setOauthPending(true);
          const lmsName = lms === 'google-classroom' ? 'Google Classroom' : (lms === 'edx' ? 'edX' : lms);
          setOauthMessage(`Waiting for ${lmsName} authorization...`);

          // Listen for postMessage from the popup which will include the session id
          // (auth-server posts { ltsdk_session }). If cookies are blocked during the
          // callback, we will include this session id in the `X-LTSDK-SESSION` header
          // so the auth server can identify the session during polling.
          let receivedSession = null;
          function onMessage(e) {
            try {
              if (!e || !e.data) return;
              const payload = e.data;
              if (payload && payload.ltsdk_session) {
                console.debug('[LMSSetup] received postMessage from OAuth popup', payload);
                receivedSession = payload.ltsdk_session;
                // update oauth message
                setOauthMessage('Authorization complete. Finalizing...');
              }
            } catch (err) {
              console.debug('[LMSSetup] error parsing postMessage', err);
            }
          }
          window.addEventListener('message', onMessage, false);

          // Poll the auth server token endpoint for this LMS until token appears
          const pollInterval = 1500;
          const maxAttempts = 60; // ~90 seconds
          let attempts = 0;
          const intervalId = setInterval(async () => {
            attempts += 1;
            try {
              const headers = {};
              if (receivedSession) headers['X-LTSDK-SESSION'] = receivedSession;
              const tokenResp = await fetch(`/auth/lms/${encodeURIComponent(lms)}/token`, { method: 'GET', credentials: 'include', headers });
              if (tokenResp.ok) {
                const tokenData = await tokenResp.json();
                // token present -> only accept if it was obtained after we started this OAuth flow
                if (tokenData && tokenData.token && tokenData.token.access_token) {
                  const obtained = tokenData.obtainedAt || tokenData.obtainedAt === 0 ? Number(tokenData.obtainedAt) : null;
                  // If obtainedAt is provided, require it to be >= flowStart (allow small clock skew)
                  if (!obtained || obtained >= (flowStart - 5000)) {
                    clearInterval(intervalId);
                    window.removeEventListener('message', onMessage, false);
                    setOauthPending(false);
                    setOauthMessage('Authorization complete.');
                    // Do not attempt to programmatically close the popup (COOP may block it).
                    navigate('/dashboard');
                  } else {
                    // token existed from before this flow; ignore and continue polling
                    console.debug('[LMSSetup] found existing token but obtainedAt is older than flow start; waiting for new token');
                  }
                }
              }
            } catch (e) {
              // ignore network errors while polling
            }
            if (attempts >= maxAttempts) {
              clearInterval(intervalId);
              window.removeEventListener('message', onMessage, false);
              setOauthPending(false);
              setOauthMessage('Authorization timed out. Please try again.');
            }
          }, pollInterval);
        } catch (e) {
          setError('Failed to open OAuth window. Please open the provided URL manually.');
        }
        return
      }

      // No client-side refreshToken saving here; auth-server will persist tokens server-side after OAuth.

      // The auth server performs authentication for Canvas/Moodle and will return { authenticated: true } on success.
      // Show success message before navigating (similar to OAuth success page)
      if (data && (data.authenticated === true || data.success === true)) {
        // Show success state
        setAuthSuccess(true);
        setLoading(false);

        // Navigate after 2 seconds to allow user to see success message
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
        return
      }

      // If server returned not authenticated or an error, show details
      if (data && data.error) {
        setError(data.error + (data.details ? (': ' + data.details) : ''))
        return
      }
    } catch (err) {
      setError(err.message || 'Connection failed. Please ensure the auth server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lms-setup-container" style={{
      '--lms-gradient': currentLMS.gradient,
      '--lms-accent': currentLMS.accentColor
    }}>
      <div className="lms-setup-card">
        <div className="lms-setup-header">
          <div className="lms-icon-wrapper">{currentLMS.icon}</div>
          <h1>Configure {currentLMS.name}</h1>
          <p className="subtitle">Enter your {currentLMS.name} credentials to connect your account</p>
        </div>

        <form onSubmit={handleSubmit} className="lms-setup-form">
          {currentLMS.fields.map((field) => (
            <div key={field.id} className="form-field">
              <label htmlFor={field.id}>
                {field.label}
                {field.required && <span className="required-mark">*</span>}
              </label>
              <input
                id={field.id}
                type={field.type}
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                className={error ? 'has-error' : ''}
                disabled={loading}
                required={field.required}
              />
              {lms === 'google-classroom' && field.id === 'clientSecret' && (
                <div className="oauth-redirect-hint" role="note" aria-label="Google OAuth redirect URI">
                  <div className="hint-title">Redirect URI (register this in Google Cloud):</div>
                  <div className="hint-uri-row">
                    <div className="hint-uri">http://localhost:5002/api/google/callback</div>
                    <button type="button" className="copy-btn" onClick={() => copyRedirectUri('http://localhost:5002/api/google/callback')} aria-label="Copy redirect URI">{copiedUri ? 'Copied' : 'Copy'}</button>
                  </div>
                  <div className="hint-note">This exact URI must be added to your OAuth client in Google Cloud Console.</div>
                </div>
              )}
              {lms === 'edx' && field.id === 'clientSecret' && (
                <div className="oauth-redirect-hint" role="note" aria-label="edX OAuth redirect URI">
                  <div className="hint-title">Redirect URI (register this in Open edX admin portal):</div>
                  <div className="hint-uri-row">
                    <div className="hint-uri">http://localhost:5002/auth/edx/callback</div>
                    <button type="button" className="copy-btn" onClick={() => copyRedirectUri('http://localhost:5002/auth/edx/callback')} aria-label="Copy redirect URI">{copiedUri ? 'Copied' : 'Copy'}</button>
                  </div>
                  <div className="hint-note">This exact URI must be added to your OAuth client in Open edX admin portal.</div>
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="error-alert">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M10 6V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="10" cy="14" r="0.5" fill="currentColor" />
              </svg>
              {error}
            </div>
          )}

          {oauthPending && (
            <div className="oauth-pending">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M10 6V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {oauthMessage}
            </div>
          )}

          {authSuccess && (
            <div className="auth-success" style={{
              padding: '16px',
              backgroundColor: '#e6ffed',
              border: '1px solid #c8f6d0',
              borderRadius: '8px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '8px', color: '#0b6b2d' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ color: '#0b6b2d', fontWeight: '600', marginBottom: '4px' }}>
                {currentLMS.name} authorization complete
              </div>
              <div style={{ color: '#084b2a', fontSize: '14px' }}>
                The Learning Tokens SDK has been configured successfully. Redirecting...
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/lms-select')}
              disabled={loading}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Connecting...
                </>
              ) : (
                <>
                  Connect {currentLMS.name}
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>



        <div className="help-footer">
          <p>Need help finding your credentials?</p>
          <button type="button" className="help-link" onClick={() => { /* TODO: link to setup docs */ }}>
            View {currentLMS.name} setup guide
          </button>
        </div>
      </div>
    </div>
  );
}
