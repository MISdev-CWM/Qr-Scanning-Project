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

const isMongoObjectId = (value) => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

const toWorkDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getIdValue = (value) => value?._id || value;

const getEmployeeKey = (log) =>
  log.employeeId?._id?.toString() || log.employeeId?.toString() || 'unknown';

const isAfter = (later, earlier) => new Date(later).getTime() > new Date(earlier).getTime();

const getDayBounds = (date) => {
  const parts = String(date || '').split('-').map((value) => Number(value));
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    };
  }

  const [year, month, day] = parts;
  return {
    start: new Date(year, month - 1, day, 0, 0, 0, 0),
    end: new Date(year, month - 1, day, 23, 59, 59, 999),
  };
};

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

const getAttendanceDeleteContext = async ({
  attendanceLogIds,
  employeeId,
  workDate,
  checkInTime,
  checkOutTime,
  expectedScanTypes,
}) => {
  const logIds = Array.from(new Set((Array.isArray(attendanceLogIds) ? attendanceLogIds : [])
    .map((id) => String(id || '').trim())
    .filter(isMongoObjectId)));
  const requestedEmployeeId = String(employeeId || '').trim();
  const parsedCheckInTime = checkInTime ? new Date(checkInTime) : null;
  const parsedCheckOutTime = checkOutTime ? new Date(checkOutTime) : null;
  const hasValidCheckInTime = parsedCheckInTime && !Number.isNaN(parsedCheckInTime.getTime());
  const hasValidCheckOutTime = parsedCheckOutTime && !Number.isNaN(parsedCheckOutTime.getTime());
  const expectsCheckIn = Boolean(expectedScanTypes?.in || hasValidCheckInTime);
  const expectsCheckOut = Boolean(expectedScanTypes?.out || hasValidCheckOutTime);

  if (logIds.length === 0 && (!isMongoObjectId(requestedEmployeeId) || (!hasValidCheckInTime && !hasValidCheckOutTime))) {
    const error = new Error('At least one attendance log id or row time is required');
    error.statusCode = 400;
    throw error;
  }

  let seedAttendanceLogs = logIds.length > 0
    ? await AttendanceLog.find({
      _id: { $in: logIds },
      scanLocation: 'SECURITY',
    })
      .sort({ scanTime: 1 })
      .populate('employeeId companyId qrId')
    : [];

  if (seedAttendanceLogs.length === 0 && isMongoObjectId(requestedEmployeeId)) {
    const timeLookups = [];
    if (hasValidCheckInTime) {
      timeLookups.push({ scanType: 'IN', scanTime: parsedCheckInTime });
    }
    if (hasValidCheckOutTime) {
      timeLookups.push({ scanType: 'OUT', scanTime: parsedCheckOutTime });
    }

    if (timeLookups.length > 0) {
      seedAttendanceLogs = await AttendanceLog.find({
        employeeId: requestedEmployeeId,
        scanLocation: 'SECURITY',
        $or: timeLookups,
      })
        .sort({ scanTime: 1 })
        .populate('employeeId companyId qrId');
    }
  }

  if (seedAttendanceLogs.length === 0) {
    const error = new Error('Attendance record not found');
    error.statusCode = 404;
    throw error;
  }

  const resolvedEmployeeId = getIdValue(seedAttendanceLogs[0].employeeId)?.toString();
  if (!resolvedEmployeeId) {
    const error = new Error('Attendance record does not have a valid employee');
    error.statusCode = 400;
    throw error;
  }

  if (requestedEmployeeId && requestedEmployeeId !== resolvedEmployeeId) {
    const error = new Error('Attendance record does not belong to the selected employee');
    error.statusCode = 400;
    throw error;
  }

  const resolvedCompanyId = getIdValue(seedAttendanceLogs[0].companyId)?.toString();

  const hasDifferentEmployee = seedAttendanceLogs.some(
    (log) => getIdValue(log.employeeId)?.toString() !== resolvedEmployeeId
  );
  if (hasDifferentEmployee) {
    const error = new Error('All selected attendance logs must belong to the same employee');
    error.statusCode = 400;
    throw error;
  }

  const hasDifferentCompany = seedAttendanceLogs.some(
    (log) => getIdValue(log.companyId)?.toString() !== resolvedCompanyId
  );
  if (hasDifferentCompany) {
    const error = new Error('All selected attendance logs must belong to the same company');
    error.statusCode = 400;
    throw error;
  }

  const sameTimestamp = (left, right) =>
    new Date(left).getTime() === new Date(right).getTime();

  const findExactAttendanceLog = async (scanType, scanTime, selectedLog) => {
    if (!scanTime || Number.isNaN(scanTime.getTime())) return selectedLog || null;

    const scanLabel = scanType === 'IN' ? 'check-in' : 'check-out';

    if (selectedLog) {
      if (sameTimestamp(selectedLog.scanTime, scanTime)) {
        return selectedLog;
      }

      const error = new Error(`Selected ${scanLabel} log does not match this attendance row`);
      error.statusCode = 400;
      throw error;
    }

    const query = {
      employeeId: resolvedEmployeeId,
      scanLocation: 'SECURITY',
      scanType,
      scanTime,
    };

    if (resolvedCompanyId) {
      query.companyId = resolvedCompanyId;
    }

    const matches = await AttendanceLog.find(query);
    if (matches.length > 1) {
      const error = new Error(`Multiple matching ${scanLabel} logs found for this attendance row`);
      error.statusCode = 400;
      throw error;
    }

    return matches[0] || null;
  };

  let firstIn = seedAttendanceLogs.find((log) => log.scanType === 'IN');
  let lastOut = [...seedAttendanceLogs].reverse().find((log) => log.scanType === 'OUT');

  if (hasValidCheckInTime) {
    const exactIn = await findExactAttendanceLog('IN', parsedCheckInTime, firstIn);
    if (exactIn) {
      firstIn = exactIn;
    } else if (!firstIn || !sameTimestamp(firstIn.scanTime, parsedCheckInTime)) {
      const error = new Error('Matching check-in log was not found for this attendance row');
      error.statusCode = 404;
      throw error;
    }
  }

  if (hasValidCheckOutTime) {
    const exactOut = await findExactAttendanceLog('OUT', parsedCheckOutTime, lastOut);
    if (exactOut) {
      lastOut = exactOut;
    } else if (!lastOut || !sameTimestamp(lastOut.scanTime, parsedCheckOutTime)) {
      const error = new Error('Matching check-out log was not found for this attendance row');
      error.statusCode = 404;
      throw error;
    }
  }

  if (!firstIn && lastOut && expectsCheckIn) {
    firstIn = await findOpenCheckInForCheckout({
      employeeId: getIdValue(lastOut.employeeId),
      companyId: getIdValue(lastOut.companyId),
      scanLocation: lastOut.scanLocation,
      outTime: lastOut.scanTime,
      excludeOutId: lastOut._id,
    });
  }

  if (firstIn && !lastOut && expectsCheckOut) {
    lastOut = await findCheckoutForOpenCheckIn(firstIn);
  }

  const resolvedLogIds = Array.from(new Set([
    ...seedAttendanceLogs.map((log) => log._id?.toString()),
    firstIn?._id?.toString(),
    lastOut?._id?.toString(),
  ].filter(Boolean)));

  const attendanceLogs = await AttendanceLog.find({
    _id: { $in: resolvedLogIds },
    scanLocation: 'SECURITY',
  })
    .sort({ scanTime: 1 })
    .populate('employeeId companyId qrId');

  const resolvedHasDifferentEmployee = attendanceLogs.some(
    (log) => getIdValue(log.employeeId)?.toString() !== resolvedEmployeeId
  );
  if (resolvedHasDifferentEmployee) {
    const error = new Error('Resolved attendance logs must belong to the same employee');
    error.statusCode = 400;
    throw error;
  }

  const resolvedHasDifferentCompany = attendanceLogs.some(
    (log) => getIdValue(log.companyId)?.toString() !== resolvedCompanyId
  );
  if (resolvedHasDifferentCompany) {
    const error = new Error('Resolved attendance logs must belong to the same company');
    error.statusCode = 400;
    throw error;
  }

  firstIn = hasValidCheckInTime
    ? attendanceLogs.find((log) => log.scanType === 'IN' && sameTimestamp(log.scanTime, parsedCheckInTime))
    : attendanceLogs.find((log) => log.scanType === 'IN');
  lastOut = hasValidCheckOutTime
    ? [...attendanceLogs].reverse().find((log) => log.scanType === 'OUT' && sameTimestamp(log.scanTime, parsedCheckOutTime))
    : [...attendanceLogs].reverse().find((log) => log.scanType === 'OUT');

  if (expectsCheckIn && !firstIn) {
    const error = new Error('Matching check-in log was not found for this attendance row');
    error.statusCode = 404;
    throw error;
  }

  if (expectsCheckOut && !lastOut) {
    const error = new Error('Matching check-out log was not found for this attendance row');
    error.statusCode = 404;
    throw error;
  }

  if (firstIn && lastOut && new Date(lastOut.scanTime).getTime() < new Date(firstIn.scanTime).getTime()) {
    const error = new Error('Check-out time cannot be before the matching check-in time');
    error.statusCode = 400;
    throw error;
  }

  const resolvedWorkDate = firstIn?.workDate || lastOut?.workDate || attendanceLogs[0]?.workDate || workDate;
  const dayBounds = getDayBounds(resolvedWorkDate);

  let periodStart = firstIn?.scanTime ? new Date(firstIn.scanTime) : dayBounds.start;
  let periodEnd = lastOut?.scanTime ? new Date(lastOut.scanTime) : new Date();

  if (Number.isNaN(periodStart.getTime())) periodStart = dayBounds.start;
  if (Number.isNaN(periodEnd.getTime())) periodEnd = dayBounds.end;
  if (periodEnd < periodStart) periodEnd = periodStart;

  const workSessions = await WorkSession.find({
    employeeId: resolvedEmployeeId,
    startTime: { $lte: periodEnd },
    $or: [
      { endTime: { $exists: false } },
      { endTime: null },
      { endTime: { $gte: periodStart } },
    ],
  })
    .sort({ startTime: 1 })
    .populate('employeeId companyId qrId');

  return {
    attendanceLogs,
    workSessions,
    periodStart,
    periodEnd,
    workDate: resolvedWorkDate,
  };
};

// POST /api/attendance/records/delete-preview
// Admin-only: preview attendance logs and overlapping work sessions before deletion.
export const previewAttendanceRecordDelete = async (req, res) => {
  try {
    const context = await getAttendanceDeleteContext(req.body || {});

    return res.status(200).json({
      workDate: context.workDate,
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
      attendanceLogs: context.attendanceLogs,
      workSessions: context.workSessions,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: err.message || 'Error preparing attendance delete preview',
      error: err.message,
    });
  }
};

// POST /api/attendance/records/delete
// Admin-only: delete selected attendance logs and overlapping work sessions.
export const deleteAttendanceRecord = async (req, res) => {
  try {
    const context = await getAttendanceDeleteContext(req.body || {});
    const attendanceLogIds = context.attendanceLogs.map((log) => log._id);
    const workSessionIds = context.workSessions.map((session) => session._id);

    const attendanceDeleteResult = await AttendanceLog.deleteMany({
      _id: { $in: attendanceLogIds },
    });

    const workSessionDeleteResult = workSessionIds.length > 0
      ? await WorkSession.deleteMany({ _id: { $in: workSessionIds } })
      : { deletedCount: 0 };

    return res.status(200).json({
      message: 'Attendance record deleted successfully',
      deletedAttendanceCount: attendanceDeleteResult.deletedCount || 0,
      deletedWorkSessionCount: workSessionDeleteResult.deletedCount || 0,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: err.message || 'Error deleting attendance record',
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
