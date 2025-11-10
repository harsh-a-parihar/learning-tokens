import React, { useState, useRef, useEffect } from 'react';
import useCourseSearch from '../hooks/useCourseSearch';
import Icon from './Icon';
import './CourseSearch.css';

const CourseSearch = ({ selectedCourseId, onCourseSelect, onCourseIdChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [, setIsFocused] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  const { courses, loading, error } = useCourseSearch('edx', searchQuery);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current && 
        !searchRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    onCourseIdChange(value);
    setShowDropdown(value.length >= 2);
  };

  const handleCourseSelect = (course) => {
    setSearchQuery(course.name || course.id);
    onCourseSelect(course);
    setShowDropdown(false);
    setIsFocused(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (searchQuery.length >= 2) {
      setShowDropdown(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setIsFocused(false);
    }
  };

  return (
    <div className="course-search-container">
      <div className="search-input-wrapper" ref={searchRef}>
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search courses by name or ID (e.g., CS101, Introduction to Computer Science)"
          className="course-search-input"
        />
  {loading && <div className="search-loading" aria-hidden="true"><Icon name="search" size={16} /></div>}
      </div>

      {showDropdown && (
        <div className="search-dropdown" ref={dropdownRef}>
          {error ? (
            <div className="search-error">
              <div className="error-icon" aria-hidden="true"><Icon name="alert" size={16} /></div>
              <div className="error-text">Error searching courses: {error}</div>
            </div>
          ) : courses.length === 0 ? (
            <div className="search-no-results">
              <div className="no-results-icon" aria-hidden="true"><Icon name="search" size={16} /></div>
              <div className="no-results-text">
                {searchQuery.length < 2 
                  ? 'Type at least 2 characters to search' 
                  : 'No courses found matching your search'
                }
              </div>
            </div>
          ) : (
            <div className="search-results">
              {courses.map((course, index) => (
                <div
                  key={course.id || index}
                  className="search-result-item"
                  onClick={() => handleCourseSelect(course)}
                >
                  <div className="course-name">{course.name}</div>
                  <div className="course-details">
                    <span className="course-id">{course.id}</span>
                    {course.org && <span className="course-org">• {course.org}</span>}
                    {course.number && <span className="course-number">• {course.number}</span>}
                  </div>
                  {course.short_description && (
                    <div className="course-description">
                      {course.short_description.length > 100 
                        ? `${course.short_description.substring(0, 100)}...` 
                        : course.short_description
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseSearch;
