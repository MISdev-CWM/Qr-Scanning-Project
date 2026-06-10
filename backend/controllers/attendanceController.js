import AttendanceLog from '../models/AttendanceLog.js';
import QRCode from '../models/QRCode.js';
import Employee from '../models/Employee.js';
import Company from '../models/Company.js';
import ShiftTime from '../models/ShiftTime.js';

const toWorkDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const SHIFT_TIMEZONE = process.env.SHIFT_TIMEZONE || 'Asia/Colombo';

const parseTimeToMinutes = (value) => {
  if (typeof value !== 'string') return null;
  const [hh, mm] = value.split(':').map((v) => Number(v));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
};

const isTimeInRange = (value, start, end) => {
  if (start === null || end === null) return false;
  if (start <= end) return value >= start && value < end;
  return value >= start || value < end;
};

const getMinutesInTimeZone = (date, timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const hh = Number(parts.find((p) => p.type === 'hour')?.value);
    const mm = Number(parts.find((p) => p.type === 'minute')?.value);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
  } catch (err) {
    return null;
  }
};

/**
 * Builds an absolute Date object representing a specific HH:MM wall-clock time
 * in the given IANA timezone, on the same calendar date (in that timezone)
 * as referenceDate.
 *
 * e.g. buildTimeInTimeZone(outTime, 17, 0, 'Asia/Colombo')
 *   → a UTC Date equivalent to 17:00:00 Sri Lanka time on the same local date as outTime.
 */
const buildTimeInTimeZone = (referenceDate, hh, mm, timeZone) => {
  // Get the calendar date in the target timezone (YYYY-MM-DD)
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate); // en-CA locale formats as YYYY-MM-DD

  // Compute the timezone UTC offset for this moment using the toLocaleString trick
  const utcProxy = new Date(referenceDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzProxy  = new Date(referenceDate.toLocaleString('en-US', { timeZone }));
  const offsetMs = tzProxy.getTime() - utcProxy.getTime(); // positive for timezones ahead of UTC

  // Build a UTC timestamp for the requested wall-clock time in that timezone:
  // "dateStr HH:MM" treated as UTC, then subtract the offset to get true UTC.
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hh, mm, 0, 0);
  return new Date(utcMs - offsetMs);
};

const getShiftForDate = (date, shiftTimes, employeeType = 'permanent') => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  if (!shiftTimes) return null;

  const prefix = employeeType === 'manpower' ? 'manpower' : 'permanent';

  const dayStart = parseTimeToMinutes(shiftTimes[`${prefix}DayStart`]);
  const dayEnd = parseTimeToMinutes(shiftTimes[`${prefix}DayEnd`]);
  const nightStart = parseTimeToMinutes(shiftTimes[`${prefix}NightStart`]);
  const nightEnd = parseTimeToMinutes(shiftTimes[`${prefix}NightEnd`]);

  if ([dayStart, dayEnd, nightStart, nightEnd].some((v) => v === null)) {
    return null;
  }

  const minutes = getMinutesInTimeZone(date, SHIFT_TIMEZONE);
  if (minutes === null) return null;

  if (isTimeInRange(minutes, dayStart, dayEnd)) return 'DAY';
  if (isTimeInRange(minutes, nightStart, nightEnd)) return 'NIGHT';

  return null;
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
    const workDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const shiftTimes = await ShiftTime.findOne().sort({ updatedAt: -1 }).lean();
    
    // Resolve employeeType
    let employeeType = 'permanent';
    if (employeeId) {
      const empInfo = await Employee.findById(employeeId).select('employeeType').lean();
      if (empInfo && empInfo.employeeType) {
        employeeType = empInfo.employeeType;
      }
    }
    
    let shift = getShiftForDate(now, shiftTimes, employeeType);

    // Accept scanType from request, default to alternating if not provided
    let type = scanType;
    if (!type) {
      // Find all scans for today with this context
      const logs = await AttendanceLog.find({
        qrId: qr._id,  // Use QRCode's MongoDB _id, not the UUID
        companyId,
        workDate,
        scanLocation: context // ✅ Use context instead of hardcoded 'SECURITY'
      }).sort({ scanTime: 1 });
      
      if (logs.length === 0) {
        type = 'IN';
      } else {
        // Alternate between IN and OUT
        const last = logs[logs.length - 1];
        type = last.scanType === 'IN' ? 'OUT' : 'IN';
      }
    }

    // Fix: If checking OUT, inherit the shift from the most recent IN scan
    if (type === 'OUT') {
      const lastInLog = await AttendanceLog.findOne({
        qrId: qr._id,
        companyId,
        scanLocation: context,
        scanType: 'IN'
      }).sort({ scanTime: -1 });

      if (lastInLog && lastInLog.shift) {
        // Ensure the last IN scan was within the last 24 hours so we don't pull an old shift
        const hoursSinceLastIn = (now - new Date(lastInLog.scanTime)) / (1000 * 60 * 60);
        if (hoursSinceLastIn < 24) {
          shift = lastInLog.shift;
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
      shift
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

    const shiftTimes = await ShiftTime.findOne().sort({ updatedAt: -1 }).lean();
    
    let employeeType = 'permanent';
    if (log.employeeId) {
      const empInfo = await Employee.findById(log.employeeId).select('employeeType').lean();
      if (empInfo && empInfo.employeeType) {
        employeeType = empInfo.employeeType;
      }
    }

    const shift = getShiftForDate(parsed, shiftTimes, employeeType);

    log.scanTime = parsed;
    log.workDate = newWorkDate;
    if (shift) {
      log.shift = shift;
    }
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
    
    // Get the global shift times (including OT ranges)
    const shiftTimes = await ShiftTime.findOne().sort({ updatedAt: -1 }).lean();
    
    // Group by employee only (not by shift), so check-in and check-out always
    // appear on the same row regardless of which shift was saved on each scan.
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

      // Use the shift recorded on the first IN scan as the authoritative shift.
      // This ensures that even if old OUT scans had a wrong shift, the row
      // still shows the correct shift and places check-in + check-out together.
      const shift = firstIn?.shift || lastOut?.shift || 'UNKNOWN';

      const empType = employee?.employeeType || 'permanent';
      const prefix = empType === 'manpower' ? 'manpower' : 'permanent';

      // Shift end time is the boundary after which OT begins
      // e.g. permanentDayEnd = "17:00", permanentNightEnd = "05:00"
      const shiftEndStr = shift === 'DAY'
        ? shiftTimes?.[`${prefix}DayEnd`]
        : shiftTimes?.[`${prefix}NightEnd`];

      let totalHours = 0;
      let otHours = 0;

      if (firstIn && lastOut && firstIn.scanTime && lastOut.scanTime) {
        const inTime = new Date(firstIn.scanTime);
        const outTime = new Date(lastOut.scanTime);

        if (outTime > inTime) {
          totalHours = (outTime - inTime) / (1000 * 60 * 60);

          // OT = checkout time - shift end time (only if checkout is after shift end).
          // IMPORTANT: shiftEndStr (e.g. "17:00") is a wall-clock time in SHIFT_TIMEZONE
          // (Asia/Colombo). scanTime values in the DB are UTC. We must convert the
          // shift-end string to an absolute UTC Date before comparing, otherwise
          // setHours() would apply the time in server-local time (UTC) and produce
          // a shift-end that is 5h30m too late, making OT always 0.
          if (shiftEndStr) {
            const [endH, endM] = shiftEndStr.split(':').map(Number);

            // Build shift-end as a proper UTC Date in the configured timezone
            let shiftEnd = buildTimeInTimeZone(outTime, endH, endM, SHIFT_TIMEZONE);

            // For night shifts that end in the early morning of the next day
            // (e.g. nightEnd = 05:00), the built shiftEnd might land before inTime.
            // In that case push it forward one day.
            if (shift === 'NIGHT' && shiftEnd <= inTime) {
              shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
            }

            // OT = how many hours the employee stayed beyond shift end
            if (outTime > shiftEnd) {
              otHours = (outTime - shiftEnd) / (1000 * 60 * 60);
            }
          }
        }
      }

      return {
        id: `${employee?._id || 'unknown'}_${shift}`,
        employee,
        company,
        shift,
        firstIn,
        lastOut,
        totalHours: totalHours.toFixed(2),
        otHours: otHours.toFixed(2),
        shiftEnd: shiftEndStr || 'Not Defined',
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
