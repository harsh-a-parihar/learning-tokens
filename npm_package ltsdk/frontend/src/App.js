import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import LandingHome from './pages/home/LandingHome.jsx';
import AuthPage from './pages/auth/AuthStub';
import LMSSelect from './pages/lms/LMSSelect';
import LMSSetup from './pages/lms/LMSSetup';
import Dashboard from './components/Dashboard';
import EdxPage from './pages/edx/EdxPage';
import CoursePage from './pages/CoursePage';
import CanvasPage from './pages/canvas/CanvasPage';
import UserDetail from './pages/UserDetail';
import GoogleClassroomPage from './pages/google-classroom/GoogleClassroomPage';
import MoodlePage from './pages/moodle/MoodlePage';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function AppContent() {
  const location = useLocation();

  // Hide sidebar on landing, auth, and LMS setup pages
  const hideSidebar = ['/', '/auth', '/lms-select'].includes(location.pathname) ||
    location.pathname.startsWith('/lms-setup');

  // Note: Public routes handle their own auth checks with cookie detection to avoid 401 errors
  // Protected routes use ProtectedRoute component for authentication

  return (
    <div className="App">
      {!hideSidebar && <Sidebar />}
      <main className={hideSidebar ? '' : 'lt-main'}>
        <Routes>
          {/* Public routes - no auth check needed, accessible to everyone */}
          <Route path="/" element={<LandingHome />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/lms-select" element={<LMSSelect />} />
          <Route path="/lms-setup/:lms" element={<LMSSetup />} />

          {/* Protected routes - require authentication */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/edx" element={
            <ProtectedRoute>
              <EdxPage />
            </ProtectedRoute>
          } />
          <Route path="/canvas" element={
            <ProtectedRoute>
              <CanvasPage />
            </ProtectedRoute>
          } />
          <Route path="/google-classroom" element={
            <ProtectedRoute>
              <GoogleClassroomPage />
            </ProtectedRoute>
          } />
          <Route path="/moodle" element={
            <ProtectedRoute>
              <MoodlePage />
            </ProtectedRoute>
          } />
          <Route path="/user/:userType/:courseId/:username" element={
            <ProtectedRoute>
              <UserDetail />
            </ProtectedRoute>
          } />
          <Route path="/course/:lms/:courseId" element={
            <ProtectedRoute>
              <CoursePage />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
