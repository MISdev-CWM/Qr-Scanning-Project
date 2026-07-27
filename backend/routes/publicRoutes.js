import express from 'express';
import { getPublicDailyEmployeeIdleTime, getPublicDashboardSummary, getPublicDailyCheckInCount } from '../controllers/publicController.js';

const router = express.Router();

// Public dashboard summary
router.get('/dashboard-summary', getPublicDashboardSummary);

// Public analytics
router.get('/employee-idle/daily', getPublicDailyEmployeeIdleTime);
router.get('/attendance/daily-count', getPublicDailyCheckInCount);

export default router;
