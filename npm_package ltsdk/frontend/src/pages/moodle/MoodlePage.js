import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import lmsSdkClient from '../../services/lmsSdkClient'
import '../../components/EdxPage.css'
import '../../components/EdxCards.css'

const MoodlePage = () => {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const checkAndLoad = async () => {
      try {
        const resp = await fetch('http://localhost:5002/auth/session', { credentials: 'include' })
        if (!resp.ok) return navigate('/lms-select')
        const json = await resp.json()
        if (!json || !json.authenticated) return navigate('/lms-select')
        const allowed = json.session && json.session.allowedLms
        if (allowed !== 'moodle') {
          if (allowed && typeof allowed === 'string' && allowed.trim()) return navigate(`/${allowed}`)
          return navigate('/lms-select')
        }
      } catch (e) {
        return navigate('/lms-select')
      }

      const load = async () => {
        setLoading(true)
        setError(null)
        try {
          // Request the course index from the SDK for Moodle
          const res = await lmsSdkClient.searchCourses('moodle', '')
          const list = (res && res.results) || res || []
          if (mounted) setCourses(list)
        } catch (e) {
          if (mounted) setError(e && e.message ? e.message : String(e))
        } finally {
          if (mounted) setLoading(false)
        }
      }
      load()
      return () => { mounted = false }
    }
    checkAndLoad()
    return () => { mounted = false }
  }, [navigate])

  return (
    <div className="edx-page">
      <div className="edx-main-content">
        <div className="edx-container">
          <div className="edx-header-banner">
            <div className="edx-banner-content">
              <h1>Explore the courses in your library!!</h1>
              <p className="edx-subtitle">Manage your course details and grant Learning Tokens to learners.</p>
            </div>
          </div>

          <div className="edx-content">
            <div className="courses-grid">
              {loading ? (
                // show 3 skeleton cards while loading
                [1, 2, 3].map(i => <div key={i} className="skeleton" />)
              ) : error ? (
                <div className="error">Error loading courses: {error}</div>
              ) : courses.length === 0 ? (
                <div className="no-data">No courses available</div>
              ) : (
                courses.map((course) => (
                  <div key={course.id || course.key} className="course-card">
                    <div className="card-top-accent" style={{ background: 'linear-gradient(90deg,#f98012,#ff6b35)' }} />

                    <div className="card-cover" aria-hidden />

                    <div className="card-header">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="card-title">{course.name || course.fullname || course.title || course.display_name || 'Untitled Course'}</div>
                        <div className="card-org">{course.shortname || course.organization || course.course_code}</div>
                      </div>
                      <div className="course-number">{course.category || course.number || ''}</div>
                    </div>

                    <div className="card-body">
                      <p className="card-desc">{course.summary || course.short_description || course.description || course.public_description || ''}</p>
                    </div>

                    <div className="card-footer">
                      <div className="left-meta">
                        <span className="course-id">{course.id || course.key || ''}</span>
                      </div>
                      <div className="right-actions">
                        <span className="card-badge">Active</span>
                        <button className="btn btn-primary" onClick={() => navigate(`/course/moodle/${encodeURIComponent(course.id || course.key)}`)}>Manage</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MoodlePage

