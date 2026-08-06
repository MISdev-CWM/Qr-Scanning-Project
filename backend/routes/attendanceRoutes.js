import express from 'express';
import { scanAtSecurity, getAttendanceSummary, getDailySummary, getRecentAttendanceLogs, updateAttendanceLogScanTime, getNonCheckoutEmployees, getOTSummary, createManualAttendanceLog, previewAttendanceRecordDelete, deleteAttendanceRecord } from '../controllers/attendanceController.js';
import { auth, authorize } from '../middleware/auth.js';

const router = express.Router();

// POST /api/attendance/scan
router.post('/scan', scanAtSecurity);

// GET /api/attendance/summary?qrId=...&date=YYYY-MM-DD
router.get('/summary', getAttendanceSummary);

// GET /api/attendance/daily-summary?date=YYYY-MM-DD
router.get('/daily-summary', getDailySummary);

// GET /api/attendance/recent?limit=10
router.get('/recent', getRecentAttendanceLogs);

// GET /api/attendance/ot-summary?date=YYYY-MM-DD
router.get('/ot-summary', auth, authorize('admin'), getOTSummary);

// Admin-only: list employees who haven't checked OUT (latest scan is IN)
router.get('/non-checkout', auth, authorize('admin'), getNonCheckoutEmployees);

// Admin-only: update check-in/check-out time for an existing attendance log
router.put('/logs/:id/scan-time', auth, authorize('admin'), updateAttendanceLogScanTime);

// Admin-only: create a manual check-in/check-out log if it doesn't exist
router.post('/logs/manual', auth, authorize('admin'), createManualAttendanceLog);

// Admin-only: preview/delete an attendance row and matching work sessions
router.post('/records/delete-preview', auth, authorize('admin'), previewAttendanceRecordDelete);
router.post('/records/delete', auth, authorize('admin'), deleteAttendanceRecord);

export default router;
