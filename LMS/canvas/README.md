# Canvas LMS Data Retrieval & Project Setup

This project retrieves and displays various data from Canvas LMS using a Node.js/Express backend and a React frontend.

## Data Retrieved from Canvas LMS

The backend fetches the following data from Canvas LMS:

- **Courses**: List of all available courses.
- **Assignments**: All assignments for a selected course.
- **Enrolled Students**: Names, user IDs, and login IDs of students enrolled in a course.
- **Quiz Grades**: For each quiz, the score for every student and the total possible points ("Score: X out of Y").
- **Course Files & Folders**: Files and folders associated with a course.

## How Data Is Displayed

The frontend displays:
- Course details and metadata
- Enrolled students
- Assignments (with a button to view quiz grades)
- Quiz grades for each student, including the total possible points
- Course files and folders

## Project Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/AviraL0013/learning-tokens.git
cd learning-tokens/lms/canvas
```

### 2. Backend Setup
1. Go to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` file:
   - Copy `.env.sample` to `.env`:
     ```bash
     cp .env.sample .env
     ```
   - Edit `.env` and add your Canvas API base URL and API token:
     ```env
     CANVAS_API_BASE=https://canvas.instructure.com/api/v1/
     CANVAS_API_TOKEN=your_canvas_api_token_here
     ```
4. Start the backend server:
   ```bash
   npm start
   ```

### 3. Frontend Setup
1. Go to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend app:
   ```bash
   npm start
   ```

### 4. Usage
- Open the frontend in your browser (usually at `http://localhost:3000`).
- Select a course, view assignments, students, and quiz grades.

