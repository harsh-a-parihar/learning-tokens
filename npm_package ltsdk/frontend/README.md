# Learning Tokens Frontend

A comprehensive React-based frontend for the Learning Tokens project, providing a unified dashboard for managing multiple Learning Management Systems (LMS) integrations.

## 🚀 Features

### Dashboard
- **Multi-LMS Support**: Unified interface for 4 major LMS platforms
- **Modern UI/UX**: Clean, responsive design with gradient backgrounds
- **Navigation**: Intuitive routing between different LMS platforms
- **Status Indicators**: Visual status badges for each LMS integration

### Open edX Integration (Fully Functional)
- **Course Search**: Real-time search with dropdown suggestions
- **Course Management**: View course details, students, and instructors
- **Data Export**: Download complete course data as JSON
- **User Details**: Comprehensive user profiles with assessment data
- **Connection Monitoring**: Real-time API connection status

### Coming Soon
- **Canvas LMS**: Modern learning management platform
- **Google Classroom**: Google's learning management platform  
- **Moodle**: Open source course management system

## 🛠️ Technology Stack

- **Frontend Framework**: React 18
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios
- **Styling**: CSS3 with modern features (Grid, Flexbox, Gradients)
- **Build Tool**: Create React App
- **Development**: Hot reload, ESLint, Prettier

## 📁 Project Structure

```
frontend/
├── public/
│   ├── index.html
│   └── L.png
├── src/
│   ├── components/
│   │   ├── Dashboard.js          # Main dashboard component
│   │   ├── Dashboard.css         # Dashboard styling
│   │   ├── EdxPage.js           # Open edX integration page
│   │   ├── EdxPage.css          # Open edX page styling
│   │   ├── CourseSearch.js      # Course search component
│   │   └── CourseSearch.css     # Course search styling
│   ├── pages/
│   │   ├── UserDetail.js        # User detail page
│   │   └── UserDetail.css       # User detail styling
│   ├── services/
│   │   └── edxApi.js            # Open edX API service
│   ├── hooks/
│   │   └── useEdxData.js        # Custom React hooks
│   ├── App.js                   # Main app component
│   ├── App.css                  # Global app styles
│   ├── index.js                 # App entry point
│   └── index.css                # Global styles
├── package.json
├── package-lock.json
└── README.md
```

## 🔌 API Integration

### Open edX APIs (Active)

#### Authentication
- **Endpoint**: `/oauth2/access_token/`
- **Purpose**: OAuth2 token generation
- **Method**: POST
- **Auto-refresh**: Automatic token renewal

#### Course Management
- **Endpoint**: `/api/courses/v1/courses/`
- **Purpose**: Course search and listing
- **Method**: GET
- **Features**: Search by name or ID

- **Endpoint**: `/api/courses/v1/courses/{courseId}`
- **Purpose**: Detailed course information
- **Method**: GET
- **Data**: Name, dates, description, organization

#### Student & Instructor Data
- **Endpoint**: `/api/grades/v1/courses/{courseId}/`
- **Purpose**: Student grades and enrollment data
- **Method**: GET
- **Data**: Username, email, progress, grades, status

- **Endpoint**: `/api/grades/v1/gradebook/{courseId}/`
- **Purpose**: Comprehensive gradebook data
- **Method**: GET
- **Data**: Detailed assessment breakdown, scores

#### User Profiles
- **Endpoint**: `/api/user/v1/accounts/{username}`
- **Purpose**: User account information
- **Method**: GET
- **Data**: Profile details, account info

#### Fallback APIs
- **Endpoint**: `/api/course_structure/v0/courses/{courseId}`
- **Purpose**: Course structure and staff information
- **Method**: GET
- **Usage**: Fallback for instructor data

### Commented APIs (Available for Future Use)
- `getCourseGrades()` - Individual user grades
- `getCourseBlocks()` - Course structure/blocks
- `useUserProfiles()` - Bulk user profile fetching

## 🎯 Key Features

### Course Search & Selection
- **Real-time Search**: Debounced search with 300ms delay
- **Dropdown Suggestions**: Clickable course suggestions
- **Validation**: Course ID format validation
- **Keyboard Navigation**: Arrow keys and Enter support

### Data Display
- **Tabbed Interface**: Overview, Students, Instructors
- **Responsive Cards**: Student and instructor information cards
- **Progress Indicators**: Visual progress bars and status badges
- **Assessment Details**: Individual homework and quiz scores

### User Detail Pages
- **Comprehensive Profiles**: Complete user information
- **Assessment Breakdown**: Detailed homework and quiz data
- **Account Information**: Join date, last login, etc.
- **Navigation**: Breadcrumb navigation with back button

### Data Export
- **JSON Download**: Complete course data export
- **Smart Naming**: Auto-generated filenames with course ID and date
- **Comprehensive Data**: Course, students, instructors, metadata
- **Validation**: Only works when course is selected

## 🎨 UI/UX Features

### Design System
- **Color Palette**: Purple-blue gradient theme
- **Typography**: Modern sans-serif fonts
- **Spacing**: Consistent 8px grid system
- **Shadows**: Subtle elevation effects

### Responsive Design
- **Mobile-First**: Optimized for all screen sizes
- **Flexible Layouts**: CSS Grid and Flexbox
- **Touch-Friendly**: Appropriate button sizes and spacing

### Interactive Elements
- **Hover Effects**: Smooth transitions and feedback
- **Loading States**: Spinner animations and skeleton screens
- **Error Handling**: User-friendly error messages
- **Status Indicators**: Visual connection and data status

## 🔧 Configuration

### Proxy Setup
The development server is configured with a proxy to `http://local.openedx.io` to handle CORS issues during development.

### API Configuration
- **Base URL**: Configurable via environment variables
- **Authentication**: OAuth2 with automatic token refresh
- **Timeout**: 10-second timeout for API calls
- **Error Handling**: Comprehensive error messages and fallbacks

## 📊 Data Flow

### Course Selection Flow
1. User searches for courses
2. Selects a course from dropdown
3. System fetches course details
4. Loads student and instructor data
5. Enables data export functionality

### User Detail Flow
1. User clicks "More Info" on student/instructor card
2. Navigates to dedicated user detail page
3. System fetches comprehensive user data
4. Displays profile, assessments, and account info

### Data Export Flow
1. User selects a course
2. Clicks "Download JSON Data"
3. System compiles all course data
4. Generates and downloads JSON file

## 🧪 Testing

### Manual Testing
- Course search functionality
- Data display and navigation
- User detail pages
- JSON data export
- Responsive design

### API Testing
All Open edX APIs have been tested via Postman and are confirmed working:
- OAuth2 authentication
- Course search and details
- Student and instructor data
- User profiles and assessments

## 🚀 Deployment

### Build Optimization
- **Bundle Size**: ~74KB gzipped
- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Unused code elimination
- **Minification**: Production build optimization

### Production Considerations
- Environment variables for API endpoints
- CORS configuration for production domains
- Error monitoring and logging
- Performance monitoring

## 🔮 Future Enhancements

### Planned Features
- **Canvas LMS Integration**: Full Canvas API integration
- **Google Classroom Integration**: Google Classroom API support
- **Moodle Integration**: Moodle API integration
- **Advanced Analytics**: Data visualization and reporting
- **Bulk Operations**: Mass data export and management

### Technical Improvements
- **State Management**: Redux or Zustand integration
- **Testing**: Unit and integration tests
- **Performance**: Code splitting and lazy loading
- **Accessibility**: WCAG compliance improvements

## 📝 API Documentation

### Open edX API Endpoints

#### Authentication
```http
POST /oauth2/access_token/
Content-Type: application/x-www-form-urlencoded

grant_type=password&username={username}&password={password}&client_id={client_id}&client_secret={client_secret}
```

#### Course Search
```http
GET /api/courses/v1/courses/?search={query}
Authorization: Bearer {token}
```

#### Course Details
```http
GET /api/courses/v1/courses/{courseId}
Authorization: Bearer {token}
```

#### Student Data
```http
GET /api/grades/v1/courses/{courseId}/
Authorization: Bearer {token}
```

#### Gradebook Data
```http
GET /api/grades/v1/gradebook/{courseId}/
Authorization: Bearer {token}
```

#### User Profile
```http
GET /api/user/v1/accounts/{username}
Authorization: Bearer {token}
```




