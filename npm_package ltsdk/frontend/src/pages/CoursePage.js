import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import lmsSdkClient from '../services/lmsSdkClient'
import '../components/EdxPage.css'

import { syncLmsDataToLearningTokens } from '../services/LmsSync'

// Progress Bar Component
const ProgressBar = ({ steps, currentStep }) => {
  return (
    <div style={{
      background: '#ffffff',
      padding: '2rem',
      borderRadius: '16px',
      marginBottom: '2rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 2
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: index <= currentStep ? '#10b981' : '#e5e7eb',
                color: index <= currentStep ? '#ffffff' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '0.875rem',
                transition: 'all 0.3s ease'
              }}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              <div style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: index <= currentStep ? '#111827' : '#9ca3af',
                textAlign: 'center',
                minWidth: '80px'
              }}>
                {step.title}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: '2px',
                background: index < currentStep ? '#10b981' : '#e5e7eb',
                margin: '0 1rem',
                marginTop: '-20px',
                transition: 'all 0.3s ease'
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

const Section = ({ title, children }) => (
  <section style={{
    marginBottom: 24,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
  }}>
    <h3 style={{
      margin: 0,
      fontSize: '1.25rem',
      fontWeight: '600',
      color: '#111827',
      padding: '1.5rem 2rem',
      background: '#f8fafc',
      borderBottom: '1px solid #f1f5f9'
    }}>{title}</h3>
    <div style={{ padding: '2rem' }}>{children}</div>
  </section>
)

export default function CoursePage() {
  const { lms, courseId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [expandedIds, setExpandedIds] = useState(new Set())
  
  // Additional fields required for Learning Tokens import
  const [ltCategory, setLtCategory] = useState('General Education')
  const [ltSkills, setLtSkills] = useState('Completion')
  
  // Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState(null)

  const steps = [
    { id: 'course', title: 'Course Info' },
    { id: 'instructors', title: 'Instructors' },
    { id: 'students', title: 'Students' },
    { id: 'assignments', title: 'Assignments' },
    { id: 'review', title: 'Review' },
    { id: 'tokens', title: 'Assign Tokens' }
  ]

  // Helper function to truncate and toggle assignment IDs
  const truncateId = (id, maxLength = 8) => {
    if (!id || id.length <= maxLength) return id
    return id.substring(0, maxLength)
  }

  const toggleIdExpansion = (assignmentId) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(assignmentId)) {
      newExpanded.delete(assignmentId)
    } else {
      newExpanded.add(assignmentId)
    }
    setExpandedIds(newExpanded)
  }

  // Navigation helper to go back to specific sections
  const navigateToSection = (sectionName) => {
    const sectionIndex = steps.findIndex(step => step.id === sectionName)
    if (sectionIndex !== -1) {
      setCurrentStep(sectionIndex)
    }
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        console.log('Loading course data for:', { lms, courseId })
        const res = await lmsSdkClient.getNormalizedCourse(lms, courseId)
        console.log('Raw API response:', res)

        // Normalize possible SDK response shapes into a single course object.
        const processed = (() => {
          if (res == null) return null
          // If the SDK returned an array, take the first element
          if (Array.isArray(res)) return res[0] || null

          // If response contains results (index style), find matching id or take first
          if (res.results && Array.isArray(res.results)) {
            const decodedId = decodeURIComponent(String(courseId || ''))
            const candidate = res.results.find(r => String(r.id) === String(courseId) || String(r.id) === decodedId || encodeURIComponent(String(r.id)) === String(courseId))
            return candidate || res.results[0] || null
          }

          // If response wraps payload or course keys prefer payload but
          // otherwise keep the whole response object so we don't lose
          // related arrays like instructors/learners which may live at
          // the same level as `course`.
          if (res.payload && (typeof res.payload === 'object')) return res.payload
          // Do NOT return only `res.course` here — returning only the nested
          // course object loses instructors/learners and other lists. Keep the
          // full response so UI can render related arrays.

          // If response is an object and only contains a top-level 'source' plus actual fields, remove source
          if (typeof res === 'object') {
            const copy = { ...res }
            if (copy.source) delete copy.source
            return copy
          }

          // fallback
          return res
        })()

        console.log('Processed course data:', processed)

        // If the SDK returned an error object, surface it to the UI
        if (processed && (processed.error || processed.message)) {
          const msg = processed.error || processed.message || JSON.stringify(processed)
          console.error('SDK returned error payload for course:', msg)
          if (mounted) {
            setError(msg)
            setCourse(null)
          }
          return
        }

        // Some SDKs return { results: [course] } even for single fetches
        if (processed && processed.results && Array.isArray(processed.results) && processed.results.length === 1) {
          if (mounted) setCourse(processed.results[0])
          return
        }

        // Some server responses wrap the normalized payload inside a `payload` key
        // e.g. { source: 'live', payload: { ...normalized... } }
        let outCourse = processed
        if (processed && processed.payload && typeof processed.payload === 'object') {
          outCourse = processed.payload
        }

        if (mounted) setCourse(outCourse)
      } catch (e) {
        console.error('Error loading course:', e)
        if (mounted) setError(e && e.message ? e.message : String(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [lms, courseId])

  const downloadJson = () => {
    if (!course) return
    const blob = new Blob([JSON.stringify(course, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lms}-${courseId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPDF = () => {
    if (!course) return

    // Create a printable HTML page
    const courseMeta = course.course || {}
    const instructors = course.instructors || []
    const learners = course.learners || []

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${lms.toUpperCase()} - ${courseMeta.name || courseId}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1f2937; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
          h3 { color: #6b7280; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #d1d5db; padding: 12px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: 600; color: #1f2937; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 10px; margin: 15px 0; }
          .info-label { font-weight: 600; color: #6b7280; }
          .info-value { color: #1f2937; }
          @media print {
            body { margin: 0; }
            h1 { page-break-after: avoid; }
            table { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${lms.toUpperCase()} Course Report</h1>
        
        <h2>Course Information</h2>
        <div class="info-grid">
          <div class="info-label">Course ID:</div>
          <div class="info-value">${courseMeta.id || 'N/A'}</div>
          <div class="info-label">Course Name:</div>
          <div class="info-value">${courseMeta.name || 'N/A'}</div>
          <div class="info-label">Start Date:</div>
          <div class="info-value">${courseMeta.startDate || 'N/A'}</div>
          <div class="info-label">End Date:</div>
          <div class="info-value">${courseMeta.endDate || 'N/A'}</div>
          <div class="info-label">Description:</div>
          <div class="info-value">${courseMeta.description || courseMeta.short_description || 'N/A'}</div>
        </div>
        
        <h2>Instructors (${instructors.length})</h2>
        ${instructors.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              ${instructors.map(inst => `
                <tr>
                  <td>${inst.instructor_id || 'N/A'}</td>
                  <td>${inst.instructor_name || 'N/A'}</td>
                  <td>${inst.instructor_email || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>No instructors found</p>'}
        
        <h2>Students (${learners.length})</h2>
        ${learners.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Assignments</th>
                <th>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              ${learners.map(learner => {
      const assignments = learner.assignments || []
      const totalScore = assignments.reduce((sum, asn) => {
        const submission = asn.submissions?.[0]
        const grade = submission?.grades?.[0]
        return sum + (grade?.percentage || 0)
      }, 0)
      const avgScore = assignments.length > 0 ? (totalScore / assignments.length).toFixed(2) + '%' : 'N/A'

      return `
                  <tr>
                    <td>${learner.id || 'N/A'}</td>
                    <td>${learner.name || 'N/A'}</td>
                    <td>${learner.email || 'N/A'}</td>
                    <td>${assignments.length}</td>
                    <td>${avgScore}</td>
                  </tr>
                `
    }).join('')}
            </tbody>
          </table>
        ` : '<p>No students found</p>'}
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>Source: Learning Tokens SDK - ${lms.toUpperCase()}</p>
        </div>
      </body>
      </html>
    `

    // Open in new window and trigger print
    const printWindow = window.open('', '_blank')
    printWindow.document.write(htmlContent)
    printWindow.document.close()

    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  // Learning Tokens backend URL (where the normalized payload will be POSTed)
  const LT_BACKEND = process.env.REACT_APP_LT_BACKEND_URL || 'http://localhost:3000'
  const [sendingToLT, setSendingToLT] = useState(false)

  const handleAssignTokensClick = () => {
    setShowLoginModal(true)
  }

  const performLoginAndSync = async () => {
    setIsLoggingIn(true)
    setLoginError(null)
    
    try {
      // 1. Login to get JWT
      const loginResponse = await fetch(`${LT_BACKEND}/api/auth/instructor-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      })

      if (!loginResponse.ok) {
        const errData = await loginResponse.json().catch(() => ({}))
        throw new Error(errData.message || 'Login failed. Please check your credentials.')
      }

      const loginData = await loginResponse.json()
      // Handle nested result structure (e.g. { result: { token: ... } })
      const token = loginData.token || loginData.access_token || (loginData.result && (loginData.result.token || loginData.result.access_token))

      if (!token) {
        throw new Error('No access token received from login.')
      }

      // 2. Sync Data using the token
      await sendCourseToLearningTokens(token)
      
      // Close modal only on success
      setShowLoginModal(false)

    } catch (error) {
      console.error('Login/Sync Error:', error)
      setLoginError(error.message)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const sendCourseToLearningTokens = async (accessToken) => {
    if (!course) return
    setSendingToLT(true)
    
    try {
      // Helper to calculate score and grade
      const calculateStudentPerformance = (learner) => {
        const assignments = learner.assignments || []
        if (assignments.length === 0) return { score: 0, grade: 'N/A' }

        let totalPercentage = 0
        let gradedCount = 0

        assignments.forEach(asn => {
          const sub = asn.submissions?.[0]
          if (sub && sub.grades?.[0]?.percentage !== undefined) {
            totalPercentage += sub.grades[0].percentage
            gradedCount++
          }
        })

        if (gradedCount === 0) return { score: 0, grade: 'N/A' }

        const averageScore = Math.round(totalPercentage / gradedCount)
        
        let grade = 'F'
        if (averageScore >= 90) grade = 'A'
        else if (averageScore >= 80) grade = 'B'
        else if (averageScore >= 70) grade = 'C'
        else if (averageScore >= 60) grade = 'D'

        return { score: averageScore, grade }
      }

      // Prepare Normalized Data with user inputs
      const normalizedPayload = {
        course: {
          id: course.course.id,
          name: course.course.name,
          description: course.course.description || course.course.metadata?.short_description || '',
          url: window.location.href 
        },
        category: ltCategory,
        skills: ltSkills,
        students: (course.learners || []).map(l => {
          const performance = calculateStudentPerformance(l)
          return {
            name: l.name || l.username,
            email: l.email, 
            grade: performance.grade, 
            score: performance.score,
            assignments: l.assignments // Pass rich assignment data
          }
        })
      }

      const result = await syncLmsDataToLearningTokens(normalizedPayload, accessToken, LT_BACKEND)

      console.info('Payload sent successfully:', result)
      
      // Handle Redirect
      if (result.redirectUrl) {
        // Prepend Dashboard URL if relative (Assuming Dashboard is on port 5173)
        const dashboardUrl = 'http://localhost:5173' 
        window.location.href = `${dashboardUrl}${result.redirectUrl}`
      } else {
        alert("Import successful! Please check your Learning Tokens Dashboard.")
      }

    } catch (e) {
      console.warn('Error sending course to Learning Tokens backend:', e)
      // Re-throw so the login handler catches it and shows the error in the modal
      throw e 
    } finally {
      setSendingToLT(false)
    }
  }

  if (loading) {
    return (
      <div className="page-loading-container">
        <div className="loading-spinner-wrapper">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading course data...</p>
        </div>
      </div>
    )
  }
  if (error) return <div className="page-error">Error: {error}</div>
  if (!course) return <div className="page-empty">No course data</div>

  // The `course` state holds the full normalized payload (may include
  // { course: {...}, instructors: [...], learners: [...], transcript: [...] })
  // For display of top-level course metadata pick the nested object when present.
  const courseMeta = (course && course.course) ? course.course : course
  const instructors = (course.instructors || []).slice(0, 10)
  // Some adapters use `learners` instead of `students` — support both
  const students = (course.learners || course.students || []).slice(0, 100)

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'course':
        return renderCourseInfo()
      case 'instructors':
        return renderInstructors()
      case 'students':
        return renderStudents()
      case 'assignments':
        return renderAssignments()
      case 'review':
        return renderReview()
      case 'tokens':
        return renderTokenAssignment()
      default:
        return null
    }
  }

  const renderCourseInfo = () => (
    <Section title="Course Information">
      {/* Course Description */}
      {(courseMeta.metadata?.short_description || courseMeta.short_description || courseMeta.description || course.description) && (
        <div style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          background: '#f8fafc',
          border: '1px solid #f1f5f9',
          borderRadius: '12px'
        }}>
          <h4 style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#374151'
          }}>Description</h4>
          <div style={{
            color: '#334155',
            fontSize: '0.95rem',
            lineHeight: 1.6
          }}>
            {courseMeta.metadata?.short_description || courseMeta.short_description || courseMeta.description || course.description}
          </div>
        </div>
      )}

      {/* Course Details Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem'
      }}>
        <div style={{
          padding: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Course ID</div>
          <div style={{
            color: '#111827',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            fontWeight: '500',
            wordBreak: 'break-all'
          }}>
            {courseMeta.id || course.id || course.key || '—'}
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Organization</div>
          <div style={{
            color: '#111827',
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            {courseMeta.metadata?.org || courseMeta.org || '—'}
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Course Number</div>
          <div style={{
            color: '#111827',
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            {courseMeta.metadata?.number || courseMeta.number || '—'}
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Status</div>
          <div style={{
            display: 'inline-block',
            padding: '0.375rem 0.75rem',
            background: '#dcfce7',
            color: '#166534',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}>
            {course.visibility === 'public' ? 'Public' : 'Private'}
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Start Date</div>
          <div style={{
            color: '#111827',
            fontSize: '0.95rem',
            fontWeight: '500'
          }}>
            {courseMeta.startDate ? new Date(courseMeta.startDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : (courseMeta.start || course.start_date || course.start || '—')}
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>End Date</div>
          <div style={{
            color: '#111827',
            fontSize: '0.95rem',
            fontWeight: '500'
          }}>
            {courseMeta.endDate ? new Date(courseMeta.endDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : (courseMeta.end || course.end_date || course.end || '—')}
          </div>
        </div>
      </div>

      {/* Additional Metadata if available */}
      {course.source && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#92400e',
            marginBottom: '0.5rem'
          }}>Data Source Information</div>
          <div style={{
            fontSize: '0.8rem',
            color: '#92400e',
            fontFamily: 'monospace'
          }}>
            LMS: {course.source.lms?.toUpperCase()} • Fetched: {course.source.fetchedAt ? new Date(course.source.fetchedAt).toLocaleString() : 'Unknown'}
          </div>
        </div>
      )}
    </Section>
  )

  const renderInstructors = () => (
    <Section title={`Instructors (${instructors.length})`}>
      {instructors.length === 0 ? (
        <div style={{
          color: '#9ca3af',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '3rem'
        }}>No instructors available</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {instructors.map((i, idx) => (
            <div key={idx} style={{
              padding: '1rem 1.25rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #f1f5f9'
            }}>
              <div style={{ fontWeight: '600', color: '#374151' }}>
                {i.name || i.displayName || i.email || `Instructor ${idx + 1}`}
              </div>
              {i.email && i.email !== (i.name || i.displayName) && (
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>
                  {i.email}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  )

  const renderStudents = () => (
    <Section title={`Enrolled Students (${students.length})`}>
      {students.length === 0 ? (
        <div style={{
          color: '#9ca3af',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '3rem'
        }}>No students available</div>
      ) : (
        <div style={{
          maxHeight: '400px',
          overflow: 'auto',
          display: 'grid',
          gap: '1rem'
        }}>
          {students.map((s, idx) => (
            <div key={idx} style={{
              padding: '1.25rem',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Student Name</div>
                  <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.95rem' }}>
                    {s.name || s.displayName || s.username || `Student ${idx + 1}`}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Username</div>
                  <div style={{
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    fontWeight: '500'
                  }}>
                    {s.username || '—'}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Email</div>
                  <div style={{
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    {s.email || '—'}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Student ID</div>
                  <div style={{
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    fontWeight: '500'
                  }}>
                    {s.id || '—'}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Enrolled Date</div>
                  <div style={{
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    {s.time_enrolled ? new Date(s.time_enrolled).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : '—'}
                  </div>
                </div>

                {/* Placeholder for future use */}
                <div style={{ opacity: 0.5 }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Status</div>
                  <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.5rem',
                    background: '#dcfce7',
                    color: '#166534',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    Active
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )

  const renderAssignments = () => (
    <Section title="Assignments">
      {students.length === 0 ? (
        <div style={{
          color: '#9ca3af',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '3rem'
        }}>No assignments available</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {students.map((s, si) => {
            const assignments = (s.assignments || []).slice().map(a => {
              const latestSub = (a.submissions || []).slice().reverse()[0] || null
              const ts = latestSub && (latestSub.submitted_at || latestSub.submittedAt || latestSub.submission_timestamp) ? new Date(latestSub.submitted_at || latestSub.submittedAt || latestSub.submission_timestamp) : null
              return Object.assign({}, a, { latestSubmissionTs: ts })
            }).sort((x, y) => {
              const tx = x.latestSubmissionTs ? x.latestSubmissionTs.getTime() : 0
              const ty = y.latestSubmissionTs ? y.latestSubmissionTs.getTime() : 0
              return ty - tx
            })

            if (assignments.length === 0) {
              return (
                <div key={si} style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  padding: '2rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                    marginBottom: '1rem',
                    fontSize: '1.5rem',
                    color: '#6b7280'
                  }}>
                    {(s.username || s.name || `Student ${si + 1}`).charAt(0).toUpperCase()}
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#1f2937', fontSize: '1.25rem' }}>
                    {s.username || s.name || `Student ${si + 1}`}
                  </h4>
                  <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                    ID: {s.id || 'N/A'}
                  </p>
                  <div style={{
                    color: '#9ca3af',
                    fontStyle: 'italic',
                    fontSize: '0.875rem'
                  }}>
                    No assignments available
                  </div>
                </div>
              )
            }

            return (
              <div key={si} style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                {/* Student Header */}
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '1.5rem 2rem',
                  color: '#ffffff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: '600'
                    }}>
                      {(s.username || s.name || `Student ${si + 1}`).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
                        {s.username || s.name || `Student ${si + 1}`}
                      </h3>
                      <p style={{ margin: 0, opacity: 0.8, fontSize: '0.875rem' }}>
                        Student ID: {s.id || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Assignments List */}
                <div style={{ padding: '0' }}>
                  {assignments.map((a, ai) => {
                    const sub = (a.submissions && a.submissions.length) ? a.submissions[0] : null
                    const status = sub ? (sub.workflow_state || 'submitted') : 'not_attempted'
                    const statusColors = {
                      'submitted': { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
                      'graded': { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
                      'not_attempted': { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }
                    }
                    const statusStyle = statusColors[status] || statusColors['not_attempted']

                    const scoreData = sub && sub.grades && sub.grades.length ? {
                      score: sub.grades[0].score || 0,
                      total: sub.grades[0].totalscore || a.maxScore || 0, // Use maxScore as fallback for correct denominator
                      percentage: sub.grades[0].percentage || 0
                    } : null

                    const assignmentType = a.type || 'Assignment'
                    const isQuiz = a.is_quiz_assignment

                    return (
                      <div key={ai} style={{
                        padding: '1.5rem 2rem',
                        borderBottom: ai < assignments.length - 1 ? '1px solid #f3f4f6' : 'none',
                        transition: 'background-color 0.2s ease'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto',
                          gap: '2rem',
                          alignItems: 'center'
                        }}>
                          {/* Assignment Info */}
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              marginBottom: '0.5rem'
                            }}>
                              <h4 style={{
                                margin: 0,
                                color: '#1f2937',
                                fontSize: '1.125rem',
                                fontWeight: '600'
                              }}>
                                {a.title || 'Untitled Assignment'}
                              </h4>
                              <div style={{
                                background: isQuiz ? '#ede9fe' : '#e0f2fe',
                                color: isQuiz ? '#7c3aed' : '#0284c7',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '500'
                              }}>
                                {assignmentType}{isQuiz ? ' • Quiz' : ''}
                              </div>
                            </div>

                            {a.subsection_name && (
                              <p style={{
                                margin: '0 0 0.5rem 0',
                                color: '#6b7280',
                                fontSize: '0.875rem',
                                fontStyle: 'italic'
                              }}>
                                {a.subsection_name}
                              </p>
                            )}

                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '1rem',
                              fontSize: '0.75rem',
                              color: '#9ca3af'
                            }}>
                              <span>Max Score: {a.maxScore != null ? a.maxScore : 'N/A'}</span>
                              <span>•</span>
                              <span style={{ fontFamily: 'monospace' }}>
                                ID: {a.id ? (
                                  <span>
                                    {expandedIds.has(a.id) ? a.id : truncateId(a.id)}
                                    {a.id.length > 8 && (
                                      <button
                                        onClick={() => toggleIdExpansion(a.id)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#3b82f6',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          marginLeft: '0.25rem',
                                          textDecoration: 'underline'
                                        }}
                                      >
                                        {expandedIds.has(a.id) ? 'see less...' : 'see more...'}
                                      </button>
                                    )}
                                  </span>
                                ) : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Status */}
                          <div style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`,
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            textTransform: 'capitalize',
                            textAlign: 'center',
                            minWidth: '100px'
                          }}>
                            {status.replace('_', ' ')}
                          </div>

                          {/* Score */}
                          <div style={{
                            textAlign: 'right',
                            minWidth: '120px'
                          }}>
                            {scoreData ? (
                              <>
                                <div style={{
                                  fontSize: '1.25rem',
                                  fontWeight: '700',
                                  color: '#1f2937',
                                  lineHeight: '1.2'
                                }}>
                                  {scoreData.score}/{scoreData.total}
                                </div>
                                <div style={{
                                  fontSize: '0.875rem',
                                  color: '#6b7280'
                                }}>
                                  ({scoreData.percentage}%)
                                </div>
                              </>
                            ) : (
                              <div style={{
                                fontSize: '1rem',
                                color: '#9ca3af',
                                fontStyle: 'italic'
                              }}>
                                Not graded
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )

  const renderReview = () => (
    <Section title="Review & Confirm">
      <div style={{ marginBottom: '2rem' }}>

        {/* Course Information */}
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
          <h4 style={{
            color: '#374151',
            marginBottom: '1rem',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            Course Information
            <button
              onClick={() => navigateToSection('course')}
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                color: '#6b7280',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              📝 View
            </button>
          </h4>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ fontWeight: '500', minWidth: '120px', color: '#6b7280' }}>Course Name:</span>
              <span>{courseMeta.name || courseMeta.display_name || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ fontWeight: '500', minWidth: '120px', color: '#6b7280' }}>Course ID:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{courseMeta.id || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ fontWeight: '500', minWidth: '120px', color: '#6b7280' }}>Organization:</span>
              <span>{courseMeta.metadata?.org || courseMeta.org || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ fontWeight: '500', minWidth: '120px', color: '#6b7280' }}>Course No:</span>
              <span>{courseMeta.metadata?.number || courseMeta.number || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ fontWeight: '500', minWidth: '120px', color: '#6b7280' }}>Start Date:</span>
              <span>{courseMeta.startDate ? new Date(courseMeta.startDate).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ fontWeight: '500', minWidth: '120px', color: '#6b7280' }}>End Date:</span>
              <span>{courseMeta.endDate ? new Date(courseMeta.endDate).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Instructors Summary */}
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
          <h4 style={{
            color: '#374151',
            marginBottom: '1rem',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            Instructors ({instructors.length})
            <button
              onClick={() => navigateToSection('instructors')}
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                color: '#6b7280',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              👨‍🏫 View
            </button>
          </h4>
          {instructors.length === 0 ? (
            <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No instructors found for this course.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {instructors.slice(0, 5).map((instructor, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', background: '#f9fafb', borderRadius: '4px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '600',
                    marginRight: '0.75rem',
                    fontSize: '0.875rem'
                  }}>
                    {(instructor.name || instructor.username || 'I').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: '500' }}>{instructor.name || instructor.username || 'N/A'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{instructor.email || 'Email not available'}</div>
                  </div>
                </div>
              ))}
              {instructors.length > 5 && (
                <div style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  ... and {instructors.length - 5} more instructors
                </div>
              )}
            </div>
          )}
        </div>

        {/* Students Summary */}
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
          <h4 style={{
            color: '#374151',
            marginBottom: '1rem',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            Students ({students.length})
            <button
              onClick={() => navigateToSection('students')}
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                color: '#6b7280',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              👨‍🎓 View
            </button>
          </h4>
          {students.length === 0 ? (
            <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No students found for this course.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {students.slice(0, 5).map((student, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', background: '#f9fafb', borderRadius: '4px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '600',
                    marginRight: '0.75rem',
                    fontSize: '0.875rem'
                  }}>
                    {(student.name || student.username || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500' }}>{student.name || student.username || 'N/A'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{student.email || 'Email not available'}</div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {student.assignments ? student.assignments.length : 0} assignments
                  </div>
                </div>
              ))}
              {students.length > 5 && (
                <div style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  ... and {students.length - 5} more students
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assignments Summary */}
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
          <h4 style={{
            color: '#374151',
            marginBottom: '1rem',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            Assignments Overview
            <button
              onClick={() => navigateToSection('assignments')}
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                color: '#6b7280',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              📝 View
            </button>
          </h4>
          {(() => {
            const allAssignments = students.reduce((acc, student) => {
              (student.assignments || []).forEach(assignment => {
                const existing = acc.find(a => a.id === assignment.id)
                if (!existing) {
                  acc.push({
                    id: assignment.id,
                    title: assignment.title,
                    type: assignment.type,
                    maxScore: assignment.maxScore,
                    subsection_name: assignment.subsection_name,
                    submissions: 1
                  })
                } else {
                  existing.submissions++
                }
              })
              return acc
            }, [])

            return allAssignments.length === 0 ? (
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No assignments found for this course.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {allAssignments.map((assignment, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{assignment.title || 'Untitled Assignment'}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Type: {assignment.type || 'N/A'} • Max Score: {assignment.maxScore != null ? assignment.maxScore : 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Section: {assignment.subsection_name || 'N/A'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{assignment.submissions} students</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Statistics Summary */}
        <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
          <h4 style={{ color: '#374151', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Course Statistics</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#166534' }}>{instructors.length}</div>
              <div style={{ fontSize: '0.875rem', color: '#166534' }}>Instructors</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1d4ed8' }}>{students.length}</div>
              <div style={{ fontSize: '0.875rem', color: '#1d4ed8' }}>Students</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#92400e' }}>
                {(() => {
                  const uniqueAssignments = new Set()
                  students.forEach(student => {
                    (student.assignments || []).forEach(assignment => {
                      uniqueAssignments.add(assignment.id)
                    })
                  })
                  return uniqueAssignments.size
                })()}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#92400e' }}>Total Assignments</div>
            </div>
          </div>
        </div>

        {/* Confirmation Section */}
        <div style={{
          padding: '1rem',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          {/* Learning Tokens Metadata Inputs */}
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #fcd34d' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#92400e' }}>Required Metadata for Learning Tokens</h5>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#92400e', marginBottom: '0.25rem' }}>
                  Course Category
                </label>
                <input
                  type="text"
                  value={ltCategory}
                  onChange={(e) => setLtCategory(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #fcd34d' }}
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#92400e', marginBottom: '0.25rem' }}>
                  Skills / Taxonomy
                </label>
                <input
                  type="text"
                  value={ltSkills}
                  onChange={(e) => setLtSkills(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #fcd34d' }}
                  placeholder="e.g. Blockchain, Solidity"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              id="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ transform: 'scale(1.2)' }}
            />
            <label htmlFor="confirm" style={{ fontWeight: '500', color: '#92400e' }}>
              I confirm that all the information above is correct
            </label>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
            Please review all sections before proceeding to assign learning tokens.
          </div>
        </div>
      </div>
    </Section>
  )

  const renderTokenAssignment = () => (
    <Section title="Assign Learning Tokens">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2rem',
        textAlign: 'center'
      }}>
        {/* Learning Tokens Logo → Token Icon Flow */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          marginBottom: '1rem'
        }}>
          {/* Learning Tokens Logo */}
          <img
            src="/img/lt.png"
            alt="Learning Tokens Logo"
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'contain'
            }}
          />

          {/* Arrow */}
          <div style={{
            fontSize: '3rem',
            color: '#10b981',
            fontWeight: 'bold'
          }}>
            ➜
          </div>

          {/* Token Icon */}
          <div style={{
            fontSize: '4rem'
          }}>
            🪙
          </div>
        </div>

        {/* Flow Description */}
        <p style={{
          fontSize: '0.875rem',
          color: '#059669',
          fontWeight: '600',
          marginBottom: '1.5rem'
        }}>
          Access Learning Tokens Dashboard to Assign Tokens
        </p>

        {/* Main Heading */}
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '1rem'
        }}>
          Ready to Assign Learning Tokens
        </h2>

        {/* Description */}
        <p style={{
          fontSize: '1rem',
          color: '#6b7280',
          maxWidth: '600px',
          marginBottom: '2rem',
          lineHeight: '1.6'
        }}>
          You'll be redirected to the Learning Tokens Dashboard where you can distribute blockchain-based tokens
          to students based on their course performance and achievements.
        </p>

        {/* Info Box */}
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          maxWidth: '600px',
          width: '100%'
        }}>
          <h4 style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#1e40af',
            marginBottom: '0.75rem',
            textAlign: 'left'
          }}>
            What you can do in the dashboard:
          </h4>
          <ul style={{
            textAlign: 'left',
            color: '#1e40af',
            fontSize: '0.875rem',
            lineHeight: '1.8',
            paddingLeft: '1.5rem'
          }}>
            <li>Set token distribution criteria</li>
            <li>Award tokens to individual students</li>
            <li>View token distribution history</li>
            <li>Track student achievements</li>
            <li>Generate reports and analytics</li>
          </ul>
        </div>

        {/* Action Button */}
        <button
          onClick={handleAssignTokensClick}
          disabled={!confirmed || sendingToLT}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '1rem 2.5rem',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (!e.target.disabled) {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            if (!e.target.disabled) {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
            }
          }}
        >
          {sendingToLT ? 'Sending…' : 'Go to Learning Tokens Dashboard'}
          <span style={{ fontSize: '1.25rem' }}>→</span>
        </button>

        {/* Additional Info */}
        <p style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          marginTop: '1.5rem'
        }}>
          Course data will be automatically synced with the dashboard
        </p>
      </div>
    </Section>
  )

  return (
    <div className="course-page" style={{
      minHeight: '100vh',
      background: '#ffffff',
      padding: '2rem'
    }}>
      {/* Login Modal */}
      {showLoginModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1f2937' }}>Login to Authorize</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Please enter your Learning Tokens Instructor credentials to proceed.
            </p>
            
            {loginError && (
              <div style={{ 
                background: '#fee2e2', 
                color: '#991b1b', 
                padding: '0.75rem', 
                borderRadius: '8px', 
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                {loginError}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '1rem'
                }}
                placeholder="instructor@example.com"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '1rem'
                }}
                placeholder="••••••••"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLoginModal(false)}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <button
                onClick={performLoginAndSync}
                disabled={isLoggingIn}
                style={{
                  background: '#0066cc',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'white',
                  opacity: isLoggingIn ? 0.7 : 1
                }}
              >
                {isLoggingIn ? 'Verifying...' : 'Login & Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          background: '#fff',
          padding: '2rem',
          borderRadius: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate(`/${lms}`)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                transition: 'all 0.2s ease',
                ':hover': {
                  backgroundColor: '#f3f4f6',
                  color: '#374151'
                }
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f3f4f6'
                e.target.style.color = '#374151'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent'
                e.target.style.color = '#6b7280'
              }}
              title="Back to LMS"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </button>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '2rem',
                fontWeight: '700',
                color: '#111827',
                lineHeight: 1.2
              }}>{courseMeta.name || courseMeta.display_name || 'Course'}</h1>
              <div style={{
                color: '#64748b',
                fontSize: '1rem',
                marginTop: '0.5rem',
                fontWeight: '500'
              }}>
                {courseMeta.org && <span>{courseMeta.org}</span>}
                {courseMeta.org && courseMeta.number && <span> • </span>}
                {courseMeta.number && <span>{courseMeta.number}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={downloadJson}
              style={{
                background: '#ffffff',
                color: '#374151',
                border: '1px solid #d1d5db',
                padding: '0.625rem 1.25rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f9fafb'
                e.target.style.borderColor = '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#ffffff'
                e.target.style.borderColor = '#d1d5db'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              JSON
            </button>
            <button
              onClick={downloadPDF}
              style={{
                background: '#ffffff',
                color: '#374151',
                border: '1px solid #d1d5db',
                padding: '0.625rem 1.25rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f9fafb'
                e.target.style.borderColor = '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#ffffff'
                e.target.style.borderColor = '#d1d5db'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              PDF
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar steps={steps} currentStep={currentStep} />

        {/* Step Content */}
        <div style={{ marginBottom: '2rem' }}>
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
          padding: '1.5rem 2rem',
          borderRadius: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            style={{
              background: currentStep === 0 ? '#f3f4f6' : '#ffffff',
              color: currentStep === 0 ? '#9ca3af' : '#374151',
              border: '1px solid #e5e7eb',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Previous
          </button>

          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep === steps.length - 1 ? (
            // Last step (Assign Tokens) - no button needed, handled in renderTokenAssignment
            <div style={{ width: '120px' }}></div>
          ) : currentStep === steps.length - 2 ? (
            // Review step - Next button enabled only when confirmed
            <button
              onClick={nextStep}
              disabled={!confirmed}
              style={{
                background: confirmed ? '#0066cc' : '#f3f4f6',
                color: confirmed ? '#ffffff' : '#9ca3af',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: confirmed ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              Next
            </button>
          ) : (
            // All other steps - regular Next button
            <button
              onClick={nextStep}
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
              Next
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
