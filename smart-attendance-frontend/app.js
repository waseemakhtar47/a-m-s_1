// Smart Attendance System - Main Application Logic
(function() {
    'use strict';
    
    // Database structure
    const DB_KEYS = {
        USERS: 'attendance_users',
        CLASSES: 'attendance_classes',
        SUBJECTS: 'attendance_subjects',
        STUDENTS: 'attendance_students',
        TEACHERS: 'attendance_teachers',
        ATTENDANCE: 'attendance_records',
        SESSION: 'attendance_session'
    };
    
    // Base URL for API
    const API_BASE = 'http://localhost:3000/api';
    
    // Utility Functions
    function todayISO() {
        return new Date().toISOString().split('T')[0];
    }
    
    function percent(part, total) {
        return total > 0 ? Math.round((part / total) * 100) : 0;
    }
    
    // API Functions
    async function apiCall(endpoint, options = {}) {
        try {
            const token = localStorage.getItem(DB_KEYS.SESSION);
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers,
                ...options
            });
            
            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'API request failed');
                }
                
                return data;
            } else {
                if (!response.ok) {
                    throw new Error('API request failed');
                }
                return await response.text();
            }
        } catch (error) {
            console.error('API call failed');
            throw error;
        }
    }
    
    // Authentication Functions
    window.login = async function(emailOrPhone, password, role) {
        try {
            const result = await apiCall('/login', {
                method: 'POST',
                body: JSON.stringify({ emailOrPhone, password, role })
            });
            
            if (result.success) {
                localStorage.setItem(DB_KEYS.SESSION, result.token);
                localStorage.setItem('currentUser', JSON.stringify(result.user));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login failed');
            return false;
        }
    };
    
    window.logout = function() {
        localStorage.removeItem(DB_KEYS.SESSION);
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    };
    
    window.getSession = function() {
        const userData = localStorage.getItem('currentUser');
        return userData ? JSON.parse(userData) : null;
    };
    
    // Registration Functions
    window.registerStudent = async function(studentId, name, email, phone, password) {
        const [firstName, ...lastNameParts] = name.split(' ');
        const lastName = lastNameParts.join(' ') || ' ';
        
        try {
            const result = await apiCall('/register', {
                method: 'POST',
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    phone,
                    password,
                    role: 'student',
                    studentId
                })
            });
            
            return result.success;
        } catch (error) {
            console.error('Student registration failed');
            return false;
        }
    };
    
    window.registerTeacher = async function(teacherId, name, email, phone, password) {
        const [firstName, ...lastNameParts] = name.split(' ');
        const lastName = lastNameParts.join(' ') || ' ';
        
        try {
            const result = await apiCall('/register', {
                method: 'POST',
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    phone,
                    password,
                    role: 'teacher',
                    teacherId
                })
            });
            
            return result.success;
        } catch (error) {
            console.error('Teacher registration failed');
            return false;
        }
    };
    
    window.registerAdmin = async function(name, email, phone, password) {
        const [firstName, ...lastNameParts] = name.split(' ');
        const lastName = lastNameParts.join(' ') || ' ';
        
        try {
            const result = await apiCall('/register', {
                method: 'POST',
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    phone,
                    password,
                    role: 'admin'
                })
            });
            
            return { success: result.success, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    // OTP and Password Reset Functions
    window.sendEmailOTP = async function(email) {
        try {
            const result = await apiCall('/forgot-password/send-email', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.sendSMSOTP = async function(phone) {
        try {
            const result = await apiCall('/forgot-password/send-sms', {
                method: 'POST',
                body: JSON.stringify({ phone })
            });
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.verifyOTP = async function(contact, otp) {
        try {
            const result = await apiCall('/forgot-password/verify-otp', {
                method: 'POST',
                body: JSON.stringify({ contact, otp })
            });
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.resetPassword = async function(contact, contactType, newPassword) {
        try {
            const result = await apiCall('/forgot-password/reset', {
                method: 'POST',
                body: JSON.stringify({ contact, contactType, newPassword })
            });
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    // Admin Functions
    window.getPendingUsers = async function() {
        try {
            const result = await apiCall('/admin/pending-users');
            return result.users || [];
        } catch (error) {
            console.error('Failed to get pending users');
            return [];
        }
    };
    
    window.approveUser = async function(userId) {
        try {
            const result = await apiCall('/admin/approve-user', {
                method: 'POST',
                body: JSON.stringify({ userId })
            });
            return result.success;
        } catch (error) {
            console.error('Failed to approve user');
            return false;
        }
    };
    
    window.rejectUser = async function(userId) {
        try {
            const result = await apiCall('/admin/reject-user', {
                method: 'POST',
                body: JSON.stringify({ userId })
            });
            return result.success;
        } catch (error) {
            console.error('Failed to reject user');
            return false;
        }
    };
    
    window.getAllUsers = async function() {
        try {
            const result = await apiCall('/admin/all-users');
            return result.users || [];
        } catch (error) {
            console.error('Failed to get all users');
            return [];
        }
    };
    
    window.deleteUser = async function(userId) {
        try {
            const result = await apiCall('/admin/reject-user', {
                method: 'POST',
                body: JSON.stringify({ userId })
            });
            return result.success;
        } catch (error) {
            console.error('Failed to delete user');
            return false;
        }
    };
    
    window.createClass = async function(className, section) {
        try {
            const result = await apiCall('/admin/create-class', {
                method: 'POST',
                body: JSON.stringify({ className, section })
            });
            return result.success;
        } catch (error) {
            console.error('Failed to create class');
            return false;
        }
    };
    
    window.assignStudentToClass = async function(studentId, classId) {
        try {
            const result = await apiCall('/admin/assign-student', {
                method: 'POST',
                body: JSON.stringify({ studentId, classId })
            });
            return result.success;
        } catch (error) {
            console.error('Failed to assign student');
            return false;
        }
    };
    
    window.assignTeacherToClass = async function(teacherId, classId, subjectId) {
        try {
            const result = await apiCall('/admin/assign-teacher', {
                method: 'POST',
                body: JSON.stringify({ teacherId, classId, subjectId })
            });
            return result.success;
        } catch (error) {
            console.error('Failed to assign teacher');
            return false;
        }
    };
    
    window.createSubject = async function(subjectName, subjectCode) {
        try {
            const result = await apiCall('/admin/create-subject', {
                method: 'POST',
                body: JSON.stringify({ subjectName, subjectCode })
            });
            return result.success;
        } catch (error) {
            console.error('Failed to create subject');
            return false;
        }
    };
    
    window.getAllClasses = async function() {
        try {
            const result = await apiCall('/admin/classes');
            return result.classes || [];
        } catch (error) {
            console.error('Failed to get classes');
            return [];
        }
    };
    
    window.getAllStudents = async function() {
        try {
            const result = await apiCall('/admin/students');
            return result.students || [];
        } catch (error) {
            console.error('Failed to get students');
            return [];
        }
    };
    
    window.getAllTeachers = async function() {
        try {
            const result = await apiCall('/admin/teachers');
            return result.teachers || [];
        } catch (error) {
            console.error('Failed to get teachers');
            return [];
        }
    };
    
    window.getAllSubjects = async function() {
        try {
            const result = await apiCall('/admin/subjects-with-classes');
            return result.subjects || [];
        } catch (error) {
            console.error('Failed to get subjects');
            return [];
        }
    };
    
    // Teacher Functions
    window.getTeacherClasses = async function() {
        try {
            const result = await apiCall('/teacher/classes');
            return result.classes || [];
        } catch (error) {
            console.error('Failed to get teacher classes');
            return [];
        }
    };
    
    window.getStudentsByClass = async function(classId) {
        try {
            const result = await apiCall(`/teacher/class/${classId}/students`);
            return result.students || [];
        } catch (error) {
            console.error('Failed to get class students');
            return [];
        }
    };
    
    window.markAttendance = async function(classId, subjectId, date, attendanceData) {
        try {
            const result = await apiCall('/teacher/attendance/mark', {
                method: 'POST',
                body: JSON.stringify({ classId, subjectId, date, attendanceData })
            });
            return result.success;
        } catch (error) {
            console.error('Failed to mark attendance');
            return false;
        }
    };
    
    window.getAttendanceReport = async function(classId, subjectId, startDate, endDate) {
        try {
            const params = new URLSearchParams();
            if (classId) params.append('classId', classId);
            if (subjectId) params.append('subjectId', subjectId);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            
            const result = await apiCall(`/teacher/attendance/report?${params.toString()}`);
            return result;
        } catch (error) {
            console.error('Failed to get attendance report');
            return { 
                success: false, 
                error: 'Failed to fetch report',
                report: [],
                summary: {}
            };
        }
    };
    
    // Student Functions
    window.getStudentAttendance = async function() {
        try {
            const result = await apiCall('/student/attendance');
            return result.attendance || [];
        } catch (error) {
            console.error('Failed to get student attendance');
            return [];
        }
    };
    
    window.getStudentClasses = async function() {
        try {
            const result = await apiCall('/student/classes');
            return result.classes || [];
        } catch (error) {
            console.error('Failed to get student classes');
            return [];
        }
    };
    
    // Analytics Functions
    window.getAnalyticsData = async function() {
        try {
            const result = await apiCall('/analytics/data');
            return result;
        } catch (error) {
            console.error('Failed to get analytics data');
            return {
                totalStudents: 0,
                totalClasses: 0,
                overallAttendance: 0,
                todayAttendance: 0,
                subjectAttendance: [],
                recentActivity: []
            };
        }
    };
    
    // Integration Functions
    window.getIntegrationData = async function() {
        try {
            const result = await apiCall('/admin/data');
            return result;
        } catch (error) {
            console.error('Failed to get integration data');
            return {
                classes: [],
                subjects: []
            };
        }
    };
    
    // Utility Functions
    window.formatDate = function(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };
    
    window.getCurrentTime = function() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    window.calculateAttendancePercentage = function(presentDays, totalDays) {
        return totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
    };
    
    // Session Management
    window.checkAuth = function(requiredRole = null) {
        const session = localStorage.getItem(DB_KEYS.SESSION);
        const currentUser = getSession();
        
        if (!session || !currentUser) {
            window.location.href = 'index.html';
            return false;
        }
        
        if (requiredRole && currentUser.role !== requiredRole) {
            window.location.href = `${currentUser.role}.html`;
            return false;
        }
        
        return true;
    };
    
    // Role protection for analytics/integrations pages
    window.protectAnyRole = function() {
        const session = localStorage.getItem(DB_KEYS.SESSION);
        const currentUser = getSession();
        
        if (!session || !currentUser) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    };
    
    // Initialize app when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Smart Attendance System initialized');
    });
})();