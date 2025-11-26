import React from 'react';
import { Link } from 'react-router-dom';
import './LandingHome.css';

export default function LandingHome() {
  return (
    <div className="landing-container">
      {/* Logo Header */}
      <div className="landing-header">
        <div className="landing-logo">
          <div className="logo-square">
            <span className="logo-text">LT</span>
          </div>
          <div className="logo-text-container">
            <div className="logo-title">Learning Tokens</div>
            <div className="logo-subtitle">LMS Connector</div>
          </div>
        </div>
      </div>

      <div className="landing-hero">
        {/* Animated background gradient */}
        <div className="hero-bg"></div>

        {/* Content */}
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot"></span>
            Unified LMS Integration Platform
          </div>

          <h1 className="hero-title">
            <span className="title-line-1">Connect. Evaluate. Consent.</span>
            <span className="title-line-2">And Transform Digital Edu.</span>
          </h1>

          <p className="hero-subtitle">
            Seamlessly integrate with Canvas, edX, Moodle, and Google Classroom.
            Transform diverse LMS data into a unified, standardized format for Learning Tokens.
          </p>

          <div className="hero-cta">
            <Link to="/auth" className="btn-primary">
              <span>Connect Your LMS</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* Feature pills */}
          <div className="feature-pills">
            <div className="pill">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0L10.4 5.6L16 8L10.4 10.4L8 16L5.6 10.4L0 8L5.6 5.6L8 0Z" />
              </svg>
              Real-time Sync
            </div>
            <div className="pill">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0L10.4 5.6L16 8L10.4 10.4L8 16L5.6 10.4L0 8L5.6 5.6L8 0Z" />
              </svg>
              Blockchain Ready
            </div>
            <div className="pill">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0L10.4 5.6L16 8L10.4 10.4L8 16L5.6 10.4L0 8L5.6 5.6L8 0Z" />
              </svg>
              Open Source
            </div>
          </div>
        </div>

        {/* Floating cards visualization */}
        <div className="hero-visual">
          <div className="floating-card card-1">
            <div className="card-icon edx-icon">edX</div>
            <div className="card-label">Open edX</div>
          </div>
          <div className="floating-card card-2">
            <div className="card-icon canvas-icon">C</div>
            <div className="card-label">Canvas</div>
          </div>
          <div className="floating-card card-3">
            <div className="card-icon google-icon">G</div>
            <div className="card-label">Classroom</div>
          </div>
          <div className="floating-card card-4">
            <div className="card-icon moodle-icon">M</div>
            <div className="card-label">Moodle</div>
          </div>
        </div>
      </div>
    </div>
  );
}
