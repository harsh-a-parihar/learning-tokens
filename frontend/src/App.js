import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import EdxPage from './components/EdxPage';
import UserDetail from './pages/UserDetail';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/edx" element={<EdxPage />} />
          <Route path="/user/:userType/:courseId/:username" element={<UserDetail />} />
          <Route path="/canvas" element={<div className="container"><h1>Canvas LMS - Coming Soon</h1></div>} />
          <Route path="/google-classroom" element={<div className="container"><h1>Google Classroom LMS - Coming Soon</h1></div>} />
          <Route path="/moodle" element={<div className="container"><h1>Moodle LMS - Coming Soon</h1></div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
