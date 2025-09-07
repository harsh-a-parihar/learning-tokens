import React from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const lmsList = [
    {
      id: 'edx',
      name: 'Open edX',
      description: 'Open source learning management system',
      status: 'active',
      color: '#0066cc',
      icon: '🎓',
      route: '/edx'
    },
    {
      id: 'canvas',
      name: 'Canvas LMS',
      description: 'Modern learning management platform',
      status: 'coming-soon',
      color: '#e13c3c',
      icon: '🎨',
      route: '/canvas'
    },
    {
      id: 'google-classroom',
      name: 'Google Classroom',
      description: 'Google\'s learning management platform',
      status: 'coming-soon',
      color: '#4285f4',
      icon: '📚',
      route: '/google-classroom'
    },
    {
      id: 'moodle',
      name: 'Moodle',
      description: 'Open source course management system',
      status: 'coming-soon',
      color: '#f98012',
      icon: '🌙',
      route: '/moodle'
    }
  ];

  return (
    <div className="dashboard">
      <div className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            Learning Tokens Dashboard
          </Link>
          <nav className="nav">
            <Link to="/">Dashboard</Link>
            <Link to="/edx">Open edX</Link>
          </nav>
        </div>
      </div>

      <div className="main-content">
        <div className="container">
          <div className="dashboard-header">
            <h1>Learning Management Systems</h1>
            <p>Connect and manage your LMS integrations</p>
          </div>

          <div className="lms-grid">
            {lmsList.map((lms) => (
              <Link
                key={lms.id}
                to={lms.route}
                className={`lms-card ${lms.status}`}
                style={{ '--card-color': lms.color }}
              >
                <div className="card-header">
                  <div className="lms-icon">{lms.icon}</div>
                  <div className="status-badge">{lms.status === 'active' ? 'Active' : 'Coming Soon'}</div>
                </div>
                
                <div className="card-content">
                  <h3>{lms.name}</h3>
                  <p>{lms.description}</p>
                </div>

                <div className="card-footer">
                  {lms.status === 'active' ? (
                    <span className="action-text">Click to manage →</span>
                  ) : (
                    <span className="action-text disabled">Under development</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div className="dashboard-footer">
            <div className="stats">
              <div className="stat">
                <h3>1</h3>
                <p>Active LMS</p>
              </div>
              <div className="stat">
                <h3>3</h3>
                <p>Coming Soon</p>
              </div>
              <div className="stat">
                <h3>100%</h3>
                <p>API Coverage</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
