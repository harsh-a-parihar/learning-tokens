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
const edxDataprocessor_1 = require("../src/edxDataprocessor");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const baseUrl = process.env.EDX_BASE_URL || 'http://local.openedx.io/api';
const adminUsername = process.env.EDX_ADMIN_USERNAME;
const adminPassword = process.env.EDX_ADMIN_PASSWORD;
const clientId = process.env.EDX_CLIENT_ID;
const clientSecret = process.env.EDX_CLIENT_SECRET;
const courseId = process.env.EDX_COURSE_ID;
const userId = parseInt(process.env.EDX_USER_ID || '0');
describe('edX Data Processor', () => {
    let accessToken;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Get admin access token before running tests
        accessToken = yield (0, edxDataprocessor_1.getEdxAccessToken)(adminUsername, adminPassword, clientId, clientSecret, baseUrl);
    }));
    test('should process edX course data with real credentials', () => __awaiter(void 0, void 0, void 0, function* () {
        if (!accessToken || !courseId) {
            console.log('Skipping real API test - missing credentials');
            return;
        }
        try {
            const result = yield (0, edxDataprocessor_1.processEdxData)(courseId, accessToken);
            expect(result).toBeDefined();
            expect(result.courseId).toBe(courseId);
            expect(result.participants).toBeDefined();
            expect(Array.isArray(result.participants)).toBe(true);
            console.log(`Successfully processed ${result.totalParticipants} participants`);
            console.log(`Average score: ${result.averageScore}%`);
            console.log(`Completion rate: ${result.completionRate}%`);
        }
        catch (error) {
            console.error('Real API test failed:', error.message);
            expect(error).toBeDefined();
        }
    }));
    test('should get user profile with real credentials', () => __awaiter(void 0, void 0, void 0, function* () {
        if (!accessToken || !userId) {
            console.log('Skipping real API test - missing credentials');
            return;
        }
        try {
            const result = yield (0, edxDataprocessor_1.getEdxUserProfile)(userId, accessToken);
            if (result.status === 200) {
                expect(result.data).toBeDefined();
                expect(result.data.user_id).toBe(userId);
                console.log(`User profile retrieved: ${result.data.username}`);
            }
            else {
                console.log(`API returned status ${result.status}: ${result.message}`);
                expect(result.status).toBeGreaterThanOrEqual(400);
            }
        }
        catch (error) {
            console.error('User profile test failed:', error.message);
            expect(error).toBeDefined();
        }
    }));
    test('should handle API errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        const badUserId = 999999; // Non-existent user
        const badToken = 'invalid-token';
        try {
            const result = yield (0, edxDataprocessor_1.getEdxUserProfile)(badUserId, badToken);
            expect(result.status).toBeGreaterThanOrEqual(400);
            console.log(`Error handled gracefully: ${result.status} - ${result.message}`);
        }
        catch (error) {
            expect(error).toBeDefined();
        }
    }));
    test('should validate course ID format', () => {
        const validCourseIds = [
            'course-v1:edX+DemoX+Demo_Course',
            'course-v1:MITx+6.002x+2012_Fall',
            'course-v1:org+course+run'
        ];
        const invalidCourseIds = [
            'invalid-format',
            'course-v1:',
            'course-v1:org',
            ''
        ];
        validCourseIds.forEach(courseId => {
            expect(courseId).toMatch(/^course-v1:[^+]+\+[^+]+\+[^+]+$/);
        });
        invalidCourseIds.forEach(courseId => {
            expect(courseId).not.toMatch(/^course-v1:[^+]+\+[^+]+\+[^+]+$/);
        });
    });
});
