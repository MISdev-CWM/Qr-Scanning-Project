import AttendanceLog from '../models/AttendanceLog.js';
import QRCode from '../models/QRCode.js';
import Employee from '../models/Employee.js';
import Company from '../models/Company.js';

const toWorkDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

// GET /api/attendance/recent?limit=10
export const getRecentAttendanceLogs = async (req, res) => {
  try {
    const rawLimit = req.query?.limit;
    const limit = Math.max(1, Math.min(100, Number(rawLimit) || 10));

    const logs = await AttendanceLog.find({ scanLocation: 'SECURITY' })
      .sort({ scanTime: -1 })
      .limit(limit)
      .populate('employeeId companyId');

    return res.status(200).json(logs);
  } catch (err) {
    return res.status(500).json({
      message: 'Error fetching recent attendance logs',
      error: err.message,
    });
  }
};

// POST /api/attendance/scan
export const scanAtSecurity = async (req, res) => {
  console.log('🔍 scanAtSecurity called with:', req.body);
  try {
    const { qrId, scanType, context, employeeId: employeeIdOverride } = req.body;
    
    if (!qrId) {
      return res.status(400).json({ message: 'qrId is required' });
    }

    // Validate context if it's required
    if (!context) {
      return res.status(400).json({ message: 'context is required' });
    }

    // AttendanceLog.scanLocation is currently restricted to SECURITY
    if (context !== 'SECURITY') {
      return res.status(400).json({ message: 'Invalid context. Expected SECURITY' });
    }

    // Try to find QRCode by _id (MongoDB ObjectId), if fails, try by qrId field (UUID)
    let qr = null;
    if (/^[a-fA-F0-9]{24}$/.test(qrId)) {
      qr = await QRCode.findById(qrId).populate('employeeId companyId');
    }
    if (!qr) {
      qr = await QRCode.findOne({ qrId: qrId }).populate('employeeId companyId');
    }
    if (!qr) {
      return res.status(404).json({ message: 'QR code not found' });
    }

    const companyId = qr.companyId?._id || qr.companyId;
    let employeeId = qr.employeeId?._id || qr.employeeId || null;

    // For shared manpower QR codes, QRCode.employeeId can be null.
    // If the QR payload included a specific employee ObjectId, prefer it.
    if (typeof employeeIdOverride === 'string' && /^[a-fA-F0-9]{24}$/.test(employeeIdOverride)) {
      const employee = await Employee.findById(employeeIdOverride).select('companyId');
      if (!employee) {
        return res.status(400).json({ message: 'Invalid employeeId' });
      }
      if (employee.companyId?.toString() !== companyId?.toString()) {
        return res.status(400).json({ message: 'Employee does not belong to this company' });
      }
      employeeId = employee._id;
    }

    // Do not allow attendance scans without a specific employee.
    // This prevents AttendanceLog.employeeId from being saved as null.
    if (!employeeId) {
      return res.status(400).json({
        message:
          'This QR code is not linked to a specific employee. Please scan an employee QR code, or include a valid employeeId override.',
      });
    }

    const now = new Date();
    let workDate = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Accept scanType from request, default to alternating if not provided
    let type = scanType;
    if (!type) {
      // Find the last scan for this QR code, regardless of date, to determine the NEXT scan type
      const lastLog = await AttendanceLog.findOne({
        qrId: qr._id,
        companyId,
        scanLocation: context
      }).sort({ scanTime: -1 });
      
      if (!lastLog) {
        type = 'IN';
      } else {
        type = lastLog.scanType === 'IN' ? 'OUT' : 'IN';
      }
    }

    // Fix: If checking OUT, inherit the workDate and shift from the most recent IN scan
    if (type === 'OUT') {
      const lastInLog = await AttendanceLog.findOne({
        qrId: qr._id,
        companyId,
        scanLocation: context,
        scanType: 'IN'
      }).sort({ scanTime: -1 });

      if (lastInLog) {
        // Ensure the last IN scan was within the last 24 hours so we don't pull an old scan
        const hoursSinceLastIn = (now - new Date(lastInLog.scanTime)) / (1000 * 60 * 60);
        if (hoursSinceLastIn < 24) {
          workDate = lastInLog.workDate; // Inherit the workDate!
        }
      }
    }

    const attendance = new AttendanceLog({
      qrId: qr._id,  // Use QRCode's MongoDB _id, not the UUID
      companyId,
      employeeId,
      scanType: type,
      scanLocation: context, // ✅ Use context instead of hardcoded 'SECURITY'
      scanTime: now,
      workDate,
    });

    await attendance.save();

    res.status(201).json({
      message: `Attendance ${type} recorded at ${context}`,
      attendance
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// PUT /api/attendance/logs/:id/scan-time
// Admin-only: update the scanTime (check-in/check-out time) for an existing attendance log.
export const updateAttendanceLogScanTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { scanTime } = req.body;

    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({ message: 'Invalid attendance log id' });
    }

    if (!scanTime) {
      return res.status(400).json({ message: 'scanTime is required' });
    }

    const parsed = new Date(scanTime);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ message: 'scanTime must be a valid date/time' });
    }

    const log = await AttendanceLog.findById(id);
    if (!log) {
      return res.status(404).json({ message: 'Attendance log not found' });
    }

    // Only allow editing SECURITY attendance logs via this endpoint.
    if (log.scanLocation !== 'SECURITY') {
      return res.status(400).json({ message: 'Only SECURITY attendance logs can be edited here' });
    }

    const newWorkDate = toWorkDate(parsed);
    if (!newWorkDate) {
      return res.status(400).json({ message: 'Failed to compute workDate from scanTime' });
    }
    if (newWorkDate !== log.workDate) {
      return res.status(400).json({ message: 'Changing the attendance date is not allowed' });
    }

    log.scanTime = parsed;
    log.workDate = newWorkDate;
    log.editedAt = new Date();
    if (req.userId) {
      log.editedBy = req.userId;
    }

    await log.save();

    return res.status(200).json({
      message: 'Attendance time updated successfully',
      attendance: log,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error updating attendance time',
      error: err.message,
    });
  }
};

// POST /api/attendance/logs/manual
// Admin-only: create a manual attendance log (e.g. if employee wasn't checked out)
export const createManualAttendanceLog = async (req, res) => {
  try {
    const { employeeId, companyId, scanType, scanTime, workDate } = req.body;

    if (!employeeId || !/^[a-fA-F0-9]{24}$/.test(employeeId)) {
      return res.status(400).json({ message: 'Invalid employeeId' });
    }
    if (!companyId || !/^[a-fA-F0-9]{24}$/.test(companyId)) {
      return res.status(400).json({ message: 'Invalid companyId' });
    }
    if (!scanType || !['IN', 'OUT'].includes(scanType)) {
      return res.status(400).json({ message: 'scanType must be IN or OUT' });
    }
    if (!scanTime) {
      return res.status(400).json({ message: 'scanTime is required' });
    }
    if (!workDate) {
      return res.status(400).json({ message: 'workDate is required' });
    }

    const parsedTime = new Date(scanTime);
    if (Number.isNaN(parsedTime.getTime())) {
      return res.status(400).json({ message: 'scanTime must be a valid date/time' });
    }

    // Resolve employee details
    const employee = await Employee.findById(employeeId).lean();
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Find QRCode linked to this employee or fallback to company's shared type
    let qr = await QRCode.findOne({ employeeId });
    if (!qr) {
      qr = await QRCode.findOne({ companyId, qrType: employee.employeeType });
    }
    if (!qr) {
      return res.status(404).json({ message: 'QR code not found for this employee/company' });
    }

    const attendance = new AttendanceLog({
      qrId: qr._id,
      companyId,
      employeeId,
      scanType,
      scanLocation: 'SECURITY',
      scanTime: parsedTime,
      workDate,
      editedAt: new Date(),
      editedBy: req.userId || null
    });

    await attendance.save();

    return res.status(201).json({
      message: 'Attendance log created successfully',
      attendance
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error creating manual attendance log',
      error: err.message
    });
  }
};


// GET /api/attendance/summary?qrId=...&date=YYYY-MM-DD
export const getAttendanceSummary = async (req, res) => {
  try {
    const { qrId, workDate, date } = req.query;
    const day = workDate || date;
    if (!qrId || !day) {
      return res.status(400).json({ message: 'qrId and workDate (or date) are required' });
    }

    const logs = await AttendanceLog.find({
      qrId,
      workDate: day,
      scanLocation: 'SECURITY'
    }).sort({ scanTime: 1 });

    const firstIn = logs.find(l => l.scanType === 'IN');
    const lastOut = [...logs].reverse().find(l => l.scanType === 'OUT');

    res.status(200).json({
      firstIn,
      lastOut
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching summary', error: err.message });
  }
};

// GET /api/attendance/daily-summary?date=YYYY-MM-DD
export const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'date is required' });
    }
    // Find all attendance logs for the date
    const logs = await AttendanceLog.find({ workDate: date, scanLocation: 'SECURITY' }).populate('employeeId companyId');
    // Group by employee
    const summary = {};
    logs.forEach(log => {
      const empId = log.employeeId?._id?.toString() || (log.employeeId && log.employeeId.toString()) || 'unknown';
      if (!summary[empId]) {
        summary[empId] = {
          employee: log.employeeId,
          company: log.companyId,
          logs: []
        };
      }
      summary[empId].logs.push(log);
    });

    // For each employee, get first IN and last OUT
    const result = Object.values(summary).map(({ employee, company, logs }) => {
      const firstIn = logs.find(l => l.scanType === 'IN');
      const lastOut = [...logs].reverse().find(l => l.scanType === 'OUT');
      return {
        employee,
        company,
        firstIn,
        lastOut
      };
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching daily summary', error: err.message });
  }
};

// GET /api/attendance/non-checkout?date=YYYY-MM-DD
// Returns employees whose latest SECURITY attendance log for the date is IN (not checked out).
export const getNonCheckoutEmployees = async (req, res) => {
  try {
    const day = String(req.query?.date || '').trim();
    if (!day) {
      return res.status(400).json({ message: 'date is required in format YYYY-MM-DD' });
    }

    const lastAttendanceRows = await AttendanceLog.aggregate([
      {
        $match: {
          workDate: day,
          scanLocation: 'SECURITY'
        }
      },
      { $sort: { scanTime: -1 } },
      {
        $group: {
          _id: '$employeeId',
          scanType: { $first: '$scanType' },
          scanTime: { $first: '$scanTime' },
          companyId: { $first: '$companyId' }
        }
      }
    ]);

    const onSiteRows = lastAttendanceRows.filter((r) => r?._id && r?.scanType === 'IN');
    const employeeObjectIds = onSiteRows.map((r) => r._id);

    if (employeeObjectIds.length === 0) {
      return res.status(200).json({ date: day, count: 0, rows: [] });
    }

    const lastCheckInMap = new Map(onSiteRows.map((r) => [String(r._id), r.scanTime]));
    const companyFromAttendanceMap = new Map(onSiteRows.map((r) => [String(r._id), r.companyId]));

    const employees = await Employee.find({ _id: { $in: employeeObjectIds } })
      .select('name employeeId companyId')
      .lean();
    const employeeMap = new Map(employees.map((e) => [String(e._id), e]));

    const companyIds = Array.from(
      new Set(
        employees
          .map((e) => (e.companyId ? String(e.companyId) : null))
          .filter(Boolean)
      )
    );

    const companies = await Company.find({ _id: { $in: companyIds } })
      .select('companyName')
      .lean();
    const companyNameMap = new Map(companies.map((c) => [String(c._id), c.companyName]));

    const rows = employeeObjectIds.map((employeeObjectId) => {
      const key = String(employeeObjectId);
      const employee = employeeMap.get(key) || {};
      const companyId = employee.companyId || companyFromAttendanceMap.get(key) || null;
      const companyName = companyId ? companyNameMap.get(String(companyId)) : null;

      return {
        employeeId: key,
        employeeName: employee.name || '—',
        employeeCode: employee.employeeId || '—',
        companyName: companyName || '—',
        lastCheckIn: lastCheckInMap.get(key) || null,
      };
    });

    return res.status(200).json({
      date: day,
      count: rows.length,
      rows,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error fetching non-checkout employees',
      error: err.message,
    });
  }
};

// GET /api/attendance/ot-summary?date=YYYY-MM-DD
export const getOTSummary = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'date is required' });
    }
    
    // Find all attendance logs for the date
    const logs = await AttendanceLog.find({ workDate: date, scanLocation: 'SECURITY' }).populate('employeeId companyId');
    
    // Group by employee only so check-in and check-out always appear on the same row.
    const summary = {};
    logs.forEach(log => {
      const empId = log.employeeId?._id?.toString() || (log.employeeId && log.employeeId.toString()) || 'unknown';
      // Key by employee only – one row per employee per day
      const key = empId;

      if (!summary[key]) {
        summary[key] = {
          employee: log.employeeId,
          company: log.companyId,
          logs: []
        };
      }
      summary[key].logs.push(log);
    });

    const result = Object.values(summary).map(({ employee, company, logs }) => {
      // Sort ascending so firstIn/lastOut are reliable
      logs.sort((a, b) => new Date(a.scanTime) - new Date(b.scanTime));

      const firstIn = logs.find(l => l.scanType === 'IN');
      const lastOut = [...logs].reverse().find(l => l.scanType === 'OUT');

      let totalHours = 0;
      let otHours = 0;
      let afterOtLimitHours = 0;

      if (firstIn && lastOut && firstIn.scanTime && lastOut.scanTime) {
        const inTime = new Date(firstIn.scanTime);
        const outTime = new Date(lastOut.scanTime);

        if (outTime > inTime) {
          totalHours = (outTime - inTime) / (1000 * 60 * 60);

          const employeeType = employee?.employeeType || 'permanent';
          const regularHours = 9;
          const otCapHours = employeeType === 'manpower' ? 3 : 15;
          const overtimeHours = Math.max(totalHours - regularHours, 0);

          otHours = overtimeHours;
          afterOtLimitHours = Math.max(overtimeHours - otCapHours, 0);
        }
      }

      return {
        id: `${employee?._id || 'unknown'}_summary`,
        employee,
        company,
        firstIn,
        lastOut,
        totalHours: totalHours.toFixed(2),
        otHours: otHours.toFixed(2),
        afterOtEndHours: afterOtLimitHours.toFixed(2),
      };
    });
    
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching OT summary', error: err.message });
  }
};
//   } catch (err) {
//     res.status(500).json({
//       message: 'Server error',
//       error: err.message
//     });
//   }
// };
