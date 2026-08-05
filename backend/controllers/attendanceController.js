import AttendanceLog from '../models/AttendanceLog.js';
import QRCode from '../models/QRCode.js';
import Employee from '../models/Employee.js';
import Company from '../models/Company.js';
import WorkSession from '../models/WorkSession.js';

const DUPLICATE_SCAN_WINDOW_MS = 5 * 60 * 1000;
const AUTO_CHECKOUT_SHIFT = 'AUTO_CHECKOUT';
const AUTO_CHECKOUT_HOURS_BY_TYPE = {
  manpower: 13,
  permanent: 25,
  casual: 25,
};

const toWorkDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getIdValue = (value) => value?._id || value;

const getEmployeeKey = (log) =>
  log.employeeId?._id?.toString() || log.employeeId?.toString() || 'unknown';

const isAfter = (later, earlier) => new Date(later).getTime() > new Date(earlier).getTime();

const getAutoCheckoutHours = (employeeType) => {
  const normalizedType = String(employeeType || '').trim().toLowerCase();
  return AUTO_CHECKOUT_HOURS_BY_TYPE[normalizedType] || AUTO_CHECKOUT_HOURS_BY_TYPE.permanent;
};

const shouldApplyAutoCheckout = (req) =>
  String(req.query?.autoCheckout || '').trim().toLowerCase() === 'true';

const findOpenCheckInForCheckout = async ({ employeeId, companyId, scanLocation, outTime, excludeOutId = null }) => {
  const parsedOutTime = new Date(outTime);
  if (Number.isNaN(parsedOutTime.getTime())) return null;

  const lastInLog = await AttendanceLog.findOne({
    employeeId,
    companyId,
    scanLocation,
    scanType: 'IN',
    scanTime: {
      $lt: parsedOutTime,
    },
  }).sort({ scanTime: -1 });

  if (!lastInLog) return null;

  const alreadyCheckedOutQuery = {
    employeeId,
    companyId,
    scanLocation,
    scanType: 'OUT',
    scanTime: {
      $gt: lastInLog.scanTime,
      $lt: parsedOutTime,
    },
  };

  if (excludeOutId) {
    alreadyCheckedOutQuery._id = { $ne: excludeOutId };
  }

  const alreadyCheckedOut = await AttendanceLog.exists(alreadyCheckedOutQuery);

  return alreadyCheckedOut ? null : lastInLog;
};

const findRecentAttendanceScan = ({ employeeId, companyId, scanLocation, now }) => {
  const windowStart = new Date(now.getTime() - DUPLICATE_SCAN_WINDOW_MS);

  return AttendanceLog.findOne({
    employeeId,
    companyId,
    scanLocation,
    shift: { $ne: AUTO_CHECKOUT_SHIFT },
    scanTime: {
      $gte: windowStart,
      $lte: now,
    },
  }).sort({ scanTime: -1 });
};

const sendDuplicateAttendanceScan = (res, attendance, context) => {
  return res.status(200).json({
    message: `Duplicate attendance scan ignored. Attendance ${attendance.scanType} was already recorded at ${context}.`,
    attendance,
    duplicate: true,
  });
};

const findCheckoutForOpenCheckIn = async (firstIn) => {
  if (!firstIn?.scanTime) return null;

  const inTime = new Date(firstIn.scanTime);
  if (Number.isNaN(inTime.getTime())) return null;

  const employeeId = getIdValue(firstIn.employeeId);
  const companyId = getIdValue(firstIn.companyId);

  if (!employeeId || !companyId) return null;

  return AttendanceLog.findOne({
    employeeId,
    companyId,
    scanLocation: 'SECURITY',
    scanType: 'OUT',
    scanTime: {
      $gt: inTime,
    },
  })
    .sort({ scanTime: 1 })
    .populate('employeeId companyId');
};

const hasCheckoutAfterCheckIn = ({ employeeId, companyId, scanLocation, checkInTime, now }) => {
  return AttendanceLog.exists({
    employeeId,
    companyId,
    scanLocation,
    scanType: 'OUT',
    scanTime: {
      $gt: checkInTime,
      $lte: now,
    },
  });
};

const hasWorkSessionAfterAutoCheckoutTime = ({ employeeId, checkInTime, autoCheckoutTime, now }) => {
  return WorkSession.exists({
    employeeId,
    startTime: {
      $gte: checkInTime,
      $lte: now,
    },
    $or: [
      { endTime: { $exists: false } },
      { endTime: null },
      { endTime: { $gte: autoCheckoutTime } },
    ],
  });
};

const applyAutoCheckoutForOpenCheckIn = async (inLog, now = new Date()) => {
  const employee = inLog.employeeId;
  const employeeId = getIdValue(employee);
  const companyId = getIdValue(inLog.companyId);
  const qrId = getIdValue(inLog.qrId);

  if (!employeeId || !companyId || !qrId || !inLog.scanTime) return false;

  const checkInTime = new Date(inLog.scanTime);
  if (Number.isNaN(checkInTime.getTime())) return false;

  const autoCheckoutHours = getAutoCheckoutHours(employee?.employeeType);
  const autoCheckoutTime = new Date(checkInTime.getTime() + autoCheckoutHours * 60 * 60 * 1000);

  if (now < autoCheckoutTime) return false;

  const alreadyCheckedOut = await hasCheckoutAfterCheckIn({
    employeeId,
    companyId,
    scanLocation: inLog.scanLocation,
    checkInTime,
    now,
  });

  if (alreadyCheckedOut) return false;

  const blockingWorkSession = await hasWorkSessionAfterAutoCheckoutTime({
    employeeId,
    checkInTime,
    autoCheckoutTime,
    now,
  });

  if (blockingWorkSession) return false;

  const latestCheckout = await hasCheckoutAfterCheckIn({
    employeeId,
    companyId,
    scanLocation: inLog.scanLocation,
    checkInTime,
    now: new Date(),
  });

  if (latestCheckout) return false;

  const attendance = new AttendanceLog({
    qrId,
    companyId,
    employeeId,
    scanType: 'OUT',
    scanLocation: inLog.scanLocation,
    scanTime: autoCheckoutTime,
    workDate: inLog.workDate,
    shift: AUTO_CHECKOUT_SHIFT,
    editedAt: new Date(),
  });

  await attendance.save();
  return true;
};

const applyAutoCheckoutsForDate = async (date, now = new Date()) => {
  const inLogs = await AttendanceLog.find({
    workDate: date,
    scanLocation: 'SECURITY',
    scanType: 'IN',
  })
    .sort({ scanTime: 1 })
    .populate('employeeId companyId');

  let createdCount = 0;

  for (const inLog of inLogs) {
    if (await applyAutoCheckoutForOpenCheckIn(inLog, now)) {
      createdCount += 1;
    }
  }

  return createdCount;
};

const applyAutoCheckoutsBeforeEmployeeScan = async ({ employeeId, companyId, scanLocation, now = new Date() }) => {
  const inLogs = await AttendanceLog.find({
    employeeId,
    companyId,
    scanLocation,
    scanType: 'IN',
    scanTime: {
      $lt: now,
    },
  })
    .sort({ scanTime: 1 })
    .populate('employeeId companyId');

  let createdCount = 0;

  for (const inLog of inLogs) {
    if (await applyAutoCheckoutForOpenCheckIn(inLog, now)) {
      createdCount += 1;
    }
  }

  return createdCount;
};

const isCheckoutForPreviousOpenShift = async (outLog) => {
  if (!outLog?.scanTime) return false;

  const employeeId = getIdValue(outLog.employeeId);
  const companyId = getIdValue(outLog.companyId);
  if (!employeeId || !companyId) return false;

  const openIn = await findOpenCheckInForCheckout({
    employeeId,
    companyId,
    scanLocation: 'SECURITY',
    outTime: outLog.scanTime,
  });

  return Boolean(openIn && openIn.workDate !== outLog.workDate);
};

const buildAttendanceSummaryRows = async (date) => {
  const logs = await AttendanceLog.find({
    workDate: date,
    scanLocation: 'SECURITY',
  })
    .sort({ scanTime: 1 })
    .populate('employeeId companyId');

  const summary = {};
  logs.forEach((log) => {
    const empId = getEmployeeKey(log);
    if (!summary[empId]) {
      summary[empId] = {
        employee: log.employeeId,
        company: log.companyId,
        logs: [],
      };
    }
    summary[empId].logs.push(log);
  });

  const rows = await Promise.all(
    Object.values(summary).map(async ({ employee, company, logs: employeeLogs }) => {
      employeeLogs.sort((a, b) => new Date(a.scanTime) - new Date(b.scanTime));

      const firstIn = employeeLogs.find((log) => log.scanType === 'IN');
      let lastOut = null;

      if (firstIn) {
        lastOut = [...employeeLogs]
          .reverse()
          .find(
            (log) =>
              log.scanType === 'OUT' &&
              isAfter(log.scanTime, firstIn.scanTime)
          );

        if (!lastOut) {
          lastOut = await findCheckoutForOpenCheckIn(firstIn);
        }
      } else {
        lastOut = [...employeeLogs].reverse().find((log) => log.scanType === 'OUT');

        // If this row only has a checkout because an overnight OUT was saved
        // under the checkout calendar date, do not show it as an "Absent" row
        // on that next day. It belongs to the original check-in workDate.
        if (lastOut && (await isCheckoutForPreviousOpenShift(lastOut))) {
          return null;
        }
      }

      return {
        employee,
        company,
        firstIn,
        lastOut,
      };
    })
  );

  return rows.filter(Boolean);
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

    const recentAttendanceScan = await findRecentAttendanceScan({
      employeeId,
      companyId,
      scanLocation: context,
      now,
    });

    if (recentAttendanceScan) {
      return sendDuplicateAttendanceScan(res, recentAttendanceScan, context);
    }

    await applyAutoCheckoutsBeforeEmployeeScan({
      employeeId,
      companyId,
      scanLocation: context,
      now,
    });

    const openInLogForCheckout = await findOpenCheckInForCheckout({
      employeeId,
      companyId,
      scanLocation: context,
      outTime: now,
    });

    // Accept scanType from request, default to OUT only when there is a valid
    // open check-in. Otherwise, start a new IN.
    let type = scanType || (openInLogForCheckout ? 'OUT' : 'IN');

    // If checking OUT, inherit the workDate from the latest open IN scan.
    // Overnight shifts must stay under the original check-in workDate, even if checkout
    // happens on the next calendar day.
    if (type === 'OUT') {
      const activeWorkSession = await WorkSession.findOne({
        employeeId,
        $or: [
          { endTime: { $exists: false } },
          { endTime: null },
        ],
      }).select('_id');

      if (activeWorkSession) {
        return res.status(400).json({ message: 'Working Session is not ended' });
      }

      const openInLog = openInLogForCheckout || await findOpenCheckInForCheckout({
        employeeId,
        companyId,
        scanLocation: context,
        outTime: now,
      });

      if (!openInLog) {
        return res.status(400).json({
          message: 'No open check-in found. Please check in first.',
        });
      }

      workDate = openInLog.workDate;
    }

    const latestRecentAttendanceScan = await findRecentAttendanceScan({
      employeeId,
      companyId,
      scanLocation: context,
      now: new Date(),
    });

    if (latestRecentAttendanceScan) {
      return sendDuplicateAttendanceScan(res, latestRecentAttendanceScan, context);
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
    const { scanTime, workDate } = req.body;

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

    const scanWorkDate = toWorkDate(parsed);
    if (!scanWorkDate) {
      return res.status(400).json({ message: 'Failed to compute workDate from scanTime' });
    }

    const requestedWorkDate = typeof workDate === 'string' && workDate.trim() ? workDate.trim() : null;
    if (requestedWorkDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedWorkDate)) {
      return res.status(400).json({ message: 'workDate must be in YYYY-MM-DD format' });
    }

    let nextWorkDate = log.scanType === 'IN' ? scanWorkDate : requestedWorkDate || log.workDate;

    if (log.scanType === 'IN' && requestedWorkDate && requestedWorkDate !== scanWorkDate) {
      return res.status(400).json({ message: 'Check-in workDate must match the selected check-in date' });
    }

    const checkoutWorkDateChanged = log.scanType === 'OUT' && requestedWorkDate && requestedWorkDate !== log.workDate;
    if (log.scanType === 'OUT' && (checkoutWorkDateChanged || nextWorkDate !== scanWorkDate)) {
      const openInLog = await findOpenCheckInForCheckout({
        employeeId: log.employeeId,
        companyId: log.companyId,
        scanLocation: log.scanLocation,
        outTime: parsed,
        excludeOutId: log._id,
      });

      if (!openInLog || openInLog.workDate !== log.workDate) {
        return res.status(400).json({
          message:
            'Checkout can only be moved to another calendar date when it still belongs to the same open shift.',
        });
      }
    }

    log.scanTime = parsed;
    log.workDate = nextWorkDate;
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
    let lastOut = null;

    if (firstIn) {
      lastOut = [...logs]
        .reverse()
        .find(
          (log) =>
            log.scanType === 'OUT' &&
            isAfter(log.scanTime, firstIn.scanTime)
        );

      if (!lastOut) {
        lastOut = await findCheckoutForOpenCheckIn(firstIn);
      }
    }

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
    if (shouldApplyAutoCheckout(req)) {
      await applyAutoCheckoutsForDate(date);
    }
    const result = await buildAttendanceSummaryRows(date);
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

    await applyAutoCheckoutsForDate(day);
    const summaryRows = await buildAttendanceSummaryRows(day);
    const openRows = summaryRows.filter(({ firstIn, lastOut }) => firstIn && !lastOut);

    if (openRows.length === 0) {
      return res.status(200).json({ date: day, count: 0, rows: [] });
    }

    const openShiftRows = openRows.map(({ employee, company, firstIn }) => ({
      employeeId: employee?._id?.toString() || firstIn?.employeeId?.toString() || null,
      employeeName: employee?.name || '—',
      employeeCode: employee?.employeeId || '—',
      companyName: company?.companyName || '—',
      lastCheckIn: firstIn?.scanTime || null,
    }));

    return res.status(200).json({
      date: day,
      count: openShiftRows.length,
      rows: openShiftRows,
    });

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
    
    // Legacy grouping kept harmless; OT rows below come from buildAttendanceSummaryRows.
    const logs = [];
    
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

    const result = (await buildAttendanceSummaryRows(date)).map(({ employee, company, firstIn, lastOut }) => {
      // Sort ascending so firstIn/lastOut are reliable
      // Summary rows are already sorted and paired by the overnight-aware helper.

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
