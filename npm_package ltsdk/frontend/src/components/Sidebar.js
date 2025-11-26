import React from 'react'
import { NavLink } from 'react-router-dom'
import './Sidebar.css'

// SVG Icons as components
const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
)

const EdxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </svg>
)

const CanvasIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21,15 16,10 5,21"></polyline>
  </svg>
)

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12l2 2 4-4"></path>
    <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"></path>
    <path d="M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path>
  </svg>
)

const MoodleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14,2 14,8 20,8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10,9 9,9 8,9"></polyline>
  </svg>
)

const allLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon, id: 'dashboard' },
  { to: '/edx', label: 'edX courses', icon: EdxIcon, id: 'edx' },
  { to: '/canvas', label: 'Canvas courses', icon: CanvasIcon, id: 'canvas' },
  { to: '/google-classroom', label: 'Google Classroom courses', icon: GoogleIcon, id: 'google-classroom' },
  { to: '/moodle', label: 'Moodle courses', icon: MoodleIcon, id: 'moodle' }
]

export default function Sidebar() {
  const [allowedLms, setAllowedLms] = React.useState(null)
  const [authenticated, setAuthenticated] = React.useState(false)

  React.useEffect(() => {
    let mounted = true
    const fetchSession = async () => {
      try {
        const resp = await fetch('http://localhost:5002/auth/session', { credentials: 'include' })
        if (!mounted) return
        if (!resp.ok) {
          setAuthenticated(false)
          setAllowedLms(null)
          return
        }
        const json = await resp.json()
        if (json && json.authenticated) {
          setAuthenticated(true)
          setAllowedLms(json.session && json.session.allowedLms)
        } else {
          setAuthenticated(false)
          setAllowedLms(null)
        }
      } catch (e) {
        if (mounted) {
          setAuthenticated(false)
          setAllowedLms(null)
        }
      }
    }
    fetchSession()
    return () => { mounted = false }
  }, [])

  // Filter links: always show Dashboard, only show the authenticated LMS
  const visibleLinks = React.useMemo(() => {
    if (!authenticated || !allowedLms) {
      // If not authenticated, show all links (will be redirected by pages anyway)
      return allLinks
    }
    // Show Dashboard + the authenticated LMS only
    return allLinks.filter(link =>
      link.id === 'dashboard' || link.id === allowedLms
    )
  }, [authenticated, allowedLms])

  return (
    <aside className="lt-sidebar">
      <div className="lt-header">
        <div className="lt-brand">
          <div className="lt-logo">LT</div>
          <div className="lt-brand-text">
            <div className="lt-brand-title">Learning Tokens</div>
            <div className="lt-brand-subtitle">LMS Connector</div>
          </div>
        </div>
      </div>

      <nav className="lt-nav">
        <div className="lt-nav-section">
          <div className="lt-nav-label">Navigation</div>
          {visibleLinks.map(l => {
            const IconComponent = l.icon
            return (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => `lt-link ${isActive ? 'active' : ''}`}
              >
                <span className="lt-link-icon">
                  <IconComponent />
                </span>
                <span className="lt-link-text">{l.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      <div className="lt-footer">
        <div className="lt-sdk-status">
          <div className="lt-status-indicator"></div>
          <div className="lt-sdk-info">
            <div className="lt-sdk-label">SDK Connected</div>
          </div>
        </div>
        {authenticated && (
          <button
            className="lt-logout-btn"
            onClick={async () => {
              try {
                await fetch('http://localhost:5002/auth/logout', { method: 'POST', credentials: 'include' })
              } catch (e) { }
              // reload to clear client state
              window.location.href = '/lms-select'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        )}
      </div>
    </aside>
  )
}
