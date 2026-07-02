import Employee from '../models/Employee.js';
import Company from '../models/Company.js';
import Process from '../models/Process.js';
import AttendanceLog from '../models/AttendanceLog.js';
import { getDailyEmployeeIdleTime } from './idleAnalyticsController.js';

// GET /api/public/dashboard-summary
export const getPublicDashboardSummary = async (req, res) => {
  try {
    const [
      totalEmployees,
      manpowerEmployees,
      permanentEmployees,
      casualEmployees,
      processes,
      manpowerCompanies,
    ] = await Promise.all([
      Employee.countDocuments({}),
      Employee.countDocuments({ employeeType: 'manpower' }),
      Employee.countDocuments({ employeeType: 'permanent' }),
      Employee.countDocuments({ employeeType: 'casual' }),
      Process.countDocuments({}),
      Company.countDocuments({ employeeTypeAllowed: 'manpower' }),
    ]);

    return res.status(200).json({
      employees: {
        total: totalEmployees,
        manpower: manpowerEmployees,
        permanent: permanentEmployees,
        casual: casualEmployees,
      },
      processes,
      manpowerCompanies,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error fetching dashboard summary',
      error: err.message,
    });
  }
};

// GET /api/public/employee-idle/daily?date=YYYY-MM-DD
export const getPublicDailyEmployeeIdleTime = getDailyEmployeeIdleTime;

// GET /api/public/attendance/daily-count?date=YYYY-MM-DD
export const getPublicDailyCheckInCount = async (req, res) => {
  try {
    const day = String(req.query?.date || '').trim();
    if (!day) {
      return res.status(400).json({ message: 'date is required in format YYYY-MM-DD' });
    }

    const rows = await AttendanceLog.aggregate([
      {
        $match: {
          workDate: day,
          scanLocation: 'SECURITY',
          scanType: 'IN',
        },
      },
      {
        $group: {
          _id: '$employeeId',
        },
      },
    ]);

    return res.status(200).json({
      date: day,
      count: rows.length,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error fetching daily check-in count',
      error: err.message,
    });
  }
};
