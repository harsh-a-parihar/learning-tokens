"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEdxUserProfile = getEdxUserProfile;
exports.getEdxUserEnrollments = getEdxUserEnrollments;
exports.getEdxCourseAssessments = getEdxCourseAssessments;
exports.getEdxAssessmentQuestions = getEdxAssessmentQuestions;
exports.getEdxAssessmentResponses = getEdxAssessmentResponses;
exports.getEdxCourseGrade = getEdxCourseGrade;
exports.getEdxCourseParticipants = getEdxCourseParticipants;
exports.getEdxCourseInstructors = getEdxCourseInstructors;
exports.getEdxAssessmentAttendance = getEdxAssessmentAttendance;
exports.getEdxAssessmentAnalytics = getEdxAssessmentAnalytics;
exports.getEdxUserCertificate = getEdxUserCertificate;
exports.getEdxCourses = getEdxCourses;
exports.processEdxCourseData = processEdxCourseData;
exports.calculateEdxAssessmentScores = calculateEdxAssessmentScores;
exports.aggregateEdxParticipantData = aggregateEdxParticipantData;
exports.processEdxData = processEdxData;
exports.getEdxAccessToken = getEdxAccessToken;
const axios_1 = __importDefault(require("axios"));
// Open edX API base URL - update this to your actual Open edX instance
const baseUrl = 'http://local.openedx.io/api';
// Helper function to get auth headers
function getAuthHeaders(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}
function getEdxUserProfile(userId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX user API endpoint
            const response = yield axios_1.default.get(`${baseUrl}/user/v1/accounts/${userId}`, {
                headers: getAuthHeaders(accessToken),
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: {},
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxUserEnrollments(userId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX enrollment API endpoint
            const response = yield axios_1.default.get(`${baseUrl}/enrollment/v1/enrollment`, {
                headers: getAuthHeaders(accessToken),
                params: { user: userId }
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: [],
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxCourseAssessments(courseId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX course API endpoint for assessments
            const response = yield axios_1.default.get(`${baseUrl}/course_structure/v0/courses/${courseId}`, {
                headers: getAuthHeaders(accessToken),
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: [],
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxAssessmentQuestions(assessmentId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX XBlock API for assessment questions
            const response = yield axios_1.default.get(`${baseUrl}/xblock/v2/xblocks/${assessmentId}`, {
                headers: getAuthHeaders(accessToken),
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: [],
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxAssessmentResponses(assessmentId, accessToken, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            let url = `${baseUrl}/xblock/v2/xblocks/${assessmentId}`;
            if (userId) {
                url += `?user_id=${userId}`;
            }
            const response = yield axios_1.default.get(url, {
                headers: getAuthHeaders(accessToken),
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: [],
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxCourseGrade(courseId, userId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX grades API endpoint
            const response = yield axios_1.default.get(`${baseUrl}/grades/v1/courses/${courseId}/graded_subsections/`, {
                headers: getAuthHeaders(accessToken),
                params: { username: userId }
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: {},
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxCourseParticipants(courseId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX enrollment API to get course participants
            const response = yield axios_1.default.get(`${baseUrl}/enrollment/v1/enrollment`, {
                headers: getAuthHeaders(accessToken),
                params: { course_id: courseId }
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: [],
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxCourseInstructors(courseId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX course API for instructors
            const response = yield axios_1.default.get(`${baseUrl}/course_structure/v0/courses/${courseId}`, {
                headers: getAuthHeaders(accessToken),
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: [],
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxAssessmentAttendance(assessmentId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX XBlock API for attendance tracking
            const response = yield axios_1.default.get(`${baseUrl}/xblock/v2/xblocks/${assessmentId}`, {
                headers: getAuthHeaders(accessToken),
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: [],
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxAssessmentAnalytics(courseId, assessmentId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX analytics API
            const response = yield axios_1.default.get(`${baseUrl}/analytics/v0/courses/${courseId}/`, {
                headers: getAuthHeaders(accessToken),
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: {},
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxUserCertificate(courseId, userId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Using Open edX certificates API
            const response = yield axios_1.default.get(`${baseUrl}/certificates/v0/certificates/${courseId}`, {
                headers: getAuthHeaders(accessToken),
                params: { username: userId }
            });
            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            return {
                data: {},
                status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500,
                statusText: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText) || 'Error',
                message: error.message,
            };
        }
    });
}
function getEdxCourses(accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios_1.default.get(`${baseUrl}/courses/v1/courses/`, {
            headers: getAuthHeaders(accessToken),
        });
        return {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
        };
    });
}
// ==================== DATA PROCESSING FUNCTIONS ====================
// Process course participants and their assessment data
function processEdxCourseData(participants, assessments, grades) {
    const participantMap = new Map();
    participants.forEach(participant => {
        const userData = {
            userId: participant.user_id,
            username: participant.username,
            email: participant.email,
            fullName: participant.full_name,
            LTId: participant.LTId,
            enrollments: participant.enrollments,
            assessmentsTaken: participant.assessments_taken,
            certificate: participant.certificate,
            totalScore: 0,
            attemptedAssessments: 0,
            totalAssessments: assessments.length,
            courseGrade: null
        };
        // Find matching grade
        const grade = grades.find(g => g.user_id === participant.user_id);
        if (grade) {
            userData.courseGrade = grade;
            userData.totalScore = grade.percent_grade * 100; // Convert to percentage
        }
        participantMap.set(participant.username, userData);
    });
    return participantMap;
}
// Calculate assessment scores for participants
function calculateEdxAssessmentScores(assessmentQuestions, assessmentResponses) {
    const scoreMap = new Map();
    assessmentResponses.forEach(response => {
        const question = assessmentQuestions.find(q => q.id === response.question_id);
        if (question) {
            const score = {
                questionId: response.question_id,
                assessmentId: response.assessment_id,
                userId: response.user_id,
                answer: response.answer,
                score: response.score,
                maxScore: question.max_score,
                submittedAt: response.submitted_at,
                gradedBy: response.graded_by,
                gradedAt: response.graded_at
            };
            const key = `${response.user_id}_${response.assessment_id}`;
            if (!scoreMap.has(key)) {
                scoreMap.set(key, []);
            }
            scoreMap.get(key).push(score);
        }
    });
    return scoreMap;
}
// Aggregate participant data for Learning Token generation
function aggregateEdxParticipantData(participantMap, assessmentScores) {
    const aggregatedData = {
        participants: [],
        totalParticipants: participantMap.size,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 100,
        completionRate: 0
    };
    let totalScore = 0;
    let completedParticipants = 0;
    participantMap.forEach((participant, username) => {
        var _a;
        const assessmentKey = `${participant.userId}_${((_a = participant.assessmentsTaken[0]) === null || _a === void 0 ? void 0 : _a.assessment_id) || 'unknown'}`;
        const scores = assessmentScores.get(assessmentKey) || [];
        const participantData = Object.assign(Object.assign({}, participant), { assessmentScores: scores, totalAssessmentScore: scores.reduce((sum, score) => sum + score.score, 0), maxAssessmentScore: scores.reduce((sum, score) => sum + score.maxScore, 0), completionPercentage: participant.courseGrade ? participant.courseGrade.percent_grade * 100 : 0 });
        aggregatedData.participants.push(participantData);
        if (participantData.completionPercentage > 0) {
            completedParticipants++;
            totalScore += participantData.completionPercentage;
            if (participantData.completionPercentage > aggregatedData.highestScore) {
                aggregatedData.highestScore = participantData.completionPercentage;
            }
            if (participantData.completionPercentage < aggregatedData.lowestScore) {
                aggregatedData.lowestScore = participantData.completionPercentage;
            }
        }
    });
    aggregatedData.averageScore = completedParticipants > 0 ? totalScore / completedParticipants : 0;
    aggregatedData.completionRate = (completedParticipants / aggregatedData.totalParticipants) * 100;
    return aggregatedData;
}
// Main function to process all edX data (similar to zoomprocessor's run function)
function processEdxData(courseId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Fetch all required data
            const participantsResponse = yield getEdxCourseParticipants(courseId, accessToken);
            const assessmentsResponse = yield getEdxCourseAssessments(courseId, accessToken);
            const gradesResponse = yield getEdxCourseGrade(courseId, 0, accessToken); // Will need to iterate through users
            if (participantsResponse.status !== 200 || assessmentsResponse.status !== 200) {
                throw new Error('Failed to fetch course data');
            }
            // Process the data
            const participantMap = processEdxCourseData(participantsResponse.data, assessmentsResponse.data, [gradesResponse.data] // This should be an array of grades for all participants
            );
            // For now, create empty assessment scores (you'll need to implement this based on your specific needs)
            const assessmentScores = new Map();
            // Aggregate the data
            const aggregatedData = aggregateEdxParticipantData(participantMap, assessmentScores);
            return Object.assign({ courseId, processedAt: new Date().toISOString() }, aggregatedData);
        }
        catch (error) {
            console.error('Error processing edX data:', error);
            throw error;
        }
    });
}
function getEdxAccessToken(username_1, password_1, clientId_1, clientSecret_1) {
    return __awaiter(this, arguments, void 0, function* (username, password, clientId, clientSecret, baseUrl = process.env.EDX_BASE_URL || 'http://local.openedx.io/api') {
        const url = `${baseUrl.replace(/\/api$/, '')}/oauth2/access_token/`;
        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('username', username);
        params.append('password', password);
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        const response = yield axios_1.default.post(url, params);
        return response.data.access_token;
    });
}
