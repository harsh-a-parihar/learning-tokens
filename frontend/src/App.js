import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import EdxPage from './pages/edx/EdxPage';
import CoursePage from './pages/CoursePage';
import CanvasPage from './pages/canvas/CanvasPage';
import UserDetail from './pages/UserDetail';
import GoogleClassroomPage from './pages/google-classroom/GoogleClassroomPage';
import MoodlePage from './pages/moodle/MoodlePage';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Sidebar />
        <main className="lt-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/edx" element={<EdxPage />} />
            <Route path="/user/:userType/:courseId/:username" element={<UserDetail />} />
            <Route path="/course/:lms/:courseId" element={<CoursePage />} />
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/google-classroom" element={<GoogleClassroomPage />} />
            <Route path="/moodle" element={<MoodlePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
